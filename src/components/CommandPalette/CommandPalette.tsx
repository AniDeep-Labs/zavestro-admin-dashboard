import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi, usersApi, fabricsApi, designsApi } from '../../api/adminApi';
import styles from './CommandPalette.module.css';
import { UilSearch, UilShoppingBag, UilUser, UilCornerDownLeft, UilLayerGroup, UilPalette, UilBolt, UilHistory } from '@iconscout/react-unicons';

/**
 * ⌘K command palette (FABLE-ADMIN-UIUX §1.2). Jump to cap-allowed nav pages; search orders,
 * customers, fabrics (by code/name) and designs (by name); run cap-gated actions; and re-open
 * recent destinations. Reuses existing list endpoints — no new backend. The caller passes
 * cap-filtered nav targets + actions so the palette never offers something the role can't do.
 */
export interface NavTarget {
  label: string;
  path: string;
  section?: string;
}

// T3-1 (S-1): a cap-gated action (e.g. "Create listing", "New ticket"). The caller only
// passes actions the role may perform.
export interface PaletteAction {
  label: string;
  sub?: string;
  run: () => void;
}

type Kind = 'nav' | 'order' | 'customer' | 'fabric' | 'design' | 'action' | 'recent';
interface Result {
  kind: Kind;
  label: string;
  sub?: string;
  to?: string; // navigation target
  run?: () => void; // action handler
}

interface Props {
  open: boolean;
  onClose: () => void;
  navTargets: NavTarget[];
  actions: PaletteAction[];
  canSearchOrders: boolean;
  canSearchCustomers: boolean;
  canSearchFabrics: boolean;
  canSearchDesigns: boolean;
  fabricBase: string; // route prefix for a fabric PDP the role can open
}

// T3-1 (S-1): recent destinations (localStorage, most-recent-first, capped at 5).
const RECENTS_KEY = 'zavestro_admin_palette_recents';
type Recent = { label: string; sub?: string; to: string };
const readRecents = (): Recent[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch {
    return [];
  }
};
const pushRecent = (r: Recent) => {
  const next = [r, ...readRecents().filter((x) => x.to !== r.to)].slice(0, 5);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
};

const ICON: Record<Kind, React.ReactNode> = {
  order: <UilShoppingBag size={15} />,
  customer: <UilUser size={15} />,
  fabric: <UilLayerGroup size={15} />,
  design: <UilPalette size={15} />,
  action: <UilBolt size={15} />,
  recent: <UilHistory size={15} />,
  nav: <UilCornerDownLeft size={15} />,
};

