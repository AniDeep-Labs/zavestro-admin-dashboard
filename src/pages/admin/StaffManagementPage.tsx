import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useHubContextFilter } from "../../utils/useHubContextFilter"; // [SHL-3-8]
import { staffApi, hubsApi } from "../../api/adminApi";
import type { StaffMember, StaffRole, Hub } from "../../api/adminApi";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { Modal } from "../../components/Modal/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PeekDrawer } from "../../components/PeekDrawer/PeekDrawer";
import { CopyId } from "../../components/DataCells/DataCells";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import base from "./OrdersListPage.module.css";
import ov from "./OverviewExceptions.module.css";
import { UilPlus } from "@iconscout/react-unicons";
import { StatusBadge } from "../../components";
import { rowActivation } from "../../utils/rowActivation"; // [DSA-45-1]

const ROLE_LABELS: Record<StaffRole, string> = {
  hub_manager: "Hub Manager",
  cutting_master: "Cutting Master",
  measurement_agent: "Measurement Agent",
  tailor: "Tailor",
  qc_staff: "QC Staff",
  dispatch: "Dispatch",
};
const ROLES = Object.keys(ROLE_LABELS) as StaffRole[];

const EMPTY = {
  name: "",
  email: "",
  password: "",
  role: "tailor" as StaffRole,
  hub_id: "",
};

