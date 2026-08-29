import React from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../../api/adminApi';
import type { AuditEntry } from '../../api/adminApi';
import { downloadCsv, datedFilename } from '../../utils/csv';
import styles from './AuditLogPage.module.css';
import { UilAngleDown, UilAngleLeft, UilAngleRight, UilAngleUp, UilImport, UilSearch, UilTimes } from "@iconscout/react-unicons";
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const LIMIT = 50;

// [SHL-7-10] The action filter is built from the log, not from a list typed here.
//
// It used to be this hardcoded array, and nine of its ten options matched no action this
// codebase writes. The tenth near-miss was the expensive one: the real action is
// `update_config` and the option offered `config_update` — the same two words reversed —
// so the config rows on screen could not be filtered to at all. Worse was the omission:
// none of `manual_refund`, `dpdp_erase`, `confirm_cod_deposit`, `export_customer_pii`,
// `staff_reset_password` — every action anyone opens this page to hunt for — was offered.
//
// A filter option that matches nothing is a lie the page tells about its own contents,
// and a filter list maintained by hand drifts the moment anyone adds an action. Derived
// from `SELECT DISTINCT action`, options can only be actions that actually happened.

// [SHL-7-11] Break-glass is BOTH ways an order's stage moves by hand.
//
// The chip filtered `update_order_stage` alone. P1-e established that the actual
// break-glass path is `POST /orders/:id/advance` — gated `system:manage` — which logs
// `advance_order_stage`. Both rows existed in the log; the pinned view rendered one, and
// it was the wrong one. A view whose entire job is "show me the overrides" that silently
// omits the override is worse than no view: it answers the question, incorrectly, and
// invites you to stop looking.
//
// Sent as a comma-separated list; the endpoint matches with `= ANY(...)`.
const BREAK_GLASS_ACTIONS = ['advance_order_stage', 'update_order_stage'] as const;
const BREAK_GLASS_ACTION = BREAK_GLASS_ACTIONS.join(',');

// T2-22: entity types with a real detail page — their IDs deep-link to the record.
const ENTITY_ROUTE: Record<string, ((id: string) => string) | undefined> = {
  order: (id) => `/admin/orders/${id}`,
  user: (id) => `/admin/users/${id}`,
  return: (id) => `/admin/returns/${id}`,
  hub: (id) => `/admin/hubs/${id}`,
};

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

