import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  cmListingsApi,
  designsApi,
  fabricsApi,
  hubsApi,
  uploadToR2,
  R2_PUBLIC_URL,
  fetchMoneyConfig,
} from "../../api/adminApi";
import type {
  CmListing,
  ReadyToListSample,
  DesignSummary,
  Fabric,
  Hub,
  FabricStockRow,
  ListingPreflight,
} from "../../api/adminApi";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { Textarea } from "../../components/Textarea";
import { Modal } from "../../components/Modal/Modal";
import { Spinner } from "../../components/Spinner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { StatusBadge } from "../../components/StatusBadge";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import base from "./OrdersListPage.module.css";
import s from "./ListingsManagePage.module.css";
import {
  UilPlus,
  UilTimes,
  UilImagePlus,
  UilImage,
  UilCopy,
} from "@iconscout/react-unicons";

const url = (k?: string) => (k && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${k}` : "");

// G-26 cost floor: fabric + make + per-order overhead (FABLE-SOLUTIONS P2 model).
// T1-23: make/overhead are single-sourced from the server (fetchMoneyConfig); these are
// only the fallback defaults until the fetch resolves, matching the backend defaults.
const MAKE_COST = 180;
const OVERHEAD = 250;
const costFloor = (
  pricePerMeter: string | number | null | undefined,
  metersPerGarment: string | number | null | undefined,
  make: number,
  overhead: number,
): number | null => {
  const ppm = pricePerMeter == null ? NaN : Number(pricePerMeter);
  const mpg = metersPerGarment == null ? NaN : Number(metersPerGarment);
  if (!Number.isFinite(ppm) || !Number.isFinite(mpg)) return null;
  return Math.round(ppm * mpg + make + overhead);
};
const marginPct = (price: number, floor: number) => Math.round(((price - floor) / price) * 100);

// T2-27 (CM-2): available metres of the editor's fabric at its hub, vs metres-per-garment.
function stockFor(
  editor: Editor | null,
  editorStock: FabricStockRow[] | null,
  designs: DesignSummary[],
): { available: number | null; mpg: number | null; inStock: boolean | null } {
  if (!editor || !editor.fabric_id) return { available: null, mpg: null, inStock: null };
  const row = editorStock?.find((r) => r.fabric_id === editor.fabric_id);
  const available = row ? Number(row.available_meters) : null;
  const mpgRaw = editor.metersPerGarment ?? designs.find((d) => d.id === editor.design_id)?.meters_per_garment;
  const mpg = mpgRaw == null || mpgRaw === "" ? null : Number(mpgRaw);
  const inStock = available != null && mpg != null ? available >= mpg : null;
  return { available, mpg, inStock };
}

type Editor = {
  mode: "sample" | "direct" | "edit";
  sampleId?: string;
  listingId?: string;
  design_id: string;
  fabric_id: string;
  hub_id: string;
  label: string;
  fabricLabel: string;
  price: string;
  description: string;
  fitNotes: string; // T3-6 (W-C2): authored fit guidance
  photos: string[];
  isActive: boolean;
  // T3-6 (W-C2): auto-assembled fabric facts (edit mode; read-only reference).
  fabricComposition?: string | null;
  fabricWeightGsm?: number | null;
  fabricWeave?: string | null;
  fabricCare?: string[] | null;
  /** G-26: cost-floor inputs when known (edit mode from the listing row) */
  pricePerMeter?: string | number | null;
  metersPerGarment?: string | number | null;
  /** G-25: current stock truth when known (edit mode) */
  inStock?: boolean;
};

/**
 * [CM-18-4 / CM-19-2] Garments left comes from the SERVER, not from this page.
 *
 * The first version divided available_meters by meters_per_garment in the browser. That
 * ignores the size run, the fabric width and cutting wastage, so it OVERSTATED the count —
 * showing ~52 where the Fabric Stock page next door said 46 for the same fabric, which is
 * exactly the "two definitions in one console" defect [CM-19-4] describes.
 *
 * `garments_available` now arrives on the listing payload, computed by the one shared
 * helper the fabric-stock page and the publish pre-flight also use.
 */

/** Under this many garments left, the merchant should be reordering, not discovering. */
const LOW_GARMENTS = 5;

export const ListingsManagePage: React.FC = () => {
  const [listings, setListings] = React.useState<CmListing[]>([]);
  const [ready, setReady] = React.useState<ReadyToListSample[]>([]);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  // T1-23: single-source cost-floor constants from the server (fallback to the defaults).
  const [money, setMoney] = React.useState({ make: MAKE_COST, overhead: OVERHEAD });
  React.useEffect(() => {
    fetchMoneyConfig()
      .then((c) => setMoney({ make: c.listing_make_cost, overhead: c.listing_overhead }))
      .catch(() => {});
  }, []);
  const [editor, setEditor] = React.useState<Editor | null>(null);
  // T2-27 (CM-1): status tabs. T2-27 (CM-2): live hub stock for the chosen fabric while picking.
  const [tab, setTab] = React.useState<"all" | "ready" | "drafts" | "oos">("all");
  const [editorStock, setEditorStock] = React.useState<FabricStockRow[] | null>(null);

  /**
   * [CM-18-5] Every publish gate, computed when the editor opens.
   *
   * Publishing a blocked draft used to return SAMPLE_REQUIRED and only that — behind it sat
   * sew-validation, the photo rule and the stock warning, each discovered by fixing the
   * previous one and pressing Publish again. Three round trips to learn what this editor
   * already had the inputs to ask about once.
   */
  const [preflight, setPreflight] = React.useState<ListingPreflight | null>(null);
  const [preflightErr, setPreflightErr] = React.useState<unknown>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);
  const dismiss = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));

  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([cmListingsApi.list(), cmListingsApi.ready()])
      .then(([l, r]) => {
        setListings(l);
        setReady(r);
      })
      .catch((e) =>
        toast(
          "error",
          "Load failed",
          e instanceof Error ? e.message : undefined,
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);
  // T2-27 (CM-2): fetch the chosen hub's fabric stock so the picker can show availability live.
  const editorHub = editor?.hub_id;
  React.useEffect(() => {
    if (!editorHub) { setEditorStock(null); return; }
    let alive = true;
    fabricsApi.stock({ hub_id: editorHub }).then((rows) => { if (alive) setEditorStock(rows); }).catch(() => { if (alive) setEditorStock([]); });
    return () => { alive = false; };
  }, [editorHub]);
  React.useEffect(() => {
    designsApi
      .list({ status: "published" })
      .then(setDesigns)
      .catch(() => {});
    fabricsApi
      .list({ active: true })
      .then(setFabrics)
      .catch(() => {});
    hubsApi
      .list()
      .then((r) => setHubs(r.hubs))
      .catch(() => {});
  }, []);

  const openFromSample = (r: ReadyToListSample) =>
    setEditor({
      mode: "sample",
      sampleId: r.sample_id,
      design_id: r.design_id,
      fabric_id: r.fabric_id,
      hub_id: r.hub_id,
      label: `${r.design_name} · ${r.garment_type}`,
      fabricLabel: `${r.fabric_name} (${r.fabric_code})`,
      price: "",
      description: "",
      fitNotes: "",
      photos: r.sample_photos ?? [],
      isActive: true,
    });
  const openDirect = () =>
    setEditor({
      mode: "direct",
      design_id: "",
      fabric_id: "",
      hub_id: hubs[0]?.id ?? "",
      label: "",
      fabricLabel: "",
      price: "",
      description: "",
      fitNotes: "",
      photos: [],
      isActive: true,
    });
  const openEdit = (l: CmListing) =>
    setEditor({
      mode: "edit",
      listingId: l.id,
      design_id: l.design_id,
      fabric_id: l.fabric_id,
      hub_id: l.hub_id,
      label: `${l.design_name} · ${l.garment_type}`,
      fabricLabel: `${l.fabric_name} (${l.fabric_code})`,
      price: l.price ?? "",
      description: l.description ?? "",
      fitNotes: l.fit_notes ?? "",
      photos: l.photo_keys ?? [],
      isActive: l.is_active,
      pricePerMeter: l.price_per_meter,
      metersPerGarment: l.meters_per_garment,
      inStock: l.in_stock,
      fabricComposition: l.fabric_composition,
      fabricWeightGsm: l.fabric_weight_gsm,
      fabricWeave: l.fabric_weave,
      fabricCare: l.fabric_care,
    });
  // §6C: Duplicate — listings are variations; open a NEW listing (direct mode, editable
  // design/fabric/hub pickers) pre-filled from this one, starting as a draft to review.
  const openDuplicate = (l: CmListing) =>
    setEditor({
      mode: "direct",
      design_id: l.design_id,
      fabric_id: l.fabric_id,
      hub_id: l.hub_id,
      label: "",
      fabricLabel: "",
      price: l.price ?? "",
      description: l.description ?? "",
      fitNotes: l.fit_notes ?? "",
      photos: l.photo_keys ?? [],
      isActive: false,
      fabricComposition: l.fabric_composition,
      fabricWeightGsm: l.fabric_weight_gsm,
      fabricWeave: l.fabric_weave,
      fabricCare: l.fabric_care,
    });

  const onUpload = async (files: FileList | null) => {
    if (!files?.length || !editor) return;
    setUploading(true);
    try {
      const keys = await Promise.all(
        Array.from(files)
          .slice(0, 8)
          .map((f) => uploadToR2(f, "listings")),
      );
      setEditor({ ...editor, photos: [...editor.photos, ...keys] });
    } catch (e) {
      toast(
        "error",
        "Upload failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setUploading(false);
    }
  };

  const [showStockWarn, setShowStockWarn] = React.useState(false);
  // [CM-18-1] The create collided with a listing that already occupies this
  // design × fabric × hub. The backend now refuses instead of overwriting, so
  // the only thing left to get right is the way out: offer the existing row.
  const [clash, setClash] = React.useState<{ id: string; message: string } | null>(null);
  const [showBelowCostWarn, setShowBelowCostWarn] = React.useState(false);
  const [belowCostMsg, setBelowCostMsg] = React.useState("");
  const [pendingPublish, setPendingPublish] = React.useState(false);

  // Re-asked whenever the triple or the price changes — those are the only inputs the
  // answer depends on.
  const pfDesign = editor?.design_id ?? '';
  const pfFabric = editor?.fabric_id ?? '';
  const pfHub = editor?.hub_id ?? '';
  const pfPrice = editor?.price ?? '';
  React.useEffect(() => {
    if (!pfDesign || !pfFabric) { setPreflight(null); setPreflightErr(null); return; }
    let alive = true;
    setPreflightErr(null);
    cmListingsApi
      .preflight({
        design_id: pfDesign,
        fabric_id: pfFabric,
        hub_id: pfHub || undefined,
        price: Number(pfPrice) || undefined,
      })
      .then((r) => { if (alive) setPreflight(r); })
      // Kept, not discarded: a checklist that fails to load must say so rather than
      // silently showing nothing, which reads as "all clear".
      .catch((e) => { if (alive) { setPreflight(null); setPreflightErr(e); } });
    return () => { alive = false; };
  }, [pfDesign, pfFabric, pfHub, pfPrice]);

  const save = async (publish: boolean, publishAnyway = false, belowCostOk = false) => {
    if (!editor) return;
    if (
      editor.mode === "direct" &&
      (!editor.design_id || !editor.fabric_id || !editor.hub_id)
    ) {
      toast("error", "Pick design, fabric and hub");
      return;
    }
    if (!editor.price || Number(editor.price) <= 0) {
      toast("error", "Set a valid price");
      return;
    }
    if (editor.photos.length === 0) {
      toast("error", "Add at least one photo");
      return;
    }
    // G-25 (warn, never block — accept-all-orders model): publishing while the
    // hub holds no fabric means the storefront will show it out-of-stock.
    // T2-27 (CM-2): use the LIVE picker stock so the warn now fires for new listings too,
    // not just edit mode (falls back to the edit-mode server truth when stock isn't loaded).
    const liveInStock = stockFor(editor, editorStock, designs).inStock ?? editor.inStock;
    if (publish && liveInStock === false && !publishAnyway) {
      setShowStockWarn(true);
      return;
    }
    setSaving(true);
    const price = Number(editor.price);
    const description = editor.description.trim() || undefined;
    const fit_notes = editor.fitNotes.trim() || undefined;
    const is_active = publish;
    try {
      if (editor.mode === "sample" && editor.sampleId) {
        await cmListingsApi.fromSample(editor.sampleId, {
          price,
          photo_keys: editor.photos,
          description,
          fit_notes,
          is_active,
          allow_below_cost: belowCostOk,
        });
      } else if (editor.mode === "edit" && editor.listingId) {
        await cmListingsApi.update(editor.listingId, {
          price,
          photo_keys: editor.photos,
          description: description ?? null,
          fit_notes: fit_notes ?? null,
          is_active,
          allow_below_cost: belowCostOk,
        });
      } else {
        await cmListingsApi.create({
          design_id: editor.design_id,
          fabric_id: editor.fabric_id,
          hub_id: editor.hub_id,
          price,
          photo_keys: editor.photos,
          description,
          fit_notes,
          is_active,
          allow_below_cost: belowCostOk,
        });
      }
      toast("success", publish ? "Listing published" : "Saved as draft");
      setEditor(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      const { status, details } = (e ?? {}) as { status?: number; details?: unknown };
      const existingId = (details as { existing_listing_id?: string } | undefined)
        ?.existing_listing_id;
      if (msg?.includes("cost floor") && !belowCostOk) {
        // G-26: below the cost floor — let the CM confirm an intentional loss-leader.
        setPendingPublish(publish);
        setBelowCostMsg(msg);
        setShowBelowCostWarn(true);
      } else if (status === 409 && existingId) {
        // [CM-18-1] Not "Save failed". The CM asked for a listing on this
        // triple and one already exists — which is nearly always the Duplicate
        // button landing back on its own source. Name the collision and offer
        // the row, rather than making them find it in the grid by hand.
        setClash({ id: existingId, message: msg ?? "" });
      } else if (msg?.includes("reviewed sample")) {
        // D13: first listing of a design at a hub is gated on an approved sample.
        toast("error", "Sample review needed first", msg);
      } else {
        toast("error", "Save failed", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (l: CmListing, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cmListingsApi.update(l.id, { is_active: !l.is_active });
      setListings((xs) =>
        xs.map((x) => (x.id === l.id ? { ...x, is_active: !l.is_active } : x)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : undefined;
      toast(
        "error",
        msg?.includes("reviewed sample") ? "Sample review needed first" : "Update failed",
        msg,
      );
    }
  };

  // Deep-link from the Categories page: /admin/catalog/listings?garment=<garment type>.
  // Filters the listing grid to that garment type (the bridge between a merchandising
  // category and its dark-store listings). Matched on the garment-type name.
  const [searchParams, setSearchParams] = useSearchParams();
  const garmentFilter = searchParams.get("garment");
  // T2-27 (CM-1): tab-filter then garment-filter.
  const draftCount = listings.filter((l) => !l.is_active).length;
  const oosCount = listings.filter((l) => l.is_active && l.in_stock === false).length;
  const shownListings = React.useMemo(() => {
    let ls = listings;
    if (tab === "drafts") ls = ls.filter((l) => !l.is_active);
    else if (tab === "oos") ls = ls.filter((l) => l.is_active && l.in_stock === false);
    if (garmentFilter)
      ls = ls.filter((l) => (l.garment_type ?? "").toLowerCase() === garmentFilter.toLowerCase());
    return ls;
  }, [listings, tab, garmentFilter]);

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>Listings</h1>
        <Button variant="ghost" onClick={openDirect}>
          <UilPlus size={16} /> New listing
        </Button>
      </div>

      {/* T2-27 (CM-1): status tabs */}
      <div className={base.viewChips}>
        {([
          ["all", "All", listings.length],
          ["ready", "Ready", ready.length],
          ["drafts", "Drafts", draftCount],
          ["oos", "Out of stock", oosCount],
        ] as const).map(([k, label, n]) => (
          <button
            key={k}
            className={`${base.viewChip} ${tab === k ? base.viewChipActive : ""}`}
            onClick={() => setTab(k)}
          >
            {label} ({loading ? "…" : n})
          </button>
        ))}
      </div>

      {/* Ready tab — reviewed samples not yet listed */}
      {tab === "ready" && (
        <section className={s.readySection}>
          <p className={s.hint}>
            Reviewed samples not yet on the storefront. Set a price and publish.
          </p>
          {ready.length === 0 ? (
            <div className={s.empty}>Nothing waiting — every reviewed sample is listed.</div>
          ) : (
          <div className={s.readyGrid}>
            {ready.map((r) => {
              const img =
                url((r.sample_photos ?? [])[0]) ||
                url((r.fabric_image_keys ?? [])[0]);
              return (
                <div key={r.sample_id} className={s.readyCard}>
                  <div className={s.readyImg}>
                    {img ? (
                      <img src={img} alt={r.design_name} />
                    ) : (
                      <UilImage size={22} />
                    )}
                  </div>
                  <div className={s.readyBody}>
                    <div className={s.readyName}>{r.design_name}</div>
                    <div className={s.readyMeta}>
                      {r.fabric_name} ({r.fabric_code}) · {r.hub_name}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openFromSample(r)}
                  >
                    List it
                  </Button>
                </div>
              );
            })}
          </div>
          )}
        </section>
      )}

      {/* G-24: nudge — live listings whose fabric is short can't actually be bought. */}
      {tab !== "ready" && !loading &&
        (() => {
          const liveOOS = listings.filter(
            (l) => l.is_active && l.in_stock === false,
          ).length;
          return liveOOS > 0 && tab !== "oos" ? (
            <div className={s.oosStrip}>
              {liveOOS} live listing{liveOOS === 1 ? "" : "s"} out of stock —
              the fabric is short at the hub, so customers can't buy.{" "}
              <Link className={s.oosLink} to="/admin/catalog/restock">Request restock →</Link>
            </div>
          ) : null;
        })()}
      {tab !== "ready" && (
      <>
      <h2 className={s.sectionTitle}>
        {tab === "drafts" ? "Drafts" : tab === "oos" ? "Out of stock" : "Your listings"}{" "}
        {!loading && <span className={s.count}>{shownListings.length}</span>}
        {garmentFilter && (
          <button
            type="button"
            className={s.filterChip}
            onClick={() => setSearchParams({})}
            title="Clear filter"
          >
            {garmentFilter} <UilTimes size={13} />
          </button>
        )}
      </h2>
      {loading ? (
        <div className={s.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${s.card} ${s.skeleton}`} />
          ))}
        </div>
      ) : shownListings.length === 0 ? (
        <div className={s.empty}>
          {tab === "drafts"
            ? "No drafts — every listing is published."
            : tab === "oos"
              ? "No out-of-stock listings — every live listing has fabric at its hub."
              : garmentFilter
                ? `No ${garmentFilter} listings yet. List one from the Ready tab, or add one directly.`
                : "No listings yet. List a reviewed sample from the Ready tab, or add one directly."}
        </div>
      ) : (
        <div className={s.grid}>
          {shownListings.map((l) => {
            const img =
              url((l.photo_keys ?? [])[0]) ||
              url((l.fabric_image_keys ?? [])[0]);
            return (
              <div key={l.id} className={s.card} onClick={() => openEdit(l)}>
                <div className={s.cardImg}>
                  {img ? (
                    <img src={img} alt={l.design_name} />
                  ) : (
                    <UilImage size={26} />
                  )}
                </div>
                <div className={s.cardBody}>
                  <div className={s.cardName}>{l.design_name}</div>
                  <div className={s.cardMeta}>
                    {l.fabric_name} · {l.garment_type}
                  </div>
                  {/* G-24: per-fabric shared stock at this hub (derived server-side). */}
                  {l.in_stock === false ? (
                    <div className={s.stockOut}>● Out of stock — fabric short at hub</div>
                  ) : l.in_stock === true ? (
                    (() => {
                      // [CM-18-4] Garments first — that is the unit this person sells in.
                      // The metres stay, in brackets, because the restock conversation is
                      // held in metres.
                      const left = l.garments_available ?? null;
                      const low = left != null && left < LOW_GARMENTS;
                      return (
                        <div className={low ? s.stockLow : s.stockOk}>
                          ● {low ? "Running low" : "In stock"}
                          {left != null
                            ? ` · ~${left} garment${left === 1 ? "" : "s"}`
                            : ""}
                          {l.available_meters != null
                            ? ` (${Number(l.available_meters)}m)`
                            : ""}
                        </div>
                      );
                    })()
                  ) : null}
                  {/* G-26: margin vs the cost floor (fabric + make + overhead) */}
                  {(() => {
                    const floor = costFloor(l.price_per_meter, l.meters_per_garment, money.make, money.overhead);
                    if (floor == null) return null;
                    const m = marginPct(Number(l.price), floor);
                    const cls = Number(l.price) < floor ? s.marginBad : m < 25 ? s.marginThin : s.marginOk;
                    return (
                      <div className={cls} title={`Cost floor ≈ ₹${floor} (fabric + make ₹${money.make} + overhead ₹${money.overhead})`}>
                        {Number(l.price) < floor ? `▼ priced ₹${floor - Number(l.price)} below cost` : `margin ${m}%`}
                      </div>
                    );
                  })()}
                  {/* T1-16: sales signal so the hub merchant doesn't merchandise blind */}
                  {(l.units_sold ?? 0) > 0 ? (
                    <div className={s.salesLine}>
                      {l.units_sold} sold
                      {(l.units_delivered ?? 0) !== (l.units_sold ?? 0)
                        ? ` · ${l.units_delivered ?? 0} delivered`
                        : ""}
                      {l.last_ordered_at
                        ? ` · last ${new Date(l.last_ordered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                        : ""}
                    </div>
                  ) : (
                    <div className={s.salesNone}>No orders yet</div>
                  )}
                  <div className={s.cardFoot}>
                    <span className={s.price}>
                      ₹{Number(l.price).toLocaleString("en-IN")}
                    </span>
                    {/* [CM-18-10] The two facts an operator needs before clicking a copy
                        icon next to a LIVE price: it opens a DRAFT (nothing goes live, and
                        nothing is written until you save), and the fabric is the field you
                        are meant to change — a duplicate that keeps the same design AND
                        fabric is just a second listing of the same thing. "Duplicate as a
                        new listing (variation)" said neither. */}
                    <button
                      className={s.dupBtn}
                      title="Duplicate as draft — change the fabric to make a variation. Nothing is saved until you do."
                      aria-label="Duplicate this listing as a draft"
                      onClick={(e) => { e.stopPropagation(); openDuplicate(l); }}
                    >
                      <UilCopy size={14} />
                    </button>
                    <span className={s.toggleWrap} onClick={(e) => toggleActive(l, e)}>
                      <StatusBadge status={l.is_active ? "live" : "draft"} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={
          editor?.mode === "edit"
            ? "Edit listing"
            : editor?.mode === "sample"
              ? "List this sample"
              : "New listing"
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              state={saving ? "loading" : "default"}
              onClick={() => save(false)}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              state={saving ? "loading" : "default"}
              onClick={() => save(true)}
            >
              Publish
            </Button>
          </>
        }
      >
        {editor && (
          <div className={s.form}>
            {/* [CM-18-5] The whole answer, before Publish is pressed. Each row states its
                own verdict, so a draft blocked by two gates shows two crosses instead of
                revealing the second only after the first is fixed. */}
            {(preflight != null || preflightErr != null) && (
              <div className={s.preflight}>
                <div className={s.preflightHead}>Before this can go live</div>
                {preflightErr ? (
                  <div className={s.preflightFail}>
                    ✕ Couldn&apos;t check the publish gates — Publish will still tell you, one at a time.
                  </div>
                ) : (
                  <>
                    {([
                      ['Reviewed sample at this hub', preflight!.sample.ok, preflight!.sample.detail, true],
                      ['Design passed sew-validation', preflight!.sew_validated.ok, preflight!.sew_validated.detail, true],
                      ['Price at or above the cost floor', preflight!.price.ok, preflight!.price.detail, false],
                      ['Fabric at this hub', preflight!.stock.ok, preflight!.stock.detail, false],
                      // The photo rule is the editor's own — it never needed a round trip.
                      ['At least one photo', editor.photos.length > 0,
                        editor.photos.length > 0
                          ? `${editor.photos.length} attached.`
                          : 'A listing needs at least one photograph.', false],
                    ] as [string, boolean, string, boolean][]).map(([label, ok, detail, hard]) => (
                      <div key={label} className={ok ? s.preflightOk : hard ? s.preflightFail : s.preflightWarn}>
                        {ok ? '✓' : hard ? '✕' : '⚠'} {label}
                        <span className={s.preflightDetail}>{detail}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            {editor.mode === "direct" ? (
              <>
                <label className={s.field}>
                  Design
                  <select
                    value={editor.design_id}
                    onChange={(e) =>
                      setEditor({ ...editor, design_id: e.target.value })
                    }
                  >
                    <option value="">Select a published design…</option>
                    {designs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.garment_type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={s.field}>
                  Fabric
                  <select
                    value={editor.fabric_id}
                    onChange={(e) =>
                      setEditor({ ...editor, fabric_id: e.target.value })
                    }
                  >
                    <option value="">Select…</option>
                    {fabrics.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={s.field}>
                  Hub
                  <select
                    value={editor.hub_id}
                    onChange={(e) =>
                      setEditor({ ...editor, hub_id: e.target.value })
                    }
                  >
                    <option value="">Select…</option>
                    {hubs.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <div className={s.combo}>
                <strong>{editor.label}</strong>
                <span>{editor.fabricLabel}</span>
              </div>
            )}

            {/* T2-27 (CM-2): live hub stock for the chosen fabric — shown BEFORE price/publish. */}
            {editor.fabric_id && editor.hub_id && (() => {
              const st = stockFor(editor, editorStock, designs);
              if (editorStock === null) return <div className={s.floorLine}>Checking hub stock…</div>;
              if (st.available == null)
                return <div className={s.floorWarn}>● No stock at this hub for this fabric{st.mpg != null ? ` · needs ${st.mpg}m/garment` : ""}. It'll publish out-of-stock.</div>;
              return (
                <div className={st.inStock === false ? s.floorWarn : s.floorLine}>
                  {st.inStock === false ? "● Out of stock at this hub" : "● In stock"} · {st.available}m available{st.mpg != null ? ` · needs ${st.mpg}m/garment` : ""}
                </div>
              );
            })()}

            <div className={s.photos}>
              <span className={s.photosLabel}>
                Photos <span className={s.req}>· what the customer sees</span>
              </span>
              {/* T3-6 (W-C3): photo standards so listing quality doesn't vary by CM. */}
              <p className={s.photoHint}>
                Aim for <strong>2+</strong>: a full-length front shot and a fabric/detail close-up.
                Plain light background, portrait 3:4, garment fills the frame.
              </p>
              {editor.photos.length === 1 && (
                <p className={s.photoNudge}>Add one more — a single photo undersells the garment.</p>
              )}
              <div className={s.thumbs}>
                {editor.photos.map((k, i) => (
                  <div key={k} className={s.thumb}>
                    <img src={url(k)} alt={`photo ${i + 1}`} />
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          ...editor,
                          photos: editor.photos.filter((x) => x !== k),
                        })
                      }
                    >
                      <UilTimes size={12} />
                    </button>
                  </div>
                ))}
                <label className={s.uploadBox}>
                  {uploading ? (
                    <Spinner />
                  ) : (
                    <>
                      <UilImagePlus size={20} />
                      <span>Add</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => onUpload(e.target.files)}
                  />
                </label>
              </div>
            </div>

            <div className={s.row2}>
              <Input
                label="Price (₹) *"
                type="number"
                value={editor.price}
                onChange={(v) => setEditor({ ...editor, price: v })}
                placeholder="1499"
              />
            </div>
            {/* G-26: the cost floor, live under the price field */}
            {(() => {
              const fabric = editor.mode === "direct"
                ? fabrics.find((f) => f.id === editor.fabric_id)
                : null;
              const design = editor.mode === "direct"
                ? designs.find((d) => d.id === editor.design_id)
                : null;
              const floor = costFloor(
                editor.pricePerMeter ?? fabric?.price_per_meter,
                editor.metersPerGarment ?? design?.meters_per_garment,
                money.make,
                money.overhead,
              );
              if (floor == null) return null;
              const price = Number(editor.price);
              const below = Number.isFinite(price) && price > 0 && price < floor;
              const m = Number.isFinite(price) && price > 0 ? marginPct(price, floor) : null;
              return (
                <div className={below ? s.floorWarn : s.floorLine}>
                  Cost ≈ ₹{floor} (fabric + make ₹{money.make} + overhead ₹{money.overhead})
                  {m != null && ` — margin ${m}%`}
                  {below && " — PRICED BELOW COST"}
                </div>
              );
            })()}
            {editor.mode === "direct" && (
              <div className={s.gateHint}>
                A design's first listing at a hub needs a reviewed sample before it
                can go live (drafts are fine) — request one from the design console.
              </div>
            )}
            {/* T3-6 (W-C2): the PDP content model. The CM writes the story + fit; the fabric
                facts below auto-assemble from the paired fabric — no re-typing specs. */}
            <Textarea
              label="Description / product story (optional)"
              value={editor.description}
              onChange={(v) => setEditor({ ...editor, description: v })}
              placeholder="A paragraph on the look, occasion and why it's worth buying."
              rows={4}
            />
            <Textarea
              label="Fit notes (optional)"
              value={editor.fitNotes}
              onChange={(v) => setEditor({ ...editor, fitNotes: v })}
              placeholder="e.g. Regular fit through the chest; size up if between sizes."
              rows={3}
            />
            {(editor.fabricComposition || editor.fabricCare?.length || editor.fabricWeightGsm || editor.fabricWeave) && (
              <div className={s.autoFacts}>
                <div className={s.autoFactsHead}>Auto-included on the PDP (from the fabric)</div>
                <dl className={s.autoFactsList}>
                  {editor.fabricComposition && (
                    <div><dt>Composition</dt><dd>{editor.fabricComposition}</dd></div>
                  )}
                  {editor.fabricWeave && <div><dt>Weave</dt><dd>{editor.fabricWeave}</dd></div>}
                  {editor.fabricWeightGsm != null && (
                    <div><dt>Weight</dt><dd>{editor.fabricWeightGsm} gsm</dd></div>
                  )}
                  {editor.fabricCare && editor.fabricCare.length > 0 && (
                    <div><dt>Care</dt><dd>{editor.fabricCare.join(" · ")}</dd></div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* G-25: publishing with no fabric at the hub — warn, never block */}
      <ConfirmDialog
        open={showStockWarn}
        title="Publish without stock?"
        message="This hub holds no fabric for this listing — it will publish but show out-of-stock to customers until a restock lands. Request a restock first, or publish anyway."
        confirmLabel="Publish anyway"
        loading={saving}
        onConfirm={() => { setShowStockWarn(false); save(true, true); }}
        onCancel={() => setShowStockWarn(false)}
      />

      {/* [CM-18-1] The triple is taken. Creating used to silently overwrite the
          row that held it; now it refuses, and this is the way through. */}
      <ConfirmDialog
        open={clash !== null}
        title="Already listed"
        message={`${clash?.message || "This design is already listed on this fabric at this hub."} Nothing has been changed.`}
        confirmLabel="Open the existing listing"
        onConfirm={() => {
          const id = clash?.id;
          setClash(null);
          const found = listings.find((l) => l.id === id);
          if (found) {
            openEdit(found);
          } else {
            // Not in the current page/filter — say so rather than doing nothing.
            setEditor(null);
            toast("info", "Listing is outside the current filters", "Clear the filters to find it.");
          }
        }}
        onCancel={() => setClash(null)}
      />

      {/* G-26: price below the cost floor — confirm an intentional loss-leader */}
      <ConfirmDialog
        open={showBelowCostWarn}
        title="Sell below cost?"
        message={`${belowCostMsg || "This price is below the cost floor."} You'll lose margin on every sale — confirm only for a deliberate loss-leader or clearance.`}
        confirmLabel="Sell below cost"
        variant="danger"
        loading={saving}
        onConfirm={() => { setShowBelowCostWarn(false); save(pendingPublish, true, true); }}
        onCancel={() => setShowBelowCostWarn(false)}
      />
    </div>
  );
};

export default ListingsManagePage;
