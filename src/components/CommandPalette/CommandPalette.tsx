import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi, usersApi } from '../../api/adminApi';
import styles from './CommandPalette.module.css';
import { UilSearch, UilShoppingBag, UilUser, UilCornerDownLeft } from '@iconscout/react-unicons';

/**
 * ⌘K command palette (FABLE-ADMIN-UIUX §1.2). Wires the previously-dead top-bar
 * search: jump to cap-allowed nav pages, search orders by number/phone and
 * customers by phone/name (reuses the existing list endpoints — no new backend).
 *
 * The caller passes the cap-filtered nav targets so the palette never offers a
 * page the role can't open.
 */
export interface NavTarget {
  label: string;
  path: string;
  section?: string;
}

interface Result {
  kind: 'nav' | 'order' | 'customer';
  label: string;
  sub?: string;
  to: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  navTargets: NavTarget[];
  canSearchOrders: boolean;
  canSearchCustomers: boolean;
}

export const CommandPalette: React.FC<Props> = ({
  open,
  onClose,
  navTargets,
  canSearchOrders,
  canSearchCustomers,
}) => {
  const navigate = useNavigate();
  const [q, setQ] = React.useState('');
  const [remote, setRemote] = React.useState<Result[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ('');
      setRemote([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced remote search (orders by number/phone, customers by phone/name).
  React.useEffect(() => {
    if (!open || q.trim().length < 2) { setRemote([]); return; }
    const term = q.trim();
    const t = setTimeout(async () => {
      const out: Result[] = [];
      try {
        if (canSearchOrders) {
          const r = await ordersApi.list({ search: term, limit: 5 });
          out.push(...r.orders.map((o) => ({
            kind: 'order' as const,
            label: o.id,
            sub: `${o.customer} · ${o.hub}`,
            to: `/admin/orders/${o.id}`,
          })));
        }
        if (canSearchCustomers) {
          const r = await usersApi.list({ search: term, limit: 5 });
          out.push(...r.users.map((u) => ({
            kind: 'customer' as const,
            label: u.name,
            sub: u.phone ?? u.email ?? '',
            to: `/admin/users/${u.id}`,
          })));
        }
      } catch {
        /* search is best-effort */
      }
      setRemote(out);
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, canSearchOrders, canSearchCustomers]);

  const navMatches: Result[] = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return navTargets
      .filter((n) => !term || n.label.toLowerCase().includes(term))
      .slice(0, term ? 6 : 8)
      .map((n) => ({ kind: 'nav' as const, label: n.label, sub: n.section, to: n.path }));
  }, [q, navTargets]);

  const results = React.useMemo(() => [...navMatches, ...remote], [navMatches, remote]);

  React.useEffect(() => { setActive(0); }, [results.length]);

  const go = (r: Result) => { onClose(); navigate(r.to); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <UilSearch size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Jump to a page, or search orders & customers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className={styles.esc}>esc</span>
        </div>
        <div className={styles.results}>
          {results.length === 0 ? (
            <div className={styles.empty}>
              {q.trim().length < 2 ? 'Type to search…' : 'No matches.'}
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.to}`}
                className={`${styles.result} ${i === active ? styles.resultActive : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
              >
                <span className={styles.resultIcon}>
                  {r.kind === 'order' ? <UilShoppingBag size={15} /> : r.kind === 'customer' ? <UilUser size={15} /> : <UilCornerDownLeft size={15} />}
                </span>
                <span className={styles.resultLabel}>{r.label}</span>
                {r.sub && <span className={styles.resultSub}>{r.sub}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
