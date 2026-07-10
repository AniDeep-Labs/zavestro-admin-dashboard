import React from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../../api/adminApi';
import type { AuditEntry } from '../../api/adminApi';
import { downloadCsv, datedFilename } from '../../utils/csv';
import styles from './AuditLogPage.module.css';
import { UilAngleDown, UilAngleLeft, UilAngleRight, UilAngleUp, UilImport, UilSearch, UilTimes } from "@iconscout/react-unicons";

const LIMIT = 50;

const ACTION_TYPES = ['All', 'update_order_stage', 'order_status_update', 'user_deactivate', 'config_update', 'catalog_create', 'catalog_update', 'content_publish', 'support_ticket_resolved', 'promo_create', 'bulk_status_update'];

// Break-glass = manual stage overrides (the Wave-2 reason-required action).
const BREAK_GLASS_ACTION = 'update_order_stage';

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

  const [facets, setFacets] = React.useState<{ actors: string[]; entity_types: string[] }>({ actors: [], entity_types: [] });
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
      <div className={styles.subtitle}>Read-only. Every admin write action is automatically logged with the admin's identity.</div>

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
        <select className={styles.filterSelect} value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}>
          {ACTION_TYPES.map(a => <option key={a}>{a}</option>)}
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
                  <tr className={styles.row} onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
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
