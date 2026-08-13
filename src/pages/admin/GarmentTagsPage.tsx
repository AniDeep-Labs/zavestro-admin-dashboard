import React from 'react';
import { tagsApi } from '../../api/adminApi';
import type { GarmentTag, OrderNeedingTag } from '../../api/adminApi';
import styles from './GarmentTagsPage.module.css';

/**
 * AG-S3 (scan) — print garment tags.
 *
 * The ops app had no scanner, and I declined to build one while nothing printed
 * a scannable code: a camera aimed at codes that do not exist is an endpoint
 * with no caller, in reverse. This is the printing half.
 *
 * ## Tagged on arrival, and the tag travels to delivery
 *
 * An earlier cut of this listed the orders about to be CUT. That was worse: it
 * left the order untracked for everything before the cut — fabric being pulled,
 * a measurement visit still outstanding — and gave the work a second identity
 * part-way through its life. The tag is now generated when the order arrives at
 * the hub, so the code the tailor reads off the bundle is the one QC pulls and
 * dispatch matches to an address.
 *
 * ## Which orders appear, and why the server decides
 *
 * "Needs a tag" means no tag has been PRINTED yet, which only the server knows.
 * Filtering by stage here — as the first version did — would reprint tags for
 * work already tagged, and two tags in circulation for one order is how a tag
 * reaches the wrong garment. So this asks for the pending list rather than
 * deriving it.
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

export function GarmentTagsPage() {
  const [orders, setOrders] = React.useState<OrderNeedingTag[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [tags, setTags] = React.useState<GarmentTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await tagsApi.pending();
      setOrders(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function toggle(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
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
      // The server has now recorded these as printed, so the pending list is
      // stale. Refreshed rather than left showing rows that are done — a list
      // that keeps offering tagged orders is how a second tag gets printed.
      setSelected(new Set());
      void load();
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
            Printed when an order reaches the hub, and attached to the work it belongs to.
            The same tag stays with it through cutting, tailoring, QC and delivery.
            50 × 70mm, nine to an A4 sheet — cut along the dashed guides.
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
          Every order at this hub already has a tag. Nothing to print.
        </div>
      ) : (
        <div className={styles.list}>
          {orders.map((o) => (
            <label key={o.order_id} className={styles.row}>
              <input
                type="checkbox"
                checked={selected.has(o.order_id)}
                onChange={() => toggle(o.order_id)}
              />
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{o.order_number}</span>
                <span className={styles.rowMeta}>
                  {' '}
                  {o.reference_id ? `· ${o.reference_id}` : ''}
                  {o.customer_name ? ` · ${o.customer_name}` : ''}
                  {/* The stage is shown because a tag is no longer tied to one:
                      an order awaiting a measurement visit needs a tag just as
                      much as one about to be cut. */}
                  {o.stage ? ` · ${o.stage.replace(/_/g, ' ')}` : ''}
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
            {/* A reprint is marked on the tag itself. Two tags in circulation for
                one order is worth knowing about when both turn up on a rack, and
                a mark on the paper survives long after the print dialog. */}
            {t.previous_prints > 0 && (
              <div className={styles.tagReprint}>REPRINT #{t.previous_prints + 1}</div>
            )}
            <div className={styles.tagOrder}>{t.order_number}</div>
            {t.garment_name && <div className={styles.tagGarment}>{t.garment_name}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
