import React from 'react';
import { ChevronDown, User, X, Briefcase } from 'lucide-react';
import { hubStaffGlobalApi, hubStaffApi } from '../../api/adminApi';
import type { HubStaffGlobal, HubStaff } from '../../api/adminApi';

type StaffOption = (HubStaffGlobal & { active_orders?: number; active_bookings?: number; active_visits?: number }) | HubStaff;

interface Props {
  value: string | null;
  onChange: (staffId: string | null) => void;
  hubId?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  showWorkload?: boolean;
  filterRoles?: string[];
}

const ROLE_LABELS: Record<string, string> = {
  tailor: 'Tailor', cutter: 'Cutter', finisher: 'Finisher',
  quality_checker: 'QC', manager: 'Manager',
};

function workloadColor(total: number): string {
  if (total === 0) return 'var(--color-text-tertiary)';
  if (total <= 3) return '#16a34a';
  if (total <= 6) return '#d97706';
  return '#dc2626';
}

function WorkloadBadge({ orders = 0, bookings = 0, visits = 0 }: { orders?: number; bookings?: number; visits?: number }) {
  const total = orders + bookings + visits;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: workloadColor(total), marginLeft: 6 }}>
      <Briefcase size={10} />
      {total}
    </span>
  );
}

export const StaffAssignmentDropdown: React.FC<Props> = ({
  value,
  onChange,
  hubId,
  label,
  placeholder = 'Assign staff…',
  disabled,
  showWorkload = true,
  filterRoles,
}) => {
  const [staff, setStaff] = React.useState<StaffOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setLoading(true);
    const fetcher = hubId && showWorkload
      ? hubStaffApi.workload(hubId)
      : hubId
        ? hubStaffApi.list(hubId)
        : hubStaffGlobalApi.list();
    fetcher
      .then((result) => {
        let filtered = result as StaffOption[];
        if (filterRoles?.length) filtered = filtered.filter(s => filterRoles.includes(s.role));
        setStaff(filtered.filter(s => s.is_active));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hubId, showWorkload, filterRoles?.join(',')]);

  React.useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const selected = value ? staff.find(s => s.id === value) : null;

  const hubName = (s: StaffOption): string | undefined =>
    ('hub_name' in s ? (s as HubStaffGlobal).hub_name : undefined) ?? undefined;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
          padding: '8px 12px', border: '1px solid var(--color-border-light)', borderRadius: 8,
          background: 'var(--color-bg-primary)', cursor: disabled ? 'default' : 'pointer',
          fontSize: '0.875rem', color: 'var(--color-text-primary)',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <User size={14} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? 'Loading…' : selected ? (
            <>
              {selected.name}
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
                {ROLE_LABELS[selected.role] ?? selected.role}
              </span>
              {showWorkload && (
                <WorkloadBadge
                  orders={'active_orders' in selected ? selected.active_orders : undefined}
                  bookings={'active_bookings' in selected ? selected.active_bookings : undefined}
                  visits={'active_visits' in selected ? selected.active_visits : undefined}
                />
              )}
            </>
          ) : (
            <span style={{ color: 'var(--color-text-tertiary)' }}>{placeholder}</span>
          )}
        </span>
        {value && !disabled ? (
          <X
            size={14}
            style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
          />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxHeight: 300, overflowY: 'auto',
        }}>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: '1px solid var(--color-border-light)',
              fontSize: '0.875rem', color: 'var(--color-text-tertiary)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <X size={13} /> Unassign
          </button>
          {staff.length === 0 && !loading && (
            <div style={{ padding: '12px 14px', fontSize: '0.875rem', color: 'var(--color-text-tertiary)' }}>
              No staff available
            </div>
          )}
          {staff.map((s) => {
            const total = ('active_orders' in s ? (s.active_orders ?? 0) : 0) +
                          ('active_bookings' in s ? (s.active_bookings ?? 0) : 0) +
                          ('active_visits' in s ? (s.active_visits ?? 0) : 0);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { onChange(s.id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                  padding: '10px 14px', background: s.id === value ? 'var(--color-bg-secondary)' : 'none',
                  border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border-light)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = s.id === value ? 'var(--color-bg-secondary)' : 'none')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{s.name}</span>
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}>
                      {ROLE_LABELS[s.role] ?? s.role}
                    </span>
                    {showWorkload && total > 0 && (
                      <span style={{ fontSize: 11, color: workloadColor(total), display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Briefcase size={10} />{total} active
                      </span>
                    )}
                    {showWorkload && total === 0 && (
                      <span style={{ fontSize: 11, color: '#16a34a' }}>Available</span>
                    )}
                  </div>
                  {hubName(s) && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{hubName(s)}</div>
                  )}
                </div>
                {s.id === value && (
                  <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
