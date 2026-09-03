import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAdminUser } from '../../api/adminApi';
import styles from './AccessDenied.module.css';

/**
 * ACP-1 — ONE refusal screen for the whole admin. [KA9-1]…[KA9-7]
 *
 * The audit found three separate ways this went wrong, and they compound:
 *
 * 1. **The page body rendered anyway.** A role-less deep link to
 *    `/admin/finance/pnl` drew the whole console — the "FINANCE · MONEY" eyebrow,
 *    the title, nine KPI cards, and Export CSV / Journal CSV / Tally XML — and
 *    then said *"No P&L data in this window… once there are orders in range."*
 *    `/admin/system/admin-users` said **"No active admins."** on a system with
 *    nine, beside an enabled *Create Admin*. A refusal was being rendered as an
 *    absence, and the furniture of every console was on show to an account that
 *    had been granted nothing.
 * 2. **Two denial dialects.** The orders list says *"Viewing this requires one
 *    of: `orders:read`"* — which tells you what to ask for. Everywhere else said
 *    *"Your admin role lacks permission for this action"*, which does not. The
 *    good version already existed; this promotes it.
 * 3. **The "Related:" footer invited the user deeper into refusals** — links from
 *    a page you cannot see to more pages you cannot see. `/admin/system/health`
 *    was the only correct denial render in the admin; this is that, generalised.
 *
 * Two toasts also fired on every denied page, anchored over the header and
 * clipping the buttons beneath ([KA9-5]) — a page that refuses cleanly does not
 * need to shout as well, so callers should suppress their error toast when they
 * render this.
 */
export interface AccessDeniedProps {
  /**
   * The capabilities that WOULD grant this page. Naming them is the whole point:
   * an operator can then ask for the right thing instead of "access".
   */
  requires?: string[];
  /** What the user was trying to open, for the copy. */
  what?: string;
  /**
   * `pending` — the account has no role at all, which is a different situation
   * from lacking one capability and needs a different next step.
   */
  reason?: 'no-capability' | 'no-role' | 'oversight-only';
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requires,
  what = 'this section',
  reason = 'no-capability',
}) => {
  const navigate = useNavigate();
  const isSuper = getAdminUser()?.role === 'super_admin';

  const heading =
    reason === 'no-role'
      ? 'Your account is awaiting a role'
      : reason === 'oversight-only'
        ? 'Oversight roles do not open this console'
        : `You don't have access to ${what}`;

  const body =
    reason === 'no-role' ? (
      <>
        A super admin needs to assign one before you can use the console. Nothing here is
        broken and nothing is missing — the console simply has not been opened to you yet.
      </>
    ) : reason === 'oversight-only' ? (
      <>
        This is a role-owned operating console. Your role reads the overviews and analytics
        instead of working the floor directly.
      </>
    ) : (
      <>
        Your admin role cannot view {what}. Nothing is missing — it is not being shown to you.
      </>
    );

  return (
    <div className={styles.wrap} role="status">
      <div className={styles.icon} aria-hidden="true">
        🔒
      </div>
      <h2 className={styles.title}>{heading}</h2>
      <p className={styles.body}>{body}</p>

      {/* [KA9-6] Name the capability. "Viewing this requires one of: orders:read"
          is the one denial in this admin that tells an operator what to ask for;
          everything else said "lacks permission", which does not. */}
      {requires && requires.length > 0 && (
        <p className={styles.requires}>
          Viewing this requires one of:{' '}
          {requires.map((c) => (
            <code key={c} className={styles.cap}>
              {c}
            </code>
          ))}
        </p>
      )}

      {/* [SHL-3-7] ...and say WHO can grant it. Naming the capability answers "what am I
          missing"; a denial also has to answer "what do I do about it", or the operator's
          only move is to message the founder — which is the exact dependency this audit
          keeps finding (F-44 / F-47 / F-51 stayed invisible for months for this reason).

          A super admin gets a LINK, because they can grant it themselves. Everyone else
          gets the destination as text: sending a non-super to /admin/system/admin-users
          would land them on a second refusal, and a corridor of locked doors is what
          [KA9-7] exists to stop. */}
      {reason !== 'oversight-only' && (
        <p className={styles.whoGrants}>
          {isSuper ? (
            <>
              You can grant this yourself in{' '}
              <Link to="/admin/system/admin-users" className={styles.link}>
                Admin → Admin Users
              </Link>
              .
            </>
          ) : (
            <>Ask a super admin to grant it in Admin → Admin Users.</>
          )}
        </p>
      )}

      {/* [KA9-7] ONE way out, and it is somewhere the user can actually go. A
          "Related:" list of further refusals is a corridor of locked doors. */}
      <button type="button" className={styles.action} onClick={() => navigate('/admin/dashboard')}>
        Go to your dashboard
      </button>
    </div>
  );
};

export default AccessDenied;
