// A render harness — an alternate entrypoint, never reached by the app.
//
//   npm run dev   →   http://localhost:5173/preview.html
//
// Mounts ONE form with no router, no auth and no API, so a field-level change
// can actually be looked at. The customer app carries the same idea in
// `lib/main_preview.dart`, for the same reason: some questions ("is the
// required warning visible?", "is Save disabled?") can only be answered by a
// browser, and the promo page is behind a login.
//
// Scope, honestly: PromoForm holds its own state and calls `onSave` with a
// payload, so everything up to the moment of saving is real here — the labels,
// the required warnings, and the Save gate. What this CANNOT show is the list
// page around it or what the API does with the payload.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/variables.css';
import './styles/global.css';
import './styles/animations.css';

import { PromoForm } from './pages/admin/PromoCodesPage';
// The page's OWN module CSS, so the harness inherits the real modal width
// (max-width 500px, 28px padding) instead of a width I invented. A harness
// that is wider than the thing it stands in reports overflow that does not
// happen, and hides overflow that does.
import styles from './pages/admin/PromoCodesPage.module.css';
import type { PromoCode } from './api/adminApi';
import { initTheme } from './utils/theme';

initTheme();

// `?edit=1` mounts the EDIT case instead: an existing coupon whose minimum is
// a deliberate 0. That row is the reason the field shows "0" rather than
// blanking — with Save gated on a non-empty minimum, a blank would have locked
// those coupons out of being edited at all.
const editing = new URLSearchParams(location.search).has('edit');
const initial: Partial<PromoCode> = editing
  ? { id: 'demo', code: 'ANYORDER', discount_type: 'percent', discount_value: 10, min_order_amount: 0 }
  : {};

// Exported so react-refresh can see a component export in this entrypoint;
// nothing imports it.
export function Harness() {
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className={styles.modalOverlay} style={{ position: 'static' }}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>
          {editing ? 'Edit: ANYORDER' : 'Create Promo Code'}
        </h3>
        <PromoForm
          initial={initial}
          saving={false}
          onCancel={() => setSaved('cancelled')}
          onSave={(d) => setSaved(JSON.stringify(d, null, 2))}
        />
        {saved && (
          <pre style={{ marginTop: 4, padding: 12, overflowX: 'auto',
                        border: '1px dashed var(--color-border)' }}>
            {saved}
          </pre>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