export const AuditLogPage: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('All');
  const [actor, setActor] = React.useState('');
  const [entityType, setEntityType] = React.useState('');
  const [entityId, setEntityId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  const [facets, setFacets] = React.useState<{ actors: string[]; entity_types: string[]; actions: string[] }>({ actors: [], entity_types: [], actions: [] });
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [exporting, setExporting] = React.useState(false);

  const debouncedSearch = useDebounce(search, 350);
  const debouncedEntityId = useDebounce(entityId, 350);

  React.useEffect(() => {
    auditApi.facets().then(setFacets).catch(() => {});
  }, []);

  const filters = React.useMemo(() => ({
    search: debouncedSearch || undefined,
    action: actionFilter !== 'All' ? actionFilter : undefined,
    actor: actor || undefined,
    entity_type: entityType || undefined,
    entity_id: debouncedEntityId || undefined,
    from: from || undefined,
    to: to || undefined,
  }), [debouncedSearch, actionFilter, actor, entityType, debouncedEntityId, from, to]);

  React.useEffect(() => {
    setLoading(true);
    setError('');
    auditApi.list({ ...filters, page, limit: LIMIT })
      .then(res => {
        setEntries(res.entries ?? []);
        setTotal(res.total ?? 0);
        setTotalPages(res.totalPages ?? 1);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const clearFilters = () => {
    setSearch(''); setActionFilter('All'); setActor(''); setEntityType(''); setEntityId(''); setFrom(''); setTo(''); setPage(1);
  };
  const hasFilters = !!(search || actionFilter !== 'All' || actor || entityType || entityId || from || to);

  // T2-22: working Export CSV — pulls every page matching the current filters.
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all: AuditEntry[] = [];
      for (let p = 1; p <= 500; p++) {
        const res = await auditApi.list({ ...filters, page: p, limit: 100 });
        all.push(...res.entries);
        if (p >= (res.totalPages || 1) || res.entries.length === 0) break;
      }
      downloadCsv<AuditEntry>(
        datedFilename('audit-log'),
        [
          { header: 'Timestamp', value: e => e.timestamp },
          { header: 'Admin', value: e => e.admin },
          { header: 'Action', value: e => e.action },
          { header: 'Entity type', value: e => e.entityType },
          { header: 'Entity ID', value: e => e.entityId },
          { header: 'IP', value: e => e.ip },
          { header: 'Details', value: e => (e.details != null ? JSON.stringify(e.details) : '') },
        ],
        all,
      );
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const entityCell = (entry: AuditEntry) => {
    const route = ENTITY_ROUTE[entry.entityType];
    return (
      <>
        <span className={styles.entityType}>{entry.entityType}</span>
        {route && entry.entityId ? (
          <Link className={styles.entityLink} to={route(entry.entityId)} onClick={e => e.stopPropagation()}>
            {entry.entityId}
          </Link>
        ) : (
          <span className={styles.entityId}>{entry.entityId}</span>
        )}
      </>
    );
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Audit Log</h1>
      {/* [SHL-7-12] The old line read "Every admin write action is automatically logged
          with the admin's identity." It was disproved by experiment — role change,
          deactivate/reactivate and set-temp-password all returned 200 and wrote nothing —
          and it is the strongest possible claim, printed on the surface an auditor
          consults to check it. Someone verifying coverage reads that sentence and stops.

          Those three are audited now (recordGovernance), as are staff activate/deactivate
          [SHL-6-6], service-pincode writes [SHL-6-11] and garment-type create/delete
          [DSG-11-13]. But the claim is absolute over ~369 write routes in 56 files, and
          no page can honestly guarantee that. So it says what it can stand behind, and
          names the one inference an auditor must not draw. */}
      <div className={styles.subtitle}>
        Read-only. Actions are logged where the code records them — with the actor, the
        time, and (increasingly) the before/after values. Coverage is per-action, not
        automatic: <strong>the absence of a row is not proof an action did not happen.</strong>{' '}
        If you are auditing a specific verb, confirm it writes here before relying on this
        page.
      </div>

      {/* Pinned views: break-glass overrides lead — the highest-trust action */}
      <div className={styles.pinnedViews}>
        <button
          className={`${styles.viewChip} ${actionFilter === 'All' ? styles.viewChipActive : ''}`}
          onClick={() => { setActionFilter('All'); setPage(1); }}
        >
          All activity
        </button>
        <button
          className={`${styles.viewChip} ${actionFilter === BREAK_GLASS_ACTION ? styles.viewChipActive : ''}`}
          onClick={() => { setActionFilter(BREAK_GLASS_ACTION); setPage(1); }}
        >
          🔓 Break-glass overrides
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search action, entity ID, or admin…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className={styles.filterSelect} value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} aria-label="Action">
          <option value="All">All actions</option>
          {/* The break-glass chip can select an action the log has never recorded (and the
              facets therefore do not list). Carry it as an option anyway, or the select
              would sit blank while a filter is plainly active. */}
          {(facets.actions.includes(actionFilter) || actionFilter === 'All'
            ? facets.actions
            : [actionFilter, ...facets.actions]
          ).map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <select className={styles.filterSelect} value={actor} onChange={e => { setActor(e.target.value); setPage(1); }} aria-label="Actor">
          <option value="">All actors</option>
          {facets.actors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={styles.filterSelect} value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }} aria-label="Entity type">
          <option value="">All entities</option>
          {facets.entity_types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          className={styles.filterSelect}
          placeholder="Entity ID…"
          value={entityId}
          onChange={e => { setEntityId(e.target.value); setPage(1); }}
          aria-label="Entity ID"
        />
        <input className={styles.dateInput} type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
        <input className={styles.dateInput} type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
        {hasFilters && <button className={styles.clearBtn} onClick={clearFilters}><UilTimes size={14} /> Clear</button>}
        <button className={styles.exportBtn} onClick={exportCsv} disabled={exporting || total === 0}>
          <UilImport size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Entity</th>
              <th>IP Address</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}><div className={styles.skeleton} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  <div>{error}</div>
                  <button className={styles.retryBtn} onClick={() => { setError(''); setPage(1); }}>Retry</button>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No audit entries match your filters.</td></tr>
            ) : (
              entries.map(entry => (
                <React.Fragment key={entry.id}>
                  <tr className={styles.row} {...rowActivation(() => setExpandedId(expandedId === entry.id ? null : entry.id))}>
                    <td className={styles.timestamp}>{entry.timestamp}</td>
                    <td className={styles.admin}>{entry.admin}</td>
                    <td className={styles.action}>{entry.action}</td>
                    <td>{entityCell(entry)}</td>
                    <td className={styles.ip}>{entry.ip}</td>
                    <td>
                      <button className={styles.expandBtn}>{expandedId === entry.id ? <UilAngleUp size={14}/> : <UilAngleDown size={14}/>}</button>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={6}>
                        <div className={styles.expandedContent}>
                          <div className={styles.expandedLabel}>Full detail:</div>
                          <pre className={styles.jsonBlock}>{JSON.stringify(entry.details ?? entry, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>
          {loading ? 'Loading…' : `${total} entries total · Newest first`}
        </span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
            <UilAngleLeft size={15}/> Prev
          </button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>
            Next <UilAngleRight size={15}/>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
