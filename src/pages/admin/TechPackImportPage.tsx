import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { designsApi } from "../../api/adminApi";
import type {
  ChartCoverageRow,
  DesignChartStatus,
  EngineChartField,
  TechPackParseResult,
} from "../../api/adminApi";
import { PageHeader, Button, EmptyState } from "../../components";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { rowActivation } from "../../utils/rowActivation";
import styles from "./TechPackImportPage.module.css";

/**
 * Tech-pack import — putting a brand's own size chart into the fit engine.
 *
 * Until this screen existed the only way in was hand-written SQL, and
 * `garment_size_chart` held 7 rows with NOT ONE attached to a design. Every garment was
 * cut to a generic category chart, and nothing anywhere said so — "using the generic
 * chart" and "calibrated to this brand" looked identical from every surface.
 *
 * The screen is built around that: the coverage list leads, because the first useful
 * thing is knowing which designs are still falling back.
 *
 * PREVIEW IS A SEPARATE STEP FROM SAVE, on purpose. A size chart that is quietly wrong
 * is worse than none — the fallback at least behaves predictably, whereas a bad chart is
 * confidently applied to a real garment. So the parse result is shown in full first:
 * which columns were understood, which were not, and every row that would be refused
 * with the reason.
 */

const SAMPLE = `Size,Waist,Hip,Thigh,Knee
28,28,40,24,15
30,30,42,25,15.5
32,32,44,26,16
34,34,46,27,16.5`;