export const CommandPalette: React.FC<Props> = ({
  open,
  onClose,
  navTargets,
  actions,
  canSearchOrders,
  canSearchCustomers,
  canSearchFabrics,
  canSearchDesigns,
  fabricBase,
}) => {
  const navigate = useNavigate();
  const [q, setQ] = React.useState('');
  const [remote, setRemote] = React.useState<Result[]>([]);
  const [active, setActive] = React.useState(0);
  const [recents, setRecents] = React.useState<Recent[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ('');
      setRemote([]);
      setActive(0);
      setRecents(readRecents());
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced remote search: orders, customers, fabrics, designs.
  React.useEffect(() => {
    if (!open || q.trim().length < 2) {
      setRemote([]);
      return;
    }
    const term = q.trim();
    const t = setTimeout(async () => {
      const out: Result[] = [];
      try {
        if (canSearchOrders) {
          const r = await ordersApi.list({ search: term, limit: 5 });
          out.push(...r.orders.map((o) => ({ kind: 'order' as const, label: o.id, sub: `${o.customer} · ${o.hub}`, to: `/admin/orders/${o.id}` })));
        }
        if (canSearchCustomers) {
          const r = await usersApi.list({ search: term, limit: 5 });
          out.push(...r.users.map((u) => ({ kind: 'customer' as const, label: u.name, sub: u.phone ?? u.email ?? '', to: `/admin/users/${u.id}` })));
        }
        if (canSearchFabrics) {
          const r = await fabricsApi.list({ q: term });
          out.push(...r.slice(0, 5).map((f) => ({ kind: 'fabric' as const, label: f.name, sub: f.code ?? undefined, to: `${fabricBase}/${f.id}` })));
        }
        if (canSearchDesigns) {
          const r = await designsApi.list({ q: term, status: 'published' });
          out.push(...r.slice(0, 5).map((d) => ({ kind: 'design' as const, label: d.name, sub: d.garment_type ?? undefined, to: `/admin/design/library/${d.id}` })));
        }
      } catch {
        /* search is best-effort */
      }
      setRemote(out);
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, canSearchOrders, canSearchCustomers, canSearchFabrics, canSearchDesigns, fabricBase]);

  const term = q.trim().toLowerCase();

  const actionMatches: Result[] = React.useMemo(
    () => actions.filter((a) => !term || a.label.toLowerCase().includes(term)).map((a) => ({ kind: 'action' as const, label: a.label, sub: a.sub, run: a.run })),
    [actions, term],
  );
  const navMatches: Result[] = React.useMemo(
    () => navTargets.filter((n) => !term || n.label.toLowerCase().includes(term)).slice(0, term ? 6 : 8).map((n) => ({ kind: 'nav' as const, label: n.label, sub: n.section, to: n.path })),
    [term, navTargets],
  );
  const recentResults: Result[] = React.useMemo(
    () => (term ? [] : recents.map((r) => ({ kind: 'recent' as const, label: r.label, sub: r.sub, to: r.to }))),
    [term, recents],
  );

  // Order: actions first (verbs), then recents (empty query), then nav, then remote records.
  const results = React.useMemo(
    () => [...actionMatches, ...recentResults, ...navMatches, ...remote],
    [actionMatches, recentResults, navMatches, remote],
  );

  React.useEffect(() => { setActive(0); }, [results.length]);

  const go = (r: Result) => {
    onClose();
    if (r.run) { r.run(); return; }
    if (r.to) {
      // Record real destinations (not actions) as a recent.
      if (r.kind !== 'recent') pushRecent({ label: r.label, sub: r.sub, to: r.to });
      navigate(r.to);
    }
  };

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
            // [KA1-7] Was "Search orders, customers, fabrics, designs — or run a command…",
            // wider than the input and so rendered clipped mid-word ("…or run a c"). It was
            // also a SECOND wording for one job — the header trigger says "Search or type a
            // command…" — so the two affordances for the same thing described themselves
            // differently. One wording now, short enough to fit.
            placeholder="Search or type a command…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className={styles.esc}>esc</span>
        </div>
        <div className={styles.results}>
          {results.length === 0 ? (
            <div className={styles.empty}>{q.trim().length < 2 ? 'Type to search…' : 'No matches.'}</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.to ?? r.label}`}
                className={`${styles.result} ${i === active ? styles.resultActive : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
              >
                <span className={styles.resultIcon}>{ICON[r.kind]}</span>
                <span className={styles.resultLabel}>{r.label}</span>
                {r.sub && <span className={styles.resultSub}>{r.sub}</span>}
              </button>
            ))
          )}
        </div>
        {/* [SHL-3-11] The console is keyboard-first — `g o` / `g d` jump, `/` opens this
            palette, `?` opens the shortcut sheet — but the ONLY way to discover any of it
            was to press `?` on a hunch. A shortcut system nobody can find is a shortcut
            system nobody has. The palette is where a keyboard-minded operator already is,
            so it names the rest of the system, including the key that lists them all. */}
        <div className={styles.hints}>
          <span>
            <kbd>↑</kbd><kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>g</kbd> <kbd>o</kbd> orders
          </span>
          <span>
            <kbd>g</kbd> <kbd>d</kbd> dashboard
          </span>
          <span>
            <kbd>?</kbd> all shortcuts
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
