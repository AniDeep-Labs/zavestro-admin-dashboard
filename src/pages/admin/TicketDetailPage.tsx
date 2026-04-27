import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supportTickets } from '../../data/adminMockData';
import styles from './TicketDetailPage.module.css';

const messages = [
  { from: 'customer', text: "Hi, my order ZAV-20260413-003421 hasn't been updated in 5 days. It still shows 'in tailoring'. Can you help?", time: '2h ago' },
  { from: 'system', text: 'Ticket assigned to Aarti S.', time: '1h 50m ago' },
  { from: 'agent', text: "Hi Suraj! I've checked your order and I can see it's currently with our tailor team. I'll escalate this right away and get you an update within the hour.", time: '1h 30m ago' },
  { from: 'customer', text: "Thank you! Really appreciate it. I have an event this weekend so I'm worried.", time: '1h 15m ago' },
];

const templates = [
  'Thank you for reaching out to Zavestro support.',
  "We've reviewed your order and are looking into this.",
  'Your refund has been processed and will reflect in 3–5 days.',
  "I'll escalate this to our operations team right away.",
];

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reply, setReply] = React.useState('');
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [resolveOnReply, setResolveOnReply] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'reply' | 'notes'>('reply');
  const [internalNote, setInternalNote] = React.useState('');

  const ticket = supportTickets.find(t => t.id === id) || supportTickets[0];

  return (
    <div className={styles.page}>
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
              {messages.map((msg, i) => (
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
                        {templates.map((t, i) => (
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
                    <button className={styles.sendBtn} disabled={!reply}>Send Reply</button>
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
                    <button className={styles.noteBtn} disabled={!internalNote}>Add Note</button>
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
              <div><div className={styles.metaLabel}>Priority</div>
                <select className={styles.inlineSelect}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div><div className={styles.metaLabel}>Assigned to</div>
                <div className={styles.assignedRow}>
                  <span className={ticket.assignedTo ? styles.metaValue : styles.unassigned}>{ticket.assignedTo || 'Unassigned'}</span>
                  <button className={styles.reassignBtn}>Reassign</button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Customer</h3>
            <div className={styles.infoGrid}>
              <div><div className={styles.metaLabel}>Name</div><div className={styles.metaValue}>{ticket.customer}</div></div>
              <div><div className={styles.metaLabel}>Phone</div><div className={styles.metaValue}>{ticket.phone}</div></div>
              <div><div className={styles.metaLabel}>Status</div><div className={styles.metaValue}>Active</div></div>
              <div><div className={styles.metaLabel}>Total Orders</div><div className={styles.metaValue}>5</div></div>
              <div><div className={styles.metaLabel}>Credits</div><div className={styles.metaValue}>₹150</div></div>
            </div>
            <button className={styles.linkBtn} onClick={() => navigate('/admin/users')}>View Full Profile →</button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Linked Order</h3>
            <div className={styles.infoGrid}>
              <div><div className={styles.metaLabel}>Order #</div><div className={styles.metaValue}>ZAV-20260413-003421</div></div>
              <div><div className={styles.metaLabel}>Mode</div><div className={styles.metaValue}>Simplified</div></div>
              <div><div className={styles.metaLabel}>Stage</div><div className={styles.metaValue}>In Tailoring</div></div>
              <div><div className={styles.metaLabel}>Total</div><div className={styles.metaValue}>₹1,599</div></div>
            </div>
            <button className={styles.linkBtn} onClick={() => navigate('/admin/orders/ZAV-20260413-003421')}>View Order →</button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Ticket Actions</h3>
            <div className={styles.actionList}>
              <button className={styles.assignSelfBtn}>Assign to me</button>
              <button className={styles.resolveBtn}>Resolve Ticket</button>
              <button className={styles.closeBtn}>Close Ticket</button>
              <button className={styles.escalateBtn}>Escalate</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