export const TechPackImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const designId = searchParams.get("design") ?? "";

  const [coverage, setCoverage] = React.useState<ChartCoverageRow[] | null>(null);
  const [coverageErr, setCoverageErr] = React.useState("");
  const [status, setStatus] = React.useState<DesignChartStatus | null>(null);

  const [text, setText] = React.useState("");
  const [unit, setUnit] = React.useState<"in" | "cm">("in");
  const [overrides, setOverrides] = React.useState<Record<string, EngineChartField>>({});
  const [sourceNote, setSourceNote] = React.useState("");

  const [parsed, setParsed] = React.useState<TechPackParseResult | null>(null);
  const [parseErr, setParseErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const loadCoverage = React.useCallback(() => {
    setCoverage(null);
    setCoverageErr("");
    designsApi
      .chartCoverage()
      .then(setCoverage)
      .catch((e) => setCoverageErr(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  React.useEffect(loadCoverage, [loadCoverage]);

  React.useEffect(() => {
    if (!designId) {
      setStatus(null);
      return;
    }
    designsApi
      .chartStatus(designId)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [designId]);

  const selectDesign = (id: string) => {
    setSearchParams(id ? { design: id } : {});
    setParsed(null);
    setParseErr("");
    setOverrides({});
  };

  const preview = async () => {
    if (!designId || !text.trim()) return;
    setBusy(true);
    setParseErr("");
    try {
      setParsed(await designsApi.techPackPreview(designId, { text, unit, overrides }));
    } catch (e) {
      setParsed(null);
      // The server's message names WHAT it refused and why — show it, don't replace it.
      setParseErr(e instanceof Error ? e.message : "Could not read that chart.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!designId || !parsed) return;
    setBusy(true);
    try {
      const res = await designsApi.techPackImport(designId, {
        text,
        unit,
        overrides,
        source_note: sourceNote.trim() || undefined,
      });
      showToast(
        "success",
        `${res.sizes_written} size${res.sizes_written === 1 ? "" : "s"} saved`,
        res.replaced > 0
          ? `Replaced the previous chart (${res.replaced} rows). This design is now cut to its own numbers.`
          : "This design is now cut to its own numbers instead of the generic chart.",
      );
      setParsed(null);
      setText("");
      const fresh = await designsApi.chartStatus(designId);
      setStatus(fresh);
      loadCoverage();
    } catch (e) {
      showToast(
        "error",
        "Could not save the chart",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const uncalibrated = coverage?.filter((c) => c.own_sizes === 0) ?? [];
  const calibrated = coverage?.filter((c) => c.own_sizes > 0) ?? [];

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <PageHeader
        eyebrow="Design"
        title="Tech-pack import"
        subtitle="Put a brand's own size chart into the fit engine. A design with no chart of its own is cut to a generic category chart."
      />

      {/* ── Coverage: which designs still fall back ───────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Designs without their own chart
          {coverage && <span className={styles.count}>{uncalibrated.length}</span>}
        </h2>

        {coverageErr ? (
          <EmptyState
            size="compact"
            title="Couldn't load the design list"
            body={coverageErr}
            action={{ label: "Retry", onClick: loadCoverage }}
          />
        ) : coverage === null ? (
          <EmptyState size="compact" title="Loading…" />
        ) : uncalibrated.length === 0 ? (
          <EmptyState
            size="compact"
            title="Every design has its own chart"
            body="Nothing is falling back to the generic category chart."
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Design</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Sized by</th>
                </tr>
              </thead>
              <tbody>
                {uncalibrated.map((c) => (
                  <tr
                    key={c.design_id}
                    className={`${styles.row} ${c.design_id === designId ? styles.rowActive : ""}`}
                    {...rowActivation(() => selectDesign(c.design_id))}
                  >
                    <td className={styles.name}>{c.name}</td>
                    <td>{c.category}</td>
                    <td>{c.status}</td>
                    {/* Naming the fallback is the point — it was invisible before. */}
                    <td className={styles.fallback}>generic category chart</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {calibrated.length > 0 && (
          <p className={styles.calibratedNote}>
            {calibrated.length} design{calibrated.length === 1 ? " has" : "s have"} their own
            chart.{" "}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => selectDesign(calibrated[0].design_id)}
            >
              Open {calibrated[0].name}
            </button>
          </p>
        )}
      </section>

      {/* ── The import itself ─────────────────────────────────────────────── */}
      {!designId ? (
        <EmptyState
          title="Pick a design to import a chart for"
          body="Choose one above. A chart belongs to a single design — it is that style's own sizing, not the category's."
        />
      ) : (
        <section className={styles.section}>
          <div className={styles.designHead}>
            <h2 className={styles.sectionTitle}>{status?.design_name ?? "Design"}</h2>
            {status && (
              <span
                className={status.source === "own" ? styles.pillOwn : styles.pillFallback}
                title={status.note}
              >
                {status.source === "own"
                  ? `own chart · ${status.own_sizes} sizes`
                  : status.source === "category"
                    ? "generic category chart"
                    : "no chart at all"}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/admin/design/library/${designId}`)}
            >
              Open design
            </Button>
          </div>

          {status && <p className={styles.statusNote}>{status.note}</p>}

          <div className={styles.controls}>
            <label className={styles.field}>
              <span className={styles.label}>Measurements are in</span>
              <select
                className={styles.select}
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value as "in" | "cm");
                  setParsed(null);
                }}
              >
                <option value="in">inches</option>
                <option value="cm">centimetres</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Where these numbers came from</span>
              <input
                className={styles.input}
                placeholder="e.g. Brand tech pack v2, Mar 2026"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>
              Paste the size chart — headings on the first row, one row per size
            </span>
            <textarea
              className={styles.textarea}
              rows={10}
              spellCheck={false}
              placeholder={SAMPLE}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setParsed(null);
              }}
            />
          </label>

          <div className={styles.actions}>
            <Button onClick={preview} disabled={busy || !text.trim()}>
              {busy ? "Reading…" : "Read chart"}
            </Button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setText(SAMPLE);
                setParsed(null);
              }}
            >
              Use an example
            </button>
          </div>

          {parseErr && (
            <div className={styles.parseError} role="alert">
              {parseErr}
            </div>
          )}

          {parsed && (
            <div className={styles.result}>
              {/* What was understood — shown BEFORE anything is saved. */}
              <div className={styles.mapRow}>
                <span className={styles.mapLabel}>Understood</span>
                {Object.entries(parsed.mapped).map(([field, col]) => (
                  <span key={field} className={styles.chipOk}>
                    {col} → {field}
                  </span>
                ))}
              </div>

              {parsed.unmapped.length > 0 && (
                <div className={styles.mapRow}>
                  <span className={styles.mapLabel}>Not used</span>
                  {parsed.unmapped.map((col) => (
                    <span key={col} className={styles.chipUnmapped}>
                      {col}
                      <select
                        className={styles.mapSelect}
                        value={overrides[col] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value as EngineChartField | "";
                          setOverrides((o) => {
                            const next = { ...o };
                            if (v) next[col] = v;
                            else delete next[col];
                            return next;
                          });
                          setParsed(null);
                        }}
                      >
                        <option value="">ignore</option>
                        {parsed.engine_fields.map((f) => (
                          <option key={f} value={f}>
                            map to {f}
                          </option>
                        ))}
                      </select>
                    </span>
                  ))}
                  <span className={styles.hint}>
                    The engine only reads {parsed.engine_fields.join(", ")}. Map a column if one
                    of these is under a name we didn't recognise, then read the chart again.
                  </span>
                </div>
              )}

              {parsed.problems.length > 0 && (
                <ul className={styles.problems}>
                  {parsed.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Size</th>
                      {parsed.engine_fields.map((f) => (
                        <th key={f}>{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r) => (
                      <tr key={r.size_label}>
                        <td className={styles.name}>{r.size_label}</td>
                        {parsed.engine_fields.map((f) => (
                          <td key={f}>
                            {r.measurements[f] ?? <span className={styles.missing}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.unitNote}>
                Stored in inches{unit === "cm" ? " — converted from your centimetres" : ""}. A
                blank cell is a measurement we don't have, not a zero.
              </p>

              <div className={styles.actions}>
                <Button onClick={save} disabled={busy}>
                  {busy ? "Saving…" : `Save ${parsed.rows.length} sizes to this design`}
                </Button>
                {status?.own_sizes ? (
                  <span className={styles.replaceWarn}>
                    This replaces the design's existing {status.own_sizes}-size chart. A
                    half-updated chart would cut two different garments depending on the
                    customer.
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {status && status.source === "own" && status.chart.length > 0 && !parsed && (
            <div className={styles.current}>
              <h3 className={styles.sectionTitle}>Chart in use</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Measurements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.chart.map((c) => (
                      <tr key={c.size_label}>
                        <td className={styles.name}>{c.size_label}</td>
                        <td>
                          {Object.entries(c.measurements)
                            .map(([k, v]) => `${k} ${v}″`)
                            .join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default TechPackImportPage;
