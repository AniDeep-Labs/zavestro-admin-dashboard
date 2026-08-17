import React from "react";
import { Link } from "react-router-dom";
import {
  categoriesAdminApi,
  designsApi,
  uploadToR2,
  R2_PUBLIC_URL,
} from "../../api/adminApi";
import type { ProductCategory, GarmentCategoryOption } from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { Can } from "../../components/Can/Can";
import { Modal } from "../../components/Modal/Modal";
import { Spinner } from "../../components/Spinner";
import styles from "./AppConfigPage.module.css";
import catCss from "./CategoriesPage.module.css";
import {
  UilTimes,
  UilUpload,
  UilPlus,
  UilEditAlt,
  UilArchive,
  UilRedo,
  UilArrowUp,
  UilArrowDown,
  UilImagePlus,
} from "@iconscout/react-unicons";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

type EditState = {
  id?: string; // undefined = create
  parentId: string | null; // null = main category
  name: string;
  slug: string;
  gender: "" | "men" | "women" | "unisex";
  garmentCategoryId: string; // "" = no fit-engine link (size chart)
  imageUrl: string; // preview (current or freshly uploaded)
  pendingImageKey: string | null; // newly uploaded key to apply on save; null = unchanged
  slugTouched: boolean;
} | null;

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [garmentCats, setGarmentCats] = React.useState<GarmentCategoryOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState<string | null>(null); // row id uploading
  const [busy, setBusy] = React.useState(false); // reorder/save guard
  const [edit, setEdit] = React.useState<EditState>(null);
  const [modalUploading, setModalUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    categoriesAdminApi
      .list()
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load categories"))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(load, [load]);

  // Garment types power the optional "size chart" link. A failure here is non-fatal
  // (the dropdown just stays empty) — categories still load and save.
  React.useEffect(() => {
    designsApi.garmentCategories().then(setGarmentCats).catch(() => setGarmentCats([]));
  }, []);
  const garmentName = (id: string | null | undefined) =>
    id ? (garmentCats.find((g) => g.id === id)?.name ?? null) : null;

  // ── derived tree ──
  const mains = React.useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [categories],
  );
  const childrenOf = (id: string) =>
    categories
      .filter((c) => c.parent_id === id)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const mainName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "";

  // ── row image upload (quick replace from the row) ──
  const rowUpload = async (cat: ProductCategory, file: File) => {
    setUploading(cat.id);
    try {
      const key = await uploadToR2(file, "categories");
      const updated = await categoriesAdminApi.updateImage(cat.id, key);
      setCategories((p) => p.map((c) => (c.id === cat.id ? updated : c)));
      showToast("success", `Image set for ${cat.name}`);
    } catch (e) {
      showToast("error", "Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(null);
    }
  };
  const rowRemoveImage = async (cat: ProductCategory) => {
    setUploading(cat.id);
    try {
      const updated = await categoriesAdminApi.updateImage(cat.id, null);
      setCategories((p) => p.map((c) => (c.id === cat.id ? updated : c)));
      showToast("success", `Image removed from ${cat.name}`);
    } catch (e) {
      showToast("error", "Remove failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(null);
    }
  };

  // ── create / edit ──
  const openCreate = (parentId: string | null) =>
    setEdit({ parentId, name: "", slug: "", gender: "", garmentCategoryId: "", imageUrl: "", pendingImageKey: null, slugTouched: false });
  const openEdit = (c: ProductCategory) =>
    setEdit({
      id: c.id,
      parentId: c.parent_id ?? null,
      name: c.name,
      slug: c.slug,
      gender: (c.gender as "men" | "women" | "unisex" | null) ?? "",
      garmentCategoryId: c.garment_category_id ?? "",
      imageUrl: c.image_url ?? "",
      pendingImageKey: null,
      slugTouched: true,
    });

  const onModalUpload = async (file: File) => {
    if (!edit) return;
    setModalUploading(true);
    try {
      const key = await uploadToR2(file, "categories");
      setEdit({ ...edit, pendingImageKey: key, imageUrl: R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key });
    } catch (e) {
      showToast("error", "Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setModalUploading(false);
    }
  };

  const nextOrder = (parentId: string | null) => {
    const sibs = parentId ? childrenOf(parentId) : mains;
    return (sibs.reduce((m, c) => Math.max(m, c.display_order ?? 0), 0) || 0) + 10;
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.slug.trim()) {
      showToast("error", "Name and slug are required");
      return;
    }
    // Per the brief, a NEW category needs a cover icon.
    if (!edit.id && !edit.pendingImageKey) {
      showToast("error", "Add a cover image for the category");
      return;
    }
    setSaving(true);
    try {
      if (edit.id) {
        const updated = await categoriesAdminApi.update(edit.id, {
          name: edit.name.trim(),
          slug: edit.slug.trim(),
          gender: edit.gender || undefined,
          parent_id: edit.parentId,
          garment_category_id: edit.garmentCategoryId || null, // "" → null unlinks the size chart
        });
        let merged = updated;
        if (edit.pendingImageKey) {
          merged = await categoriesAdminApi.updateImage(edit.id, edit.pendingImageKey);
        }
        setCategories((p) => p.map((c) => (c.id === edit.id ? merged : c)));
        showToast("success", "Category updated");
      } else {
        const created = await categoriesAdminApi.create({
          name: edit.name.trim(),
          slug: edit.slug.trim(),
          gender: edit.gender || undefined,
          parent_id: edit.parentId ?? undefined,
          garment_category_id: edit.garmentCategoryId || undefined,
          image_key: edit.pendingImageKey ?? undefined,
          display_order: nextOrder(edit.parentId),
        });
        setCategories((p) => [...p, created]);
        showToast("success", "Category created");
      }
      setEdit(null);
    } catch (e) {
      showToast("error", edit.id ? "Update failed" : "Create failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (cat: ProductCategory) => {
    try {
      const updated = await categoriesAdminApi.update(cat.id, { is_active: !cat.is_active });
      setCategories((p) => p.map((c) => (c.id === cat.id ? updated : c)));
      showToast("success", updated.is_active ? `${updated.name} restored` : `${updated.name} archived`);
    } catch (e) {
      showToast("error", "Update failed", e instanceof Error ? e.message : undefined);
    }
  };

  // T3-6 (§5.3): move within the sibling group and persist ATOMICALLY. The old code fired
  // two independent PATCHes to swap display_order — if one failed the order corrupted. Now
  // we send the whole reordered sibling-id list to one transactional endpoint and adopt its
  // authoritative result.
  const move = async (cat: ProductCategory, dir: -1 | 1) => {
    if (busy) return;
    const sibs = cat.parent_id ? childrenOf(cat.parent_id) : mains;
    const idx = sibs.findIndex((c) => c.id === cat.id);
    const j = idx + dir;
    if (j < 0 || j >= sibs.length) return;
    const reordered = [...sibs];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    setBusy(true);
    try {
      const fresh = await categoriesAdminApi.reorder(reordered.map((c) => c.id));
      setCategories(fresh);
    } catch (e) {
      showToast("error", "Reorder failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  // ── a single category row (used for mains + subs) ──
  const Row = ({ cat, isSub, idx, count }: { cat: ProductCategory; isSub: boolean; idx: number; count: number }) => {
    const fileRef = React.createRef<HTMLInputElement>();
    const isUploading = uploading === cat.id;
    return (
      <div
        className={`${styles.card} ${isSub ? catCss.subCard : ""}`}
        style={{ opacity: cat.is_active ? 1 : 0.55 }}
      >
        <div className={catCss.cardInner}>
          <div className={catCss.reorder}>
            <button className={catCss.iconBtn} aria-label="Move up" disabled={busy || idx === 0} onClick={() => move(cat, -1)}><UilArrowUp size={12} /></button>
            <button className={catCss.iconBtn} aria-label="Move down" disabled={busy || idx === count - 1} onClick={() => move(cat, 1)}><UilArrowDown size={12} /></button>
          </div>
          {/* [KA11-4] "No image", not "No img" — one spelling. 18 distinct
              empty-state phrasings were measured across 42 routes; this is the
              first act of collapsing them onto one component. */}
          <div className={catCss.thumb}>
            {cat.image_url ? (
              <img src={cat.image_url} alt={cat.name} className={catCss.thumbImg} />
            ) : (
              <span className={catCss.noImg}>No image</span>
            )}
          </div>
          <div className={catCss.info}>
            <div className={catCss.nameRow}>
              <span className={catCss.name}>{cat.name}</span>
              <span className={catCss.slug}>{cat.slug}</span>
              {!cat.is_active && <span className={catCss.inactiveChip}>Archived</span>}
            </div>
            <span className={catCss.count}>
              {cat.product_count ?? 0} listing{(cat.product_count ?? 0) === 1 ? "" : "s"}
              {garmentName(cat.garment_category_id) && (
                <Link
                  className={catCss.countLink}
                  to={`/admin/catalog/listings?garment=${encodeURIComponent(garmentName(cat.garment_category_id)!)}`}
                >
                  · View in Listings
                </Link>
              )}
            </span>
            {garmentName(cat.garment_category_id) ? (
              <span className={catCss.sizeChip} title="Products inherit this size chart">
                📐 {garmentName(cat.garment_category_id)}
              </span>
            ) : (
              <span className={catCss.sizeChipMuted} title="Products in this category have no size guide">
                No size chart
              </span>
            )}
          </div>
          <Can cap="catalog:write">
            <div className={catCss.actions}>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className={catCss.hidden}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) rowUpload(cat, f); e.target.value = ""; }} />
              <button className={`${styles.addBtn} ${catCss.smallBtn}`} disabled={isUploading} onClick={() => fileRef.current?.click()}>
                <UilUpload size={13} />{isUploading ? "…" : cat.image_url ? "Replace" : "Image"}
              </button>
              {cat.image_url && (
                <button className={`${styles.exportBtn} ${catCss.smallBtn}`} disabled={isUploading} onClick={() => rowRemoveImage(cat)}>
                  <UilTimes size={13} />
                </button>
              )}
              {!isSub && (
                <button className={catCss.ghostBtn} onClick={() => openCreate(cat.id)}>
                  <UilPlus size={13} /> Sub
                </button>
              )}
              <button className={catCss.ghostBtn} onClick={() => openEdit(cat)}><UilEditAlt size={13} /> Edit</button>
              <button className={catCss.ghostBtn} onClick={() => toggleArchive(cat)}>
                {cat.is_active ? <><UilArchive size={13} /> Archive</> : <><UilRedo size={13} /> Restore</>}
              </button>
            </div>
          </Can>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className={catCss.topBar}>
        <div>
          <h1 className={styles.title}>Categories</h1>
          <p className={catCss.intro}>
            Main categories &amp; their sub-categories, each with a cover icon. Shown in the
            customer app’s “Shop by Category” (drag order = display order).
          </p>
        </div>
        <Can cap="catalog:write">
          <button className={styles.addBtn} onClick={() => openCreate(null)}>
            <UilPlus size={14} /> Add main category
          </button>
        </Can>
      </div>

      {loading ? (
        <div className={`${styles.card} ${catCss.loading}`}>Loading…</div>
      ) : error ? (
        <div className={`${styles.card} ${catCss.errorBox}`}>
          <span>Couldn’t load categories — {error}</span>
          <button className={catCss.ghostBtn} onClick={load}><UilRedo size={13} /> Retry</button>
        </div>
      ) : mains.length === 0 ? (
        <div className={`${styles.card} ${catCss.emptyBox}`}>
          <span className={catCss.emptyTitle}>No categories yet</span>
          <span className={catCss.emptySub}>Add a main category (e.g. Men, Women) — then add sub-categories like Kurta or Saree under it.</span>
          <Can cap="catalog:write">
            <button className={styles.addBtn} onClick={() => openCreate(null)}><UilPlus size={14} /> Add your first category</button>
          </Can>
        </div>
      ) : (
        <div className={catCss.tree}>
          {mains.map((main, mi) => {
            const subs = childrenOf(main.id);
            return (
              <div key={main.id} className={catCss.group}>
                <Row cat={main} isSub={false} idx={mi} count={mains.length} />
                {subs.length > 0 ? (
                  <div className={catCss.subList}>
                    {subs.map((sub, si) => (
                      <Row key={sub.id} cat={sub} isSub idx={si} count={subs.length} />
                    ))}
                  </div>
                ) : (
                  <Can cap="catalog:write">
                    <div className={catCss.noSubs}>No sub-categories — use “+ Sub” above to add one.</div>
                  </Can>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={
          edit?.id
            ? "Edit category"
            : edit?.parentId
              ? `Add sub-category under ${mainName(edit.parentId)}`
              : "Add main category"
        }
        size="sm"
        footer={
          <div className={catCss.modalActions}>
            <button className={catCss.ghostBtn} onClick={() => setEdit(null)}>Cancel</button>
            <button className={styles.addBtn} disabled={saving} onClick={saveEdit}>
              {saving ? "Saving…" : edit?.id ? "Save changes" : "Create"}
            </button>
          </div>
        }
      >
        {edit && (
          <div className={catCss.form}>
            <div className={catCss.flbl}>
              Cover icon
              <div className={catCss.imgPick}>
                <div className={catCss.imgPreview}>
                  {modalUploading ? <Spinner /> : edit.imageUrl ? <img src={edit.imageUrl} alt="" /> : "No icon"}
                </div>
                <label className={catCss.ghostBtn}>
                  <UilImagePlus size={14} /> {edit.imageUrl ? "Replace" : "Upload"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className={catCss.hidden}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onModalUpload(f); e.target.value = ""; }} />
                </label>
              </div>
              {!edit.id && <span className={catCss.fhint}>Required for a new category.</span>}
            </div>
            <label className={catCss.flbl}>
              Name
              <input className={catCss.finp} value={edit.name} placeholder="e.g. Kurta"
                onChange={(e) => setEdit({ ...edit, name: e.target.value, slug: edit.slugTouched ? edit.slug : slugify(e.target.value) })} />
            </label>
            <label className={catCss.flbl}>
              Slug
              <input className={catCss.finp} value={edit.slug} placeholder="kurta"
                onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value), slugTouched: true })} />
              <span className={catCss.fhint}>Lowercase, hyphenated. Used in the storefront URL.</span>
            </label>
            <label className={catCss.flbl}>
              Gender
              <select className={catCss.finp} value={edit.gender}
                onChange={(e) => setEdit({ ...edit, gender: e.target.value as "" | "men" | "women" | "unisex" })}>
                <option value="">—</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="unisex">Unisex</option>
              </select>
            </label>
            <label className={catCss.flbl}>
              Size chart (garment type)
              <select className={catCss.finp} value={edit.garmentCategoryId}
                onChange={(e) => setEdit({ ...edit, garmentCategoryId: e.target.value })}>
                <option value="">— No size chart —</option>
                {garmentCats.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <span className={catCss.fhint}>
                Links this category to a fit-engine garment type. Its products inherit that
                size chart on the storefront. Optional, but products have no size guide without it.
              </span>
            </label>
            {/* Re-parent only in edit mode (create uses the chosen parent). */}
            {edit.id && (
              <label className={catCss.flbl}>
                Parent
                <select className={catCss.finp} value={edit.parentId ?? ""}
                  onChange={(e) => setEdit({ ...edit, parentId: e.target.value || null })}>
                  <option value="">— Main category (no parent) —</option>
                  {mains.filter((m) => m.id !== edit.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CategoriesPage;
