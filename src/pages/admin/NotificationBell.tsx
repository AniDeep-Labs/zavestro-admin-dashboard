import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isDenied } from '../../components/EmptyState/asyncState';
import { adminInboxApi } from '../../api/adminApi';
import type { AdminNotification } from '../../api/adminApi';
import s from './NotificationBell.module.css';
import { UilBell, UilCheck } from '@iconscout/react-unicons';

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// T3-1 (S-5): day-grouping — bucket a notification by when it landed.
const CAP = 12;
const startOfDay = (t: number) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
const dayBucket = (iso: string): 'Today' | 'Yesterday' | 'Earlier' => {
  const d = startOfDay(new Date(iso).getTime());
  const today = startOfDay(Date.now());
  if (d === today) return 'Today';
  if (d === today - 86_400_000) return 'Yesterday';
  return 'Earlier';
};
const BUCKET_ORDER: ('Today' | 'Yesterday' | 'Earlier')[] = ['Today', 'Yesterday', 'Earlier'];

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<AdminNotification[]>([]);
  const [showAll, setShowAll] = React.useState(false); // T3-1 (S-5): view-all overflow
  const ref = React.useRef<HTMLDivElement>(null);

  // [RC-3] "You're all caught up." is a statement about the business. A swallowed failure
  // made the bell say it without knowing — the archetype this rule exists for, and here it
  // sits in the shell on every page.
  //
  // The error is only kept when the inbox has never loaded. This polls every 30s, so a
  // single blip on an inbox that HAS loaded should not replace a good list with a warning;
  // the next tick fixes it. Only "we have never managed to read this" is worth saying.
  const [loadErr, setLoadErr] = React.useState<unknown>(null);
  const [everLoaded, setEverLoaded] = React.useState(false);

  const load = React.useCallback(() => {
    adminInboxApi
      .list()
      .then((xs) => { setItems(xs); setEverLoaded(true); setLoadErr(null); })
      .catch((e) => setLoadErr(e));
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowAll(false); }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  const openItem = async (n: AdminNotification) => {
    if (!n.is_read) {
      // Optimistic, but reverted if the server refused — otherwise the badge drops, the
      // row greys out, and the notification comes back on the next poll with no
      // explanation for why it returned.
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      adminInboxApi.markRead(n.id).catch(() => {
        setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_read: false } : x)));
      });
    }
    setOpen(false);
    if (n.deep_link && n.deep_link.startsWith('/admin')) navigate(n.deep_link);
  };

  const markAll = async () => {
    const before = items;
    setItems((xs) => xs.map((x) => ({ ...x, is_read: true })));
    // Same reversal: "mark all read" that silently did not is worse than one that failed
    // visibly, because the count is the only thing telling anyone there is work waiting.
    await adminInboxApi.markAllRead().catch(() => setItems(before));
  };

  return (
    <div className={s.wrap} ref={ref}>
      <button className={s.bell} onClick={() => setOpen((o) => { if (o) setShowAll(false); return !o; })} aria-label="Notifications">
        <UilBell size={20} />
        {unread > 0 && <span className={s.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className={s.dropdown}>
          <div className={s.header}>
            <span>Notifications</span>
            {unread > 0 && <button className={s.markAll} onClick={markAll}><UilCheck size={13} /> Mark all read</button>}
          </div>
          <div className={s.list}>
            {loadErr != null && !everLoaded ? (
              <div className={s.empty}>
                {isDenied(loadErr)
                  ? 'Your role cannot read the notification inbox — this is not an empty inbox.'
                  : "Notifications couldn't be loaded — this is not an empty inbox."}
                <button className={s.markAll} onClick={load}>Retry</button>
              </div>
            ) : items.length === 0 ? (
              <div className={s.empty}>You're all caught up.</div>
            ) : (
              (() => {
                // T3-1 (S-5): cap at 12 unless "view all"; group the shown items by day.
                const shown = showAll ? items : items.slice(0, CAP);
                return BUCKET_ORDER.map((bucket) => {
                  const group = shown.filter((n) => dayBucket(n.created_at) === bucket);
                  if (group.length === 0) return null;
                  return (
                    <div key={bucket}>
                      <div className={s.dayLabel}>{bucket}</div>
                      {group.map((n) => (
                        <button key={n.id} className={`${s.item} ${n.is_read ? '' : s.unread}`} onClick={() => openItem(n)}>
                          {!n.is_read && <span className={s.dot} />}
                          <div className={s.itemBody}>
                            <div className={s.itemTitle}>{n.title}</div>
                            <div className={s.itemText}>{n.body}</div>
                            <div className={s.itemTime}>{ago(n.created_at)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                });
              })()
            )}
            {!showAll && items.length > CAP && (
              <button className={s.viewAll} onClick={() => setShowAll(true)}>
                View all {items.length} notifications
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