export const StaffManagementPage: React.FC<{ autoNew?: boolean }> = ({ autoNew }) => {
  const [staff, setStaff] = React.useState<StaffMember[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  // [SHL-3-8] Defaults to the header hub switcher and follows it. Was React.useState(''),
  // so the global control changed nothing on this page while claiming to.
  const [hubFilter, setHubFilter] = useHubContextFilter();
  const [roleFilter, setRoleFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  // [SHL-3-10] Quick-create (+) pointed at the LIST page ("New staff" landed on Ops Staff,
  // not a create form), leaving the operator to hunt for the real control. It deep-links to
  // /new now, and per [DSG-10-3] the deep-linked modal's open state is the URL: closing
  // returns to the list and browser-back closes it rather than leaving the page.
  const navigate = useNavigate();
  const location = useLocation();
  const openCreate = () => { setForm(EMPTY); setErrors({}); setOpen(true); };
  const closeEditor = () => {
    setOpen(false);
    if (location.pathname.endsWith("/new")) navigate("/admin/system/staff", { replace: true });
  };
  const armed = React.useRef(false);
  React.useEffect(() => {
    if (autoNew && !armed.current) { armed.current = true; openCreate(); }
    if (!autoNew) armed.current = false;
  }, [autoNew]);
  const [form, setForm] = React.useState(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [actingId, setActingId] = React.useState("");
  const [confirm, setConfirm] = React.useState<null | {
    title: string;
    message: React.ReactNode;
    label: string;
    variant?: "primary" | "danger";
    run: () => Promise<void>;
  }>(null);
  const [confirming, setConfirming] = React.useState(false);
  // T2-26 (SU-9): inline create errors + peek drawer + reset-password result.
  const [errors, setErrors] = React.useState<{ name?: string; email?: string; password?: string }>({});
  const [peek, setPeek] = React.useState<StaffMember | null>(null);
  const [resetResult, setResetResult] = React.useState<{ token: string; expires_at: string; email: string } | null>(null);
  const [resetting, setResetting] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = (id: string) =>
    setToasts((t) => t.filter((x) => x.id !== id));
  const toast = (type: ToastData["type"], title: string, msg?: string) =>
    setToasts((t) => [...t, createToast(type, title, msg)]);

  const load = React.useCallback(() => {
    setLoading(true);
    staffApi
      .list(hubFilter || undefined)
      .then(setStaff)
      .catch((e) =>
        toast(
          "error",
          "Load failed",
          e instanceof Error ? e.message : undefined,
        ),
      )
      .finally(() => setLoading(false));
  }, [hubFilter]);

  React.useEffect(() => {
    load();
  }, [load]);
  React.useEffect(() => {
    hubsApi
      .list()
      .then((r) => setHubs(r.hubs))
      .catch(() => {
        /* hub filter optional */
      });
  }, []);

  const visible = roleFilter
    ? staff.filter((s) => s.role === roleFilter)
    : staff;

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const create = async () => {
    // T2-26 (SU-9): inline field errors instead of a generic toast.
    const e: { name?: string; email?: string; password?: string } = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email";
    if (!form.password) e.password = "Temporary password is required";
    else if (form.password.length < 8) e.password = "Must be at least 8 characters";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      await staffApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        hub_id: form.hub_id || null,
      });
      toast(
        "success",
        "Staff created",
        `${form.name} · ${ROLE_LABELS[form.role]}`,
      );
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e) {
      toast(
        "error",
        "Create failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      await confirm.run();
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  };

  // T2-26 (SU-9): issue a reset token and surface it once for the admin to hand over.
  const doReset = async (s: StaffMember) => {
    setResetting(true);
    try {
      const r = await staffApi.resetPassword(s.id);
      setResetResult(r);
      setPeek(null);
    } catch (e) {
      toast("error", "Reset failed", e instanceof Error ? e.message : undefined);
    } finally {
      setResetting(false);
    }
  };

  const toggle = async (s: StaffMember) => {
    setActingId(s.id);
    try {
      await staffApi.setActive(s.id, !s.is_active);
      setStaff((xs) =>
        xs.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)),
      );
    } catch (e) {
      toast(
        "error",
        "Update failed",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setActingId("");
    }
  };

  return (
    <div className={base.page}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className={base.pageHeader}>
        <h1 className={base.title}>Ops Staff</h1>
        <Button variant="primary" onClick={openCreate}>
          <UilPlus size={16} /> New staff
        </Button>
      </div>

      <div className={base.filterBar}>
        <select
          className={base.filterSelect}
          value={hubFilter}
          onChange={(e) => setHubFilter(e.target.value)}
        >
          <option value="">All hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          className={base.filterSelect}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className={base.tableWrap}>
        <table className={base.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Hub</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}>
                      <div className={base.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6} className={base.empty}>
                  No staff yet. Create the hub's ops team.
                </td>
              </tr>
            ) : (
              visible.map((s) => (
                <tr
                  key={s.id}
                  className={base.row}
                  style={{ opacity: s.is_active ? 1 : 0.55, cursor: 'pointer' }}
                   {...rowActivation(() => setPeek(s))}>
                  <td className={base.customerName} style={{ fontWeight: 500 }}>
                    {s.name}
                  </td>
                  <td>{s.email}</td>
                  <td>{ROLE_LABELS[s.role] ?? s.role}</td>
                  <td>
                    {s.hub_name ?? (
                      <span style={{ opacity: 0.5 }}>Unassigned</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={s.is_active ? 'active' : 'inactive'} />
                  </td>
                  <td>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actingId === s.id}
                        onClick={() =>
                          setConfirm({
                            title: s.is_active
                              ? "Deactivate staff?"
                              : "Activate staff?",
                            variant: s.is_active ? "danger" : "primary",
                            label: s.is_active ? "Deactivate" : "Activate",
                            message: (
                              <>
                                {s.is_active ? "Deactivate" : "Activate"}{" "}
                                <strong>{s.name}</strong> (
                                {ROLE_LABELS[s.role] ?? s.role})?
                                {s.is_active &&
                                  " They will not be able to log into the ops app."}
                              </>
                            ),
                            run: () => toggle(s),
                          })
                        }
                      >
                        {s.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={closeEditor}
        title="New ops staff"
        footer={
          <>
            <Button variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              variant="primary"
              state={saving ? "loading" : "default"}
              onClick={create}
            >
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Input
            label="Name *"
            value={form.name}
            onChange={set("name")}
            placeholder="Full name"
            error={errors.name}
          />
          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="name@zavestro.in"
            error={errors.email}
          />
          <Input
            label="Temporary password * (min 8)"
            value={form.password}
            onChange={set("password")}
            placeholder="They change it on first login"
            error={errors.password}
          />
          <label className={base.fieldLabel}>
            Role
            <select
              className={base.filterSelect}
              value={form.role}
              onChange={(e) => set("role")(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className={base.fieldLabel}>
            Hub
            <select
              className={base.filterSelect}
              value={form.hub_id}
              onChange={(e) => set("hub_id")(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.label}
        variant={confirm?.variant}
        loading={confirming}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />

      {/* T2-26 (SU-9): quick-look drawer + reset-password action */}
      <PeekDrawer
        open={!!peek}
        onClose={() => setPeek(null)}
        title={peek?.name ?? ""}
        subtitle={peek ? ROLE_LABELS[peek.role] ?? peek.role : undefined}
        status={peek ? <StatusBadge status={peek.is_active ? "active" : "inactive"} size="sm" /> : undefined}
        footer={peek && (
          <Button variant="secondary" size="sm" state={resetting ? "loading" : "default"} onClick={() => doReset(peek)}>
            Reset password
          </Button>
        )}
      >
        {peek && (
          <dl className={ov.fieldGrid}>
            <div className={ov.field}><dt className={ov.fieldLabel}>Email</dt><dd className={ov.fieldValue}>{peek.email}</dd></div>
            <div className={ov.field}><dt className={ov.fieldLabel}>Role</dt><dd className={ov.fieldValue}>{ROLE_LABELS[peek.role] ?? peek.role}</dd></div>
            <div className={ov.field}><dt className={ov.fieldLabel}>Hub</dt><dd className={ov.fieldValue}>{peek.hub_name ?? "Unassigned"}</dd></div>
            <div className={ov.field}><dt className={ov.fieldLabel}>Status</dt><dd className={ov.fieldValue}>{peek.is_active ? "Active" : "Inactive"}</dd></div>
          </dl>
        )}
      </PeekDrawer>

      {/* Reset-password result — the token is shown ONCE for the admin to hand over. */}
      <Modal
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="Password reset token"
        footer={<Button variant="primary" onClick={() => setResetResult(null)}>Done</Button>}
      >
        {resetResult && (
          <div style={{ display: "grid", gap: 12 }}>
            <p className={base.pagination}>
              A one-time reset token for <strong>{resetResult.email}</strong>. Share it securely — it
              expires {new Date(resetResult.expires_at).toLocaleString("en-IN")} and won't be shown again.
              (The staff-facing reset page is pending; the token is stored and ready.)
            </p>
            <div><CopyId value={resetResult.token} display={`${resetResult.token.slice(0, 12)}… (click to copy)`} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StaffManagementPage;
