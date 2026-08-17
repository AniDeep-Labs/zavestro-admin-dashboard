import React from 'react';
import type { Hub } from '../../api/adminApi';
import { PeekDrawer } from '../../components/PeekDrawer/PeekDrawer';
import { EmptyState } from '../../components';
import { downloadCsv, datedFilename } from '../../utils/csv';
import styles from './OrdersListPage.module.css';
import ov from './OverviewExceptions.module.css';
import { UilImport, UilTimes } from '@iconscout/react-unicons';

// T2-21 (SU-1): the shared exceptions-first overview shell. Each page passes tabs of exception rows;
// the shell renders hub/date filters, tab chips with counts, a table per tab, CSV of the whole tab,
// and a PeekDrawer quick-look on row click. Keeps Design / Listings / Supply overviews consistent.

export interface OvColumn<T> {
  header: string;
  cell: (r: T) => React.ReactNode;
}
export interface OvCsvCol<T> {
  header: string;
  value: (r: T) => string | number;
}
export interface OvPeek {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  fields: { label: string; value: React.ReactNode }[];
  fullLink?: { label?: string; onClick: () => void };
}
export interface OvTab<T> {
  key: string;
  label: string;
  rows: T[];
  rowKey: (r: T) => string;
  columns: OvColumn<T>[];
  csv: OvCsvCol<T>[];
  peek: (r: T) => OvPeek;
  emptyBody?: string;
}

export interface OverviewExceptionsProps<T> {
  title: string;
  subtitle?: string;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  hubs: Hub[];
  hubId: string;
  startDate: string;
  endDate: string;
  onFilter: (patch: { hubId?: string; startDate?: string; endDate?: string }) => void;
  tabs: OvTab<T>[];
  csvName: string;
  // Optional extra filter controls (e.g. aging-days) rendered in the filter bar.
  extraFilters?: React.ReactNode;
  // Optional content rendered above the filters (e.g. Supply's stock KPIs).
  headerExtra?: React.ReactNode;
}

// A single generic that TS is happy to erase per-tab.
export function OverviewExceptions<T>(props: OverviewExceptionsProps<T>) {
  const { tabs, hubs, hubId, startDate, endDate, onFilter, loading, error } = props;
  const [activeKey, setActiveKey] = React.useState(tabs[0]?.key);
  const [peekRow, setPeekRow] = React.useState<T | null>(null);

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  const filtered = !!(hubId || startDate || endDate);

  const exportCsv = () => {
    if (!active) return;
    downloadCsv<T>(
      datedFilename(`${props.csvName}-${active.key}`),
      active.csv.map((c) => ({ header: c.header, value: c.value })),
      active.rows,
    );
  };

  const peek = peekRow && active ? active.peek(peekRow) : null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{props.title}</h1>
          {props.subtitle && <p className={ov.subtitle}>{props.subtitle}</p>}
        </div>
        <button className={styles.exportBtn} onClick={exportCsv} disabled={!active?.rows.length}>
          <UilImport size={14} /> Export CSV
        </button>
      </div>

      {props.headerExtra}

      {/* Filters */}
      <div className={ov.filterBar}>
        <select
          className={ov.control}
          value={hubId}
          onChange={(e) => onFilter({ hubId: e.target.value })}
          aria-label="Hub"
        >
          <option value="">All hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <input
          className={ov.control}
          type="date"
          value={startDate}
          onChange={(e) => onFilter({ startDate: e.target.value })}
          aria-label="Start date"
        />
        <input
          className={ov.control}
          type="date"
          value={endDate}
          onChange={(e) => onFilter({ endDate: e.target.value })}
          aria-label="End date"
        />
        {props.extraFilters}
        {filtered && (
          <button
            className={styles.clearBtn}
            onClick={() => onFilter({ hubId: '', startDate: '', endDate: '' })}
          >
            <UilTimes size={14} /> Clear
          </button>
        )}
      </div>

      {/* Exception tabs */}
      <div className={styles.viewChips}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`${styles.viewChip} ${active?.key === t.key ? styles.viewChipActive : ''}`}
            onClick={() => setActiveKey(t.key)}
          >
            {t.label} <span className={ov.count}>{loading ? '…' : t.rows.length}</span>
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>{active?.columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {active?.columns.map((__, j) => (
                    <td key={j}>
                      <div className={styles.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={active?.columns.length ?? 1}>
                  <EmptyState
                    title="Couldn't load overview"
                    body={error}
                    action={props.onRetry ? { label: 'Retry', onClick: props.onRetry } : undefined}
                    size="compact"
                  />
                </td>
              </tr>
            ) : !active || active.rows.length === 0 ? (
              <tr>
                <td colSpan={active?.columns.length ?? 1}>
                  <EmptyState
                    title="Nothing to action here ✓"
                    body={active?.emptyBody ?? 'No exceptions in this view.'}
                    size="compact"
                  />
                </td>
              </tr>
            ) : (
              active.rows.map((r) => (
                <tr
                  key={active.rowKey(r)}
                  className={`${styles.row} ${ov.rowClickable}`}
                  onClick={() => setPeekRow(r)}
                 tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === "Enter") (() => setPeekRow(r))?.(); }}>
                  {active.columns.map((c) => (
                    <td key={c.header}>{c.cell(r)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PeekDrawer
        open={!!peek}
        onClose={() => setPeekRow(null)}
        title={peek?.title ?? ''}
        subtitle={peek?.subtitle}
        status={peek?.status}
        fullLink={peek?.fullLink}
      >
        {peek && (
          <dl className={ov.fieldGrid}>
            {peek.fields.map((f) => (
              <div key={f.label} className={ov.field}>
                <dt className={ov.fieldLabel}>{f.label}</dt>
                <dd className={ov.fieldValue}>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </PeekDrawer>
    </div>
  );
}

export default OverviewExceptions;
