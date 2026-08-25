import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supportApi, usersApi } from "../../api/adminApi";
import type { SupportTicket, AdminUser, SupportInbox } from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { StatusBadge } from "../../components";
import { useDialog } from "../../components/Modal/useDialog"; // [DSA-45-2]
import styles from "./SupportListPage.module.css";
import { PhoneCell } from "../../components/DataCells"; // ACP-3 [KA7-2]: masked by default
import {
  UilAngleLeft,
  UilAngleRight,
  UilPlus,
  UilSearch,
  UilTimes,
} from "@iconscout/react-unicons";
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const LIMIT = 25;

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return dv;
}

const priorityCss: Record<string, string> = {
  High: "priorityHigh",
  Medium: "priorityMedium",
  Low: "priorityLow",
};
// Map the ticket display status to the canonical StatusBadge key (tone + wording).
const TICKET_KEY: Record<string, string> = {
  Open: "open",
  "In Progress": "in_progress",
  Resolved: "resolved",
  Closed: "closed",
};

export const SupportListPage: React.FC = () => {
  const navigate = useNavigate();
  // G-43: seed search from ?search= so "View All Tickets" from a customer profile
  // lands filtered to that customer.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const [page, setPage] = React.useState(1);
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  // T2-30 (SP-3): the inbox worklist. Shown when NOT searching; a non-empty search
  // falls back to the flat cross-status results table below.
  const [inbox, setInbox] = React.useState<SupportInbox | null>(null);
  const [inboxError, setInboxError] = React.useState("");
  const [bucket, setBucket] = React.useState<
    "all" | "needs_reply" | "waiting" | "resolved"
  >("all");
  const searching = debouncedSearch.trim().length > 0;

  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    customerName: "",
    customerPhone: "",
    subject: "",
    category: "General",
    priority: "Medium",
    message: "",
  });

  // Customer search in create modal
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [customerResults, setCustomerResults] = React.useState<AdminUser[]>([]);

  // [DSA-45-2] Hand-rolled overlays get <Modal>'s behaviour without its markup: focus moves
  // in, Tab is trapped, Escape closes, focus returns to whatever opened it, and a screen
  // reader is told this is a dialog. Declared here, ABOVE the early returns — a hook placed
  // after one stops being called the moment the page is loading.
  const createTicketDialog = useDialog(
    showCreate,
    () => setShowCreate(false),
    'Create support ticket',
  );
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<AdminUser | null>(null);
  const debouncedCustomerSearch = useDebounce(customerSearch, 350);

  const setF = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const dismissToast = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    if (debouncedCustomerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    usersApi
      .list({ search: debouncedCustomerSearch, limit: 6 })
      .then((r) => setCustomerResults(r.users))
      .catch(() => {});
  }, [debouncedCustomerSearch]);

  // Flat search-results table — only while a search term is active.
  React.useEffect(() => {
    if (!searching) return;
    setLoading(true);
    setError("");
    supportApi
      .list({
        search: debouncedSearch || undefined,
        page,
        limit: LIMIT,
      })
      .then((r) => {
        setTickets(r.tickets);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load";
        setError(msg);
        showToast("error", "Load failed", msg);
      })
      .finally(() => setLoading(false));
  }, [searching, debouncedSearch, page]);

  // The inbox worklist — loaded when not searching.
  const loadInbox = React.useCallback(() => {
    setLoading(true);
    setInboxError("");
    supportApi
      .inbox()
      .then(setInbox)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load inbox";
        setInboxError(msg);
        showToast("error", "Load failed", msg);
      })
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => {
    if (searching) return;
    loadInbox();
  }, [searching, loadInbox]);

  const handleCreate = async () => {
    if (!form.customerName || !form.subject || !form.message) {
      showToast(
        "error",
        "Required fields missing",
        "Please fill in customer name, subject, and initial message.",
      );
      return;
    }
    setCreating(true);
    try {
      const newTicket = await supportApi.create({
        customer_name: form.customerName,
        customer_phone: form.customerPhone,
        // Link to the looked-up customer so the ticket's CX levers work.
        ...(selectedCustomer ? { user_id: selectedCustomer.id } : {}),
        subject: form.subject,
        category: form.category,
        priority: form.priority,
        messages: [
          {
            sender: "admin",
            body: form.message,
            timestamp: new Date().toISOString(),
          },
        ],
      });
      setTickets((prev) => [newTicket, ...prev]);
      if (!searching) loadInbox(); // reflect the new ticket in the inbox worklist
      setShowCreate(false);
      setForm({
        customerName: "",
        customerPhone: "",
        subject: "",
        category: "General",
        priority: "Medium",
        message: "",
      });
      setSelectedCustomer(null);
      setCustomerSearch("");
      showToast(
        "success",
        "Ticket created",
        `Ticket #${newTicket.id} created successfully.`,
      );
    } catch (e) {
      showToast(
        "error",
        "Failed to create ticket",
        e instanceof Error ? e.message : "Unknown error",
      );
    } finally {
      setCreating(false);
    }
  };

  const counts = inbox?.counts ?? { needs_reply: 0, waiting: 0, resolved: 0 };

  // SLA chip: red breach >24h, amber warning 8–24h, plain label under 8h.
  const slaChip = (hours?: number) => {
    if (hours == null) return null;
    const cls =
      hours > 24 ? styles.slaRed : hours >= 8 ? styles.slaAmber : styles.slaPlain;
    const label = hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`;
    return <span className={`${styles.slaChip} ${cls}`}>{label}</span>;
  };

  const ticketRow = (t: SupportTicket, showSla: boolean) => (
    <tr
      key={t.id}
      className={`${styles.row} ${!t.assignedTo ? styles.rowUnassigned : ""}`}
       {...rowActivation(() => navigate(`/admin/support/${t.id}`))}>
      <td className={styles.ticketId}>
        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
          {t.reference_id ?? t.id.slice(0, 8)}
        </span>
      </td>
      <td>
        <div className={styles.customerName}>{t.customer}</div>
        <div className={styles.customerPhone}><PhoneCell phone={t.phone} /></div>
      </td>
      <td className={styles.subject}>
        {t.subject}
        {t.snoozeUntil &&
          (new Date(t.snoozeUntil).getTime() > Date.now() ? (
            <span className={`${styles.snoozeChip} ${styles.snoozeParked}`}>
              Snoozed ·{" "}
              {new Date(t.snoozeUntil).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
          ) : (
            <span className={`${styles.snoozeChip} ${styles.snoozeDue}`}>
              Follow-up due
            </span>
          ))}
      </td>
      <td>
        <span
          className={`${styles.priorityPill} ${styles[priorityCss[t.priority]]}`}
        >
          {t.priority}
        </span>
      </td>
      <td>{showSla ? (slaChip(t.waitingHours) ?? "—") : t.lastActivity}</td>
      <td className={t.assignedTo ? "" : styles.unassigned}>
        {t.assignedTo ?? "— Unassigned"}
      </td>
    </tr>
  );

  const inboxSection = (
    key: "needs_reply" | "waiting" | "resolved",
    title: string,
    list: SupportTicket[],
  ) => (
    <section className={styles.section} key={key}>
      <h2 className={styles.sectionTitle}>
        {title}
        <span className={styles.sectionCount}>{counts[key]}</span>
      </h2>
      {list.length === 0 ? (
        <div className={styles.sectionEmpty}>Nothing here — inbox zero.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Customer</th>
                <th>Subject</th>
                <th>Priority</th>
                <th>{key === "needs_reply" ? "Waiting" : "Last activity"}</th>
                <th>Assigned To</th>
              </tr>
            </thead>
            <tbody>{list.map((t) => ticketRow(t, key === "needs_reply"))}</tbody>
          </table>
        </div>
      )}
    </section>
  );

  const TABS: {
    key: "all" | "needs_reply" | "waiting" | "resolved";
    label: string;
  }[] = [
    { key: "all", label: "All" },
    { key: "needs_reply", label: "Needs reply" },
    { key: "waiting", label: "Waiting on customer" },
    { key: "resolved", label: "Resolved · 7d" },
  ];

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Support Tickets</h1>
        <button
          className={styles.addBtn ?? styles.exportBtn}
          onClick={() => setShowCreate(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--green)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "0.8125rem",
            fontFamily: "inherit",
          }}
        >
          <UilPlus size={14} /> Create Ticket
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search ticket ID or customer…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {searching && (
          <button
            className={styles.clearBtn}
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
          >
            <UilTimes size={14} /> Clear search
          </button>
        )}
      </div>

      {searching ? (
        // ── Flat cross-status search results ──
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Customer</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j}>
                          <div className={styles.skeleton} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
                      {error}
                      <br />
                      <button
                        className={styles.retryBtn}
                        onClick={() => setPage(1)}
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.empty}>
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      className={`${styles.row} ${!t.assignedTo ? styles.rowUnassigned : ""}`}
                       {...rowActivation(() => navigate(`/admin/support/${t.id}`))}>
                      <td className={styles.ticketId}>
                        <span
                          style={{ fontFamily: "monospace", fontWeight: 600 }}
                        >
                          {t.reference_id ?? t.id.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.customerName}>{t.customer}</div>
                        <div className={styles.customerPhone}><PhoneCell phone={t.phone} /></div>
                      </td>
                      <td className={styles.subject}>{t.subject}</td>
                      <td>{t.category}</td>
                      <td>
                        <span
                          className={`${styles.priorityPill} ${styles[priorityCss[t.priority]]}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          status={TICKET_KEY[t.status] ?? t.status}
                          label={t.status}
                        />
                      </td>
                      <td className={t.assignedTo ? "" : styles.unassigned}>
                        {t.assignedTo ?? "— Unassigned"}
                      </td>
                      <td className={styles.date}>{t.lastActivity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.paginationRow}>
            <span className={styles.pagination}>
              {loading
                ? "Loading…"
                : `${total} ticket${total !== 1 ? "s" : ""} found`}
            </span>
            <div className={styles.pageButtons}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                <UilAngleLeft size={15} /> Prev
              </button>
              <span className={styles.pageIndicator}>
                Page {page} of {totalPages || 1}
              </span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <UilAngleRight size={15} />
              </button>
            </div>
          </div>
        </>
      ) : (
        // ── Inbox worklist: bucket tabs + stacked sections ──
        <>
          <div className={styles.tabBar}>
            {TABS.map((tb) => (
              <button
                key={tb.key}
                className={`${styles.tab} ${bucket === tb.key ? styles.tabActive : ""}`}
                onClick={() => setBucket(tb.key)}
              >
                {tb.label}
                {tb.key !== "all" && (
                  <span className={styles.tabCount}>{counts[tb.key]}</span>
                )}
              </button>
            ))}
          </div>

          {loading && !inbox ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}>
                          <div className={styles.skeleton} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : inboxError ? (
            <div className={styles.sectionEmpty}>
              {inboxError}
              <br />
              <button className={styles.retryBtn} onClick={loadInbox}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {(bucket === "all" || bucket === "needs_reply") &&
                inboxSection(
                  "needs_reply",
                  "Needs reply",
                  inbox?.needs_reply ?? [],
                )}
              {(bucket === "all" || bucket === "waiting") &&
                inboxSection(
                  "waiting",
                  "Waiting on customer",
                  inbox?.waiting ?? [],
                )}
              {(bucket === "all" || bucket === "resolved") &&
                inboxSection(
                  "resolved",
                  "Resolved · last 7 days",
                  inbox?.resolved ?? [],
                )}
            </>
          )}
        </>
      )}

      {showCreate && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowCreate(false)}
        >
          <div className={styles.modal} {...createTicketDialog.dialogProps} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Create Support Ticket</h2>
            <div className={styles.fields}>
              {/* Customer: search existing or enter manually */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Customer</label>
                {selectedCustomer ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      border: "1.5px solid var(--color-primary)",
                      borderRadius: 8,
                      background: "var(--color-bg-primary)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                        {selectedCustomer.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-tertiary)",
                        }}
                      >
                        {selectedCustomer.phone}
                      </div>
                    </div>
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--color-text-secondary)",
                      }}
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                        setF("customerName", "");
                        setF("customerPhone", "");
                      }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <input
                        className={styles.fieldInput}
                        placeholder="Search by name/phone…"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                      {customerResults.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            zIndex: 50,
                            background: "var(--color-bg-primary)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          {customerResults.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => {
                                setSelectedCustomer(u);
                                setF("customerName", u.name);
                                setF("customerPhone", u.phone);
                                setCustomerSearch("");
                                setCustomerResults([]);
                              }}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                width: "100%",
                                padding: "8px 12px",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                textAlign: "left",
                                gap: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 500,
                                  fontSize: "0.875rem",
                                }}
                              >
                                {u.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "var(--color-text-tertiary)",
                                }}
                              >
                                {u.phone}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      className={styles.fieldInput}
                      value={form.customerName}
                      onChange={(e) => setF("customerName", e.target.value)}
                      placeholder="Or enter name manually *"
                    />
                    <input
                      className={styles.fieldInput}
                      value={form.customerPhone}
                      onChange={(e) => setF("customerPhone", e.target.value)}
                      placeholder="Phone (optional)"
                      style={{ gridColumn: "1 / -1" }}
                    />
                  </div>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Subject *</label>
                <input
                  className={styles.fieldInput}
                  value={form.subject}
                  onChange={(e) => setF("subject", e.target.value)}
                  placeholder="Issue summary"
                />
              </div>
              <div
                className={styles.fieldRow}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Category</label>
                  <select
                    className={styles.fieldSelect}
                    value={form.category}
                    onChange={(e) => setF("category", e.target.value)}
                  >
                    <option>General</option>
                    <option>Order Issue</option>
                    <option>Return/Refund</option>
                    <option>Technical Support</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Priority</label>
                  <select
                    className={styles.fieldSelect}
                    value={form.priority}
                    onChange={(e) => setF("priority", e.target.value)}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Initial Message *</label>
                <textarea
                  className={styles.fieldTextarea}
                  rows={4}
                  value={form.message}
                  onChange={(e) => setF("message", e.target.value)}
                  placeholder="Describe the issue..."
                ></textarea>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className={styles.addBtn}
                onClick={handleCreate}
                disabled={creating}
                style={{ opacity: creating ? 0.7 : 1 }}
              >
                {creating ? "Creating..." : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
