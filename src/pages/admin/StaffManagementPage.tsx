import React from "react";
import { staffApi, hubsApi } from "../../api/adminApi";
import type { StaffMember, StaffRole, Hub } from "../../api/adminApi";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { Modal } from "../../components/Modal/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ToastContainer, createToast } from "../../components/Toast/Toast";
import type { ToastData } from "../../components/Toast/Toast";
import base from "./OrdersListPage.module.css";
import { UilPlus } from "@iconscout/react-unicons";

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

export const StaffManagementPage: React.FC = () => {
  const [staff, setStaff] = React.useState<StaffMember[]>([]);
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [hubFilter, setHubFilter] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
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

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast("error", "Name, email and password are required");
      return;
    }
    if (form.password.length < 8) {
      toast("error", "Password must be at least 8 characters");
      return;
    }
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
        <Button variant="primary" onClick={() => setOpen(true)}>
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
                  style={{ opacity: s.is_active ? 1 : 0.55 }}
                >
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
                    <span
                      className={`${base.stagePill} ${s.is_active ? base.stageSuccess : base.stageNeutral}`}
                    >
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New ops staff"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
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
          />
          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="name@zavestro.in"
          />
          <Input
            label="Temporary password * (min 8)"
            value={form.password}
            onChange={set("password")}
            placeholder="They change it on first login"
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
    </div>
  );
};

export default StaffManagementPage;
