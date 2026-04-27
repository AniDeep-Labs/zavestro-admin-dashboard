import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supportApi } from '../../api/adminApi';
import type { SupportTicket } from '../../api/adminApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './TicketDetailPage.module.css';

const TEMPLATES = [
  'Thank you for reaching out to Zavestro support.',
  "We've reviewed your order and are looking into this.",
  'Your refund has been processed and will reflect in 3–5 days.',
  "I'll escalate this to our operations team right away.",
];

const MOCK_MESSAGES = [
  { from: 'customer', text: "Hi, my order hasn't been updated in 5 days. It still shows 'in tailoring'. Can you help?", time: '2h ago' },
  { from: 'system', text: 'Ticket created.', time: '2h ago' },
];

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = React.useState<SupportTicket | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [reply, setReply] = React.useState('');
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [resolveOnReply, setResolveOnReply] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'reply' | 'notes'>('reply');
  const [internalNote, setInternalNote] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const dismissToast = (tid: string) => setToasts(t => t.filter(x => x.id !== tid));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    supportApi.get(id)
      .then(setTicket)
      .catch(e => showToast('error', 'Failed to load ticket', e instanceof Error ? e.message : undefined))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSendReply = async () => {
    if (!ticket || !reply.trim()) return;
    setSending(true);
    try {
      await supportApi.addReply(ticket.id, reply.trim(), false);
      if (resolveOnReply) {
        const updated = await supportApi.update(ticket.id, { status: 'Resolved' });
        setTicket(updated);
      }
      setReply('');
      showToast('success', 'Reply sent');
    } catch (e) {
      showToast('error', 'Failed to send', e instanceof Error ? e.message : undefined);
    } finally { setSending(false); }
  };

  const handleAddNote = async () => {
    if (!ticket || !internalNote.trim()) return;
    setSending(true);
    try {
      await supportApi.addReply(ticket.id, internalNote.trim(), true);
      setInternalNote('');
      showToast('success', 'Note added');
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    } finally { setSending(false); }
  };

  const handleStatusChange = async (status: SupportTicket['status']) => {
    if (!ticket) return;
    try {
      const updated = await supportApi.update(ticket.id, { status });
      setTicket(updated);
      showToast('success', `Ticket ${status.toLowerCase()}`);
    } catch (e) {
      showToast('error', 'Failed', e instanceof Error ? e.message : undefined);
    }
  };

  if (loading) return <div className={styles.page}><div>Loading ticket…</div></div>;
  if (!ticket) return <div className={styles.page}><button className={styles.backBtn} onClick={() => navigate('/admin/support')}>← Back</button><div>Ticket not found.</div></div>;

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button className={styles.backBtn} onClick={() => navigate('/admin/support')}>← Back to Tickets</button>

      <div className={styles.twoCol}>
        {/* Left: chat */}
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.ticketHeader}>
              <div className={styles.headerLeft}>
                <span className={styles.ticketId}>{ticket.id}</span>
                <span className={`${styles.statusPill} ${styles[`status${ticket.status.replace(' ', '')}`]}`}>{ticket.status}</span>
                <span className={`${styles.priorityPill} ${styles[`priority${ticket.priority}`]}`}>{ticket.priority}</span>
              </div>
              <span className={styles.categoryTag}>{ticket.category}</span>
            </div>
            <h2 className={styles.subject}>{ticket.subject}</h2>

            {/* Thread */}
            <div className={styles.thread}>
              {MOCK_MESSAGES.map((msg, i) => (
                <div key={i} className={`${styles.message} ${styles[`msg${msg.from}`]}`}>
                  {msg.from === 'system' ? (
                    <div className={styles.systemMsg}>{msg.text}<span className={styles.msgTime}> · {msg.time}</span></div>
                  ) : (
                    <div className={styles.bubble}>
                      <div className={styles.bubbleText}>{msg.text}</div>
                      <div className={styles.bubbleTime}>{msg.time}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Reply box */}
            <div className={styles.replyBox}>
              <div className={styles.replyTabs}>
                <button className={`${styles.replyTab} ${activeTab === 'reply' ? styles.replyTabActive : ''}`} onClick={() => setActiveTab('reply')}>Reply</button>
                <button className={`${styles.replyTab} ${activeTab === 'notes' ? styles.replyTabActive : ''}`} onClick={() => setActiveTab('notes')}>Internal Notes</button>
              </div>
              {activeTab === 'reply' ? (
                <>
                  <div className={styles.templateRow}>
                    <button className={styles.templateBtn} onClick={() => setShowTemplates(s => !s)}>Use Template ▾</button>
                    {showTemplates && (
                      <div className={styles.templateDropdown}>
                        {TEMPLATES.map((t, i) => (
                          <button key={i} className={styles.templateItem} onClick={() => { setReply(t); setShowTemplates(false); }}>{t}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea
                    className={styles.replyTextarea}
                    rows={4}
                    placeholder="Type your reply…"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                  />
                  <div className={styles.replyFooter}>
                    <label className={styles.resolveCheck}>
                      <input type="checkbox" checked={resolveOnReply} onChange={e => setResolveOnReply(e.target.checked)} />
                      Also change status to: Resolved
                    </label>
                    <button className={styles.sendBtn} disabled={!reply.trim() || sending} onClick={handleSendReply}>
                      {sending ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    className={styles.replyTextarea}
                    rows={4}
                    placeholder="Internal note (only visible to admin team)…"
                    value={internalNote}
                    onChange={e => setInternalNote(e.target.value)}
                  />
                  <div className={styles.replyFooter}>
                    <div />
                    <button className={styles.noteBtn} disabled={!internalNote.trim() || sending} onClick={handleAddNote}>
                      {sending ? 'Saving…' : 'Add Note'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: context */}
        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Ticket Info</h3>
            <div className={styles.infoGrid}>
              <div><div className={styles.metaLabel}>Created</div><div className={styles.metaValue}>{ticket.created}</div></div>
              <div><div className={styles.metaLabel}>Last Activity</div><div className={styles.metaValue}>{ticket.lastActivity}</div></div>
              <div><div className={styles.metaLabel}>Assigned to</div>
                <div className={styles.assignedRow}>
                  <span className={ticket.assignedTo ? styles.metaValue : styles.unassigned}>{ticket.assignedTo || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Customer</h3>
            <div className={styles.infoGrid}>
              <div><div className={styles.metaLabel}>Name</div><div className={styles.metaValue}>{ticket.customer}</div></div>
              <div><div className={styles.metaLabel}>Phone</div><div className={styles.metaValue}>{ticket.phone}</div></div>
            </div>
            <button className={styles.linkBtn} onClick={() => navigate('/admin/users')}>View Full Profile →</button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Ticket Actions</h3>
            <div className={styles.actionList}>
              {ticket.status !== 'Resolved' && (
                <button className={styles.resolveBtn} onClick={() => handleStatusChange('Resolved')}>Resolve Ticket</button>
              )}
              {ticket.status !== 'Closed' && (
                <button className={styles.closeBtn} onClick={() => handleStatusChange('Closed')}>Close Ticket</button>
              )}
              {ticket.status === 'Closed' || ticket.status === 'Resolved' ? (
                <button className={styles.assignSelfBtn} onClick={() => handleStatusChange('Open')}>Reopen Ticket</button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
