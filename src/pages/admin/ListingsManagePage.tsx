import React from "react";
import {
  cmListingsApi,
  designsApi,
  fabricsApi,
  hubsApi,
  uploadToR2,
  R2_PUBLIC_URL,
} from "../../api/adminApi";
import type {
  CmListing,
  ReadyToListSample,
  DesignSummary,
  Fabric,
  Hub,
} from "../../api/adminApi";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
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
} from "@iconscout/react-unicons";

const url = (k?: string) => (k && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${k}` : "");

// G-26 cost floor: fabric + make + per-order overhead (FABLE-SOLUTIONS P2 model).
// MAKE/OVERHEAD become AppConfig values later; one place to change until then.
const MAKE_COST = 180;
const OVERHEAD = 250;
const costFloor = (
  pricePerMeter: string | number | null | undefined,
  metersPerGarment: string | number | null | undefined,
): number | null => {
  const ppm = pricePerMeter == null ? NaN : Number(pricePerMeter);
  const mpg = metersPerGarment == null ? NaN : Number(metersPerGarment);
  if (!Number.isFinite(ppm) || !Number.isFinite(mpg)) return null;
  return Math.round(ppm * mpg + MAKE_COST + OVERHEAD);
};
const marginPct = (price: number, floor: number) => Math.round(((price - floor) / price) * 100);

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
  photos: string[];
  isActive: boolean;
  /** G-26: cost-floor inputs when known (edit mode from the listing row) */
  pricePerMeter?: string | number | null;
  metersPerGarment?: string | number | null;
  /** G-25: current stock truth when known (edit mode) */
  inStock?: boolean;
};

export const ListingsManagePage: React.FC = () => {
  const [listings, setListings] = React.useState<CmListing[]>([]);
  const [ready, setReady] = React.useState<ReadyToListSample[]>([]);
  const [designs, setDesigns] = React.useState<DesignSummary[]>([]);
  const [fabrics, setFabrics] = React.useState<Fabric[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editor, setEditor] = React.useState<Editor | null>(null);
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
      photos: l.photo_keys ?? [],
      isActive: l.is_active,
      pricePerMeter: l.price_per_meter,
      metersPerGarment: l.meters_per_garment,
      inStock: l.in_stock,
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

  const save = async (publish: boolean, publishAnyway = false) => {
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
    if (publish && editor.inStock === false && !publishAnyway) {
      setShowStockWarn(true);
      return;
    }
    setSaving(true);
    const price = Number(editor.price);
    const description = editor.description.trim() || undefined;
    const is_active = publish;
    try {
      if (editor.mode === "sample" && editor.sampleId) {
        await cmListingsApi.fromSample(editor.sampleId, {
          price,
          photo_keys: editor.photos,
          description,
          is_active,
        });
      } else if (editor.mode === "edit" && editor.listingId) {
        await cmListingsApi.update(editor.listingId, {
          price,
          photo_keys: editor.photos,
          description: description ?? null,
          is_active,
        });
      } else {
        await cmListingsApi.create({
          design_id: editor.design_id,
          fabric_id: editor.fabric_id,
          hub_id: editor.hub_id,
          price,
          photo_keys: editor.photos,
          description,
          is_active,
        });
      }
      toast("success", publish ? "Listing published" : "Saved as draft");
      setEditor(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      if (msg?.includes("reviewed sample")) {
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

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>Listings</h1>
        <Button variant="ghost" onClick={openDirect}>
          <UilPlus size={16} /> New listing
        </Button>
      </div>

      {/* Ready to list */}
      {ready.length > 0 && (
        <section className={s.readySection}>
          <h2 className={s.sectionTitle}>
            Ready to list <span className={s.count}>{ready.length}</span>
          </h2>
          <p className={s.hint}>
            Reviewed samples not yet on the storefront. Set a price and publish.
          </p>
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
        </section>
      )}

      {/* G-24: nudge — live listings whose fabric is short can't actually be bought. */}
      {!loading &&
        (() => {
          const liveOOS = listings.filter(
            (l) => l.is_active && l.in_stock === false,
          ).length;
          return liveOOS > 0 ? (
            <div className={s.oosStrip}>
              {liveOOS} live listing{liveOOS === 1 ? "" : "s"} out of stock —
              the fabric is short at the hub, so customers can't buy.{" "}
              <a className={s.oosLink} href="/admin/catalog/restock">Request restock →</a>
            </div>
          ) : null;
        })()}
      <h2 className={s.sectionTitle}>
        Your listings{" "}
        {!loading && <span className={s.count}>{listings.length}</span>}
      </h2>
      {loading ? (
        <div className={s.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${s.card} ${s.skeleton}`} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className={s.empty}>
          No listings yet. List a reviewed sample above, or add one directly.
        </div>
      ) : (
        <div className={s.grid}>
          {listings.map((l) => {
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
                    <div className={s.stockOk}>
                      ● In stock
                      {l.available_meters != null
                        ? ` · ${Number(l.available_meters)}m`
                        : ""}
                    </div>
                  ) : null}
                  {/* G-26: margin vs the cost floor (fabric + make + overhead) */}
                  {(() => {
                    const floor = costFloor(l.price_per_meter, l.meters_per_garment);
                    if (floor == null) return null;
                    const m = marginPct(Number(l.price), floor);
                    const cls = Number(l.price) < floor ? s.marginBad : m < 25 ? s.marginThin : s.marginOk;
                    return (
                      <div className={cls} title={`Cost floor ≈ ₹${floor} (fabric + make ₹${MAKE_COST} + overhead ₹${OVERHEAD})`}>
                        {Number(l.price) < floor ? `▼ priced ₹${floor - Number(l.price)} below cost` : `margin ${m}%`}
                      </div>
                    );
                  })()}
                  <div className={s.cardFoot}>
                    <span className={s.price}>
                      ₹{Number(l.price).toLocaleString("en-IN")}
                    </span>
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

            <div className={s.photos}>
              <span className={s.photosLabel}>
                Photos <span className={s.req}>· what the customer sees</span>
              </span>
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
              );
              if (floor == null) return null;
              const price = Number(editor.price);
              const below = Number.isFinite(price) && price > 0 && price < floor;
              const m = Number.isFinite(price) && price > 0 ? marginPct(price, floor) : null;
              return (
                <div className={below ? s.floorWarn : s.floorLine}>
                  Cost ≈ ₹{floor} (fabric + make ₹{MAKE_COST} + overhead ₹{OVERHEAD})
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
            <Input
              label="Description (optional)"
              value={editor.description}
              onChange={(v) => setEditor({ ...editor, description: v })}
              placeholder="Short selling line"
            />
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
    </div>
  );
};

export default ListingsManagePage;
