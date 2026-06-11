import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supportApi, ordersApi } from "../../api/adminApi";
import type {
  SupportTicket,
  TicketMessage,
  AdminOrder,
} from "../../api/adminApi";
import { catalogApi } from "../../api/catalogApi";
import type { AdminUser } from "../../api/catalogApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { useBreadcrumbTitle } from "../../contexts/BreadcrumbContext";
import styles from "./TicketDetailPage.module.css";
import {
  UilAngleDown,
  UilAngleLeft,
  UilAngleUp,
  UilBox,
  UilCommentAlt,
  UilMessage,
  UilNotes,
  UilSearch,
  UilUserCheck,
} from "@iconscout/react-unicons";

const TEMPLATES = [
  "Thank you for reaching out to Zavestro support.",
  "We've reviewed your order and are looking into this.",
  "Your refund has been processed and will reflect in 3–5 days.",
  "I'll escalate this to our operations team right away.",
];

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = React.useState<SupportTicket | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [reply, setReply] = React.useState("");
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [resolveOnReply, setResolveOnReply] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"reply" | "notes">("reply");
  const [internalNote, setInternalNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [adminUsers, setAdminUsers] = React.useState<AdminUser[]>([]);
  const [selectedAssignee, setSelectedAssignee] = React.useState<string>("");
  const [assigning, setAssigning] = React.useState(false);

  // Order lookup
  const [orderQuery, setOrderQuery] = React.useState("");
  const [orderResults, setOrderResults] = React.useState<AdminOrder[]>([]);
  const [orderSearching, setOrderSearching] = React.useState(false);

  const dismissToast = (tid: string) =>
    setToasts((t) => t.filter((x) => x.id !== tid));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  useBreadcrumbTitle(ticket?.subject);

  React.useEffect(() => {
    catalogApi
      .listAdminUsers()
      .then(setAdminUsers)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    supportApi
      .get(id)
      .then((t) => {
        setTicket(t);
        setSelectedAssignee(t.assignedTo ?? "");
        if (t.phone) setOrderQuery(t.phone);
      })
      .catch((e) =>
        showToast(
          "error",
          "Failed to load ticket",
          e instanceof Error ? e.message : undefined,
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => {
    if (orderQuery.trim().length < 3) {
      setOrderResults([]);
      return;
    }
    const t = setTimeout(() => {
      setOrderSearching(true);
      ordersApi
        .list({ search: orderQuery.trim(), limit: 6 })
        .then((r) => setOrderResults(r.orders))
        .catch(() => setOrderResults([]))
        .finally(() => setOrderSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [orderQuery]);

  const handleAssign = async () => {
    if (!ticket) return;
    setAssigning(true);
    try {
      const updated = await supportApi.assign(
        ticket.id,
        selectedAssignee || null,
      );
      setTicket(updated);
      setSelectedAssignee(updated.assignedTo ?? "");
      showToast(
        "success",
        selectedAssignee ? "Ticket assigned" : "Assignment removed",
      );
    } catch (e) {
      showToast(
        "error",
        "Failed to assign",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleSendReply = async () => {
    if (!ticket || !reply.trim()) return;
    setSending(true);
    try {
      await supportApi.addReply(ticket.id, reply.trim(), false);
      if (resolveOnReply) {
        const updated = await supportApi.update(ticket.id, {
          status: "Resolved",
        });
        setTicket(updated);
      }
      setReply("");
      showToast("success", "Reply sent");
    } catch (e) {
      showToast(
        "error",
        "Failed to send",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setSending(false);
    }
  };

  const handleAddNote = async () => {
    if (!ticket || !internalNote.trim()) return;
    setSending(true);
    try {
      await supportApi.addReply(ticket.id, internalNote.trim(), true);
      setInternalNote("");
      showToast("success", "Note added");
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: SupportTicket["status"]) => {
    if (!ticket) return;
    try {
      const updated = await supportApi.update(ticket.id, { status });
      setTicket(updated);
      showToast("success", `Ticket ${status.toLowerCase()}`);
    } catch (e) {
      showToast("error", "Failed", e instanceof Error ? e.message : undefined);
    }
  };

  if (loading)
    return (
      <div className={styles.page}>
        <div>Loading ticket…</div>
      </div>
    );
  if (!ticket)
    return (
      <div className={styles.page}>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/admin/support")}
        >
          <UilAngleLeft size={15} /> Back
        </button>
        <div>Ticket not found.</div>
      </div>
    );

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <button
        className={styles.backBtn}
        onClick={() => navigate("/admin/support")}
      >
        <UilAngleLeft size={15} /> Back to Tickets
      </button>

      <div className={styles.twoCol}>
        {/* Left: chat */}
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.ticketHeader}>
              <div className={styles.headerLeft}>
                <span className={styles.ticketId}>{ticket.id}</span>
                <span
                  className={`${styles.statusPill} ${styles[`status${ticket.status.replace(" ", "")}`]}`}
                >
                  {ticket.status}
                </span>
                <span
                  className={`${styles.priorityPill} ${styles[`priority${ticket.priority}`]}`}
                >
                  {ticket.priority}
                </span>
              </div>
              <span className={styles.categoryTag}>{ticket.category}</span>
            </div>
            <h2 className={styles.subject}>{ticket.subject}</h2>

            {/* Thread */}
            <div className={styles.thread}>
              {(ticket.messages ?? []).length === 0 ? (
                <div className={styles.systemMsg}>No messages yet.</div>
              ) : (
                (ticket.messages ?? []).map((msg: TicketMessage) => (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${styles[`msg${msg.sender_type}`]}`}
                  >
                    {msg.sender_type === "system" ? (
                      <div className={styles.systemMsg}>
                        {msg.body}
                        <span className={styles.msgTime}>
                          {" "}
                          ·{" "}
                          {new Date(msg.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ) : (
                      <div className={styles.bubble}>
                        <div className={styles.bubbleText}>{msg.body}</div>
                        <div className={styles.bubbleTime}>
                          {new Date(msg.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Reply box */}
            <div className={styles.replyBox}>
              <div className={styles.replyTabs}>
                <button
                  className={`${styles.replyTab} ${activeTab === "reply" ? styles.replyTabActive : ""}`}
                  onClick={() => setActiveTab("reply")}
                >
                  <UilCommentAlt size={13} /> Reply
                </button>
                <button
                  className={`${styles.replyTab} ${activeTab === "notes" ? styles.replyTabActive : ""}`}
                  onClick={() => setActiveTab("notes")}
                >
                  <UilNotes size={13} /> Internal Notes
                </button>
              </div>
              {activeTab === "reply" ? (
                <>
                  <div className={styles.templateRow}>
                    <button
                      className={styles.templateBtn}
                      onClick={() => setShowTemplates((s) => !s)}
                    >
                      Use Template{" "}
                      {showTemplates ? (
                        <UilAngleUp size={12} />
                      ) : (
                        <UilAngleDown size={12} />
                      )}
                    </button>
                    {showTemplates && (
                      <div className={styles.templateDropdown}>
                        {TEMPLATES.map((t, i) => (
                          <button
                            key={i}
                            className={styles.templateItem}
                            onClick={() => {
                              setReply(t);
                              setShowTemplates(false);
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea
                    className={styles.replyTextarea}
                    rows={4}
                    placeholder="Type your reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className={styles.replyFooter}>
                    <label className={styles.resolveCheck}>
                      <input
                        type="checkbox"
                        checked={resolveOnReply}
                        onChange={(e) => setResolveOnReply(e.target.checked)}
                      />
                      Also change status to: Resolved
                    </label>
                    <button
                      className={styles.sendBtn}
                      disabled={!reply.trim() || sending}
                      onClick={handleSendReply}
                    >
                      <UilMessage size={14} />{" "}
                      {sending ? "Sending…" : "Send Reply"}
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
                    onChange={(e) => setInternalNote(e.target.value)}
                  />
                  <div className={styles.replyFooter}>
                    <div />
                    <button
                      className={styles.noteBtn}
                      disabled={!internalNote.trim() || sending}
                      onClick={handleAddNote}
                    >
                      {sending ? "Saving…" : "Add Note"}
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
              <div>
                <div className={styles.metaLabel}>Created</div>
                <div className={styles.metaValue}>{ticket.created}</div>
              </div>
              <div>
                <div className={styles.metaLabel}>Last Activity</div>
                <div className={styles.metaValue}>{ticket.lastActivity}</div>
              </div>
              <div>
                <div className={styles.metaLabel}>Assigned to</div>
                <div
                  className={styles.assignedRow}
                  style={{
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 6,
                  }}
                >
                  {(() => {
                    const current = adminUsers.find(
                      (u) => u.id === ticket.assignedTo,
                    );
                    return (
                      <span
                        className={
                          current ? styles.metaValue : styles.unassigned
                        }
                        style={{ marginBottom: 4 }}
                      >
                        {current ? current.name : "Unassigned"}
                      </span>
                    );
                  })()}
                  <select
                    className={styles.fieldSelect}
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                  >
                    <option value="">— Unassign —</option>
                    {adminUsers
                      .filter((u) => u.is_active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className={styles.assignSelfBtn}
                    disabled={assigning}
                    onClick={handleAssign}
                    style={{ marginTop: 2 }}
                  >
                    <UilUserCheck
                      size={14}
                      style={{ marginRight: 6, verticalAlign: "middle" }}
                    />
                    {assigning ? "Saving…" : "Assign"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Customer</h3>
            <div className={styles.infoGrid}>
              <div>
                <div className={styles.metaLabel}>Name</div>
                <div className={styles.metaValue}>{ticket.customer}</div>
              </div>
              <div>
                <div className={styles.metaLabel}>Phone</div>
                <div className={styles.metaValue}>{ticket.phone}</div>
              </div>
            </div>
            <button
              className={styles.linkBtn}
              onClick={() =>
                navigate(
                  `/admin/users${ticket.phone ? `?search=${encodeURIComponent(ticket.phone)}` : ""}`,
                )
              }
            >
              View Full Profile →
            </button>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Ticket Actions</h3>
            <div className={styles.actionList}>
              {ticket.status !== "Resolved" && (
                <button
                  className={styles.resolveBtn}
                  onClick={() => handleStatusChange("Resolved")}
                >
                  Resolve Ticket
                </button>
              )}
              {ticket.status !== "Closed" && (
                <button
                  className={styles.closeBtn}
                  onClick={() => handleStatusChange("Closed")}
                >
                  Close Ticket
                </button>
              )}
              {ticket.status === "Closed" || ticket.status === "Resolved" ? (
                <button
                  className={styles.assignSelfBtn}
                  onClick={() => handleStatusChange("Open")}
                >
                  Reopen Ticket
                </button>
              ) : null}
            </div>
          </div>

          {/* ── Order Lookup ─────────────────────────────────────────────── */}
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>Order Lookup</h3>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <UilSearch
                size={13}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-text-tertiary)",
                  pointerEvents: "none",
                }}
              />
              <input
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 36,
                  paddingLeft: 30,
                  paddingRight: 10,
                  border: "1.5px solid var(--color-border)",
                  borderRadius: 6,
                  background: "var(--color-bg-primary)",
                  color: "var(--color-text-primary)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  outline: "none",
                }}
                placeholder="ZO-##### · ZC-##### · phone…"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
              />
            </div>
            {orderSearching && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-tertiary)",
                  marginBottom: 8,
                }}
              >
                Searching…
              </div>
            )}
            {!orderSearching &&
              orderQuery.length >= 3 &&
              orderResults.length === 0 && (
                <div
                  style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}
                >
                  No orders found.
                </div>
              )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {orderResults.map((o) => (
                <div
                  key={o.id}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--color-border-light)",
                    borderRadius: 6,
                    background: "var(--color-bg-secondary)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <UilBox
                      size={12}
                      style={{
                        color: "var(--color-text-tertiary)",
                        flexShrink: 0,
                      }}
                    />
                    {o.reference_id ? (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--color-primary)",
                        }}
                      >
                        {o.reference_id}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "var(--color-text-tertiary)",
                        }}
                      >
                        {o.id}
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        padding: "1px 7px",
                        borderRadius: 10,
                        fontWeight: 600,
                        background: "var(--color-bg-primary)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {o.stage.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                      marginBottom: 4,
                    }}
                  >
                    {o.customer} · ₹{o.total.toLocaleString("en-IN")} ·{" "}
                    {o.created}
                  </div>
                  <button
                    className={styles.linkBtn}
                    onClick={() => navigate(`/admin/orders/${o.uuid ?? o.id}`)}
                  >
                    View Order →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
