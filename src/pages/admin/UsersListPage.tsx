import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usersApi } from "../../api/adminApi";
import type { AdminUser } from "../../api/adminApi";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import { StatusBadge } from "../../components";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./UsersListPage.module.css";
import { CustomerNameCell } from "../../components/DataCells"; // [KA7-15] DPDP tombstone
import {
  UilAngleLeft,
  UilAngleRight,
  UilImport,
  UilSearch,
  UilTimes,
} from "@iconscout/react-unicons";

const LIMIT = 25;

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setDv(v), d);
    return () => clearTimeout(t);
  }, [v, d]);
  return dv;
}

export const UsersListPage: React.FC = () => {
  const navigate = useNavigate();
  // G-43: seed search from ?search= so deep-links (e.g. "View Full Profile" from a
  // ticket) land filtered to the right customer instead of the bare list.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [exporting, setExporting] = React.useState(false);
  const [confirmExport, setConfirmExport] = React.useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const dismissToast = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true);
    setError("");
    usersApi
      .list({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
        limit: LIMIT,
      })
      .then((r) => {
        setUsers(r.users);
        setTotal(r.total);
        setTotalPages(r.totalPages);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load";
        setError(msg);
        showToast("error", "Load failed", msg);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, page]);

  // Exports ALL customers matching the current filters (not just the current page).
  // full=true pulls UNMASKED contact PII — the server audits this as a deliberate
  // bulk-PII export (G-97). Gated behind a confirm so it's never a stray one-click dump.
  const exportCSV = async () => {
    if (exporting) return;
    setConfirmExport(false);
    setExporting(true);
    try {
      // [SCA-44-2] One request. This was `for (let p = 1; p <= 500; p++)` fetching 100
      // rows at a time — 500 sequential round trips at 50k customers, each re-running
      // the list query with a growing OFFSET that Postgres serves by scanning and
      // discarding, with the whole result set held in this tab before the file was
      // written. The server builds the file in one pass and writes ONE audit row
      // saying what left, instead of 500.
      await usersApi.exportCsv({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      showToast(
        "success",
        "Export ready",
        "The customer export has been downloaded.",
      );
    } catch {
      showToast(
        "error",
        "Export failed",
        "Could not export customers. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Customers</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={styles.exportBtn}
            onClick={() => setConfirmExport(true)}
            disabled={exporting}
          >
            <UilImport size={14} /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <UilSearch size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Deactivated">Deactivated</option>
        </select>
        <button
          className={styles.clearBtn}
          onClick={() => {
            setSearch("");
            setStatusFilter("");
            setPage(1);
          }}
        >
          <UilTimes size={14} /> Clear
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ref</th>
              {/* [KA7-14] Phone before Name. 27 of 110 cells were em-dashes, with
                  NAME/EMAIL/CITY blank on 11 of 13 rows — real OTP-only customers,
                  so the data is honestly absent. The column that IDENTIFIES them
                  should lead; the one that often cannot should follow. */}
              <th>Phone</th>
              <th>Name</th>
              <th>Email</th>
              <th>City</th>
              <th>Orders</th>
              <th>LTV</th>
              <th>Credits</th>
              <th>Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j}>
                      <div className={styles.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={10} className={styles.empty}>
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
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  No customers found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className={styles.row}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                 tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === "Enter") (() => navigate(`/admin/users/${u.id}`))?.(); }}>
                  <td
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.reference_id ?? "—"}
                  </td>
                  <td className={styles.phone}>{u.phone}</td>
                  {/* [KA7-15] An erased customer is a TOMBSTONE, not a person named
                      "Deleted customer" at the same weight as a real name. */}
                  <td className={styles.userName}><CustomerNameCell name={u.name} /></td>
                  <td className={styles.email}>{u.email || "—"}</td>
                  <td>{u.city || "—"}</td>
                  <td className={styles.orders}>{u.orders}</td>
                  <td className={styles.credits}>₹{u.ltv?.toLocaleString("en-IN")}</td>
                  <td className={styles.credits}>
                    ₹{u.credits?.toLocaleString("en-IN")}
                  </td>
                  <td className={styles.date}>{u.joined}</td>
                  <td>
                    <StatusBadge status={u.status === "Active" ? 'active' : 'inactive'} label={u.status} />
                  </td>
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
            : `${total} customer${total !== 1 ? "s" : ""} total`}
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

      <ConfirmDialog
        open={confirmExport}
        title="Export customer contact details?"
        message={`This downloads the full name, phone and email for ${total} customer${total === 1 ? "" : "s"} matching the current filters. Bulk exports of personal data are recorded in the audit log.`}
        confirmLabel="Export CSV"
        loading={exporting}
        onConfirm={exportCSV}
        onCancel={() => setConfirmExport(false)}
      />
    </div>
  );
};

export default UsersListPage;
