import React from 'react';
import { customerLookupApi } from '../../api/adminApi';
import type { CustomerLookupResult } from '../../api/adminApi';
import { UilMapMarker, UilPhone, UilSearch, UilShoppingBag, UilTimes, UilUser } from "@iconscout/react-unicons";

interface Props {
  onSelect: (customer: CustomerLookupResult) => void;
  placeholder?: string;
  selectedCustomer?: CustomerLookupResult | null;
  onClear?: () => void;
  autoFocus?: boolean;
  label?: string;
}

export const CustomerQuickLookup: React.FC<Props> = ({
  onSelect,
  placeholder = 'Search by phone, ZC-ID, name or email…',
  selectedCustomer,
  onClear,
  autoFocus,
  label,
}) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<CustomerLookupResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await customerLookupApi.search(query.trim());
        setResults(data);
        setOpen(true);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 300);
  }, [query]);

  React.useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleSelect = (c: CustomerLookupResult) => {
    onSelect(c);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  if (selectedCustomer) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-light)', borderRadius: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedCustomer.name || '—'}</span>
            {selectedCustomer.reference_id && (
              <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '1px 6px', background: 'var(--color-primary-faint, rgba(31, 107, 79,0.08))', color: 'var(--color-primary)', borderRadius: 4 }}>
                {selectedCustomer.reference_id}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <UilPhone size={11} />{selectedCustomer.phone}
            </span>
            {selectedCustomer.city && (
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <UilMapMarker size={11} />{selectedCustomer.city}
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <UilShoppingBag size={11} />{selectedCustomer.order_count} order{selectedCustomer.order_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 4, borderRadius: 4 }}
            title="Change customer"
          >
            <UilTimes size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <UilSearch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '9px 12px 9px 36px',
            border: '1px solid var(--color-border-light)',
            borderRadius: 8, fontSize: '0.875rem',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            …
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--color-border-light)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <UilUser size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{c.name || <em style={{ color: 'var(--color-text-tertiary)' }}>No name</em>}</span>
                {c.reference_id && (
                  <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '1px 6px', background: 'var(--color-primary-faint, rgba(31, 107, 79,0.08))', color: 'var(--color-primary)', borderRadius: 4 }}>
                    {c.reference_id}
                  </span>
                )}
                {!c.is_active && (
                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(215, 91, 91,0.1)', color: '#D75B5B', borderRadius: 4 }}>
                    Inactive
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 3, marginLeft: 21, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{c.phone}</span>
                {c.email && <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{c.email}</span>}
                {c.city && <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{c.city}</span>}
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{c.order_count} order{c.order_count !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim() && results.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)',
          borderRadius: 8, padding: '12px 14px', fontSize: '0.875rem',
          color: 'var(--color-text-tertiary)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          No customers found for "{query}"
        </div>
      )}
    </div>
  );
};
