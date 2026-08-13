import React from 'react';
import { ordersApi, tagsApi } from '../../api/adminApi';
import type { AdminOrder, GarmentTag } from '../../api/adminApi';
import styles from './GarmentTagsPage.module.css';

/**
 * AG-S3 (scan) — print garment tags.
 *
 * The ops app had no scanner, and I declined to build one while nothing printed
 * a scannable code: a camera aimed at codes that do not exist is an endpoint
 * with no caller, in reverse. This is the printing half.
 *
 * ## Tagged at cutting
 *
 * The garment first physically exists when it is cut, so this defaults to the
 * orders that are about to be cut. The tag then follows the garment through
 * tailoring, QC and dispatch, which is where scanning earns its keep — a tailor
 * picking the right bundle off a rack, QC pulling the right order.
 *
 * ## The QR comes from the server
 *
 * Not generated here. The tag a hub prints and the tag printed from this
 * dashboard have to be byte-identical; two generators would eventually disagree
 * about what a code contains, and the only symptom would be a garment nobody
 * can scan.
 *
 * ## Selection is explicit
 *
 * Nothing is pre-selected. Printing tags for orders that are not being cut this
 * session produces loose tags on a cutting table, and a loose garment tag is
 * worse than none: it will eventually be attached to the wrong garment.
 */

/** The stages at which a garment is about to be, or is being, cut. */
const CUTTING_STAGES = ['fabric_sourced', 'cutting'] as const;

/** An order that can actually be tagged: the sheet endpoint is keyed on uuid. */
type TaggableOrder = AdminOrder & { uuid: string };

export function GarmentTagsPage() {
  const [orders, setOrders] = React.useState<TaggableOrder[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [tags, setTags] = React.useState<GarmentTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Both cutting stages, merged. The orders endpoint filters one stage at
        // a time, and a manager tagging a morning's work does not care which of
        // the two an order happens to be in.
        const pages = await Promise.all(
          CUTTING_STAGES.map((stage) => ordersApi.list({ stage, limit: 100 })),
        );
        if (cancelled) return;
        // An order with no uuid cannot be tagged — the sheet endpoint is keyed
        // on it — so it is dropped here rather than rendered as a row that
        // silently prints nothing.
        const merged = pages.flatMap((p) => p.orders ?? []).filter((o): o is TaggableOrder =>
          typeof o.uuid === 'string' && o.uuid.length > 0,
        );
        // De-duplicated by uuid: an order that moved between the two fetches
        // would otherwise appear twice and print two tags for one garment.
        const seen = new Set<string>();
        setOrders(merged.filter((o) => !seen.has(o.uuid) && seen.add(o.uuid)));
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not load orders.');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(uuid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
    // Any change invalidates a built sheet — printing tags for a selection the
    // person has since changed is exactly how a wrong tag reaches a garment.
    setTags([]);
  }

  async function buildAndPrint() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const built = await tagsApi.sheet([...selected]);
      setTags(built);
      // Waits a frame so the sheet is in the DOM before the print dialog
      // snapshots the page. Calling print() in the same tick prints an empty
      // sheet, which looks like the server returned nothing.
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the tags.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Garment tags</h1>
          <p className={styles.sub}>
            Printed at cutting and attached to the garment. The tag follows it through
            tailoring, QC and dispatch. 50 × 70mm, nine to an A4 sheet — cut along the
            dashed guides.
          </p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.bar}>
        <button
          onClick={buildAndPrint}
          disabled={selected.size === 0 || busy}
          className={styles.noPrint}
        >
          {busy ? 'Building…' : `Print ${selected.size || ''} tag${selected.size === 1 ? '' : 's'}`}
        </button>
        {tags.length > 0 && (
          <button onClick={() => window.print()} className={styles.noPrint}>
            Print again
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.empty}>Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>
          No orders are waiting to be cut. Tags are printed at cutting, so there is
          nothing to tag yet.
        </div>
      ) : (
        <div className={styles.list}>
          {orders.map((o) => (
            <label key={o.uuid} className={styles.row}>
              <input
                type="checkbox"
                checked={selected.has(o.uuid)}
                onChange={() => toggle(o.uuid)}
              />
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{o.id}</span>
                <span className={styles.rowMeta}>
                  {' '}
                  {o.reference_id ? `· ${o.reference_id}` : ''} {o.customer ? `· ${o.customer}` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {/* The sheet itself. Hidden on screen, and the only thing visible in print. */}
      <div className={styles.sheet}>
        {tags.map((t) => (
          <div className={styles.tag} key={t.order_id}>
            {/* Server-rendered SVG. Trusted because it is generated by our own
                backend from a code we chose, not from user input. */}
            <div className={styles.tagQr} dangerouslySetInnerHTML={{ __html: t.qr_svg }} />
            <div className={styles.tagCode}>{t.reference_id || t.order_number}</div>
            <div className={styles.tagOrder}>{t.order_number}</div>
            {t.garment_name && <div className={styles.tagGarment}>{t.garment_name}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
