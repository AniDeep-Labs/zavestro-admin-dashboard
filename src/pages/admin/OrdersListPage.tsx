import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, X, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { ordersApi, usersApi, hubsApi } from '../../api/adminApi';
import type { AdminOrder, OrderStage, AdminUser, Hub } from '../../api/adminApi';
import { catalogApi } from '../../api/catalogApi';
import type { ApiProduct, ApiVariant } from '../../api/catalogApi';
import { ToastContainer, createToast } from '../../components/Toast/Toast';
import type { ToastData } from '../../components/Toast/Toast';
import styles from './OrdersListPage.module.css';

const LIMIT = 25;

const stageLabels: Record<OrderStage, string> = {
  payment_pending: 'Payment Pending', payment_confirmed: 'Payment Confirmed',
  fabric_sourced: 'Fabric Sourced', in_tailoring: 'In Tailoring',
  quality_check: 'Quality Check', ready_to_dispatch: 'Ready to Dispatch',
  dispatched: 'Dispatched', delivered: 'Delivered',
  return_requested: 'Return Requested', returned: 'Returned',
};

const stageCss: Record<OrderStage, string> = {
  payment_pending: 'stageNeutral', payment_confirmed: 'stageBlue',
  fabric_sourced: 'stageBlue', in_tailoring: 'stageWarning',
  quality_check: 'stageWarning', ready_to_dispatch: 'stageSuccess',
  dispatched: 'stageSuccess', delivered: 'stageSuccess',
  return_requested: 'stageError', returned: 'stageNeutral',
};

function useDebounce<T>(v: T, d: number) {
  const [dv, setDv] = React.useState(v);
  React.useEffect(() => { const t = setTimeout(() => setDv(v), d); return () => clearTimeout(t); }, [v, d]);
  return dv;
}

interface OrderItem {
  product_name: string;
  variant_id?: string;
  unit_price: number;
  quantity: number;
}

export const OrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const debouncedSearch = useDebounce(search, 350);

  // Create Order modal state
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  // User search
  const [userSearch, setUserSearch] = React.useState('');
  const [userResults, setUserResults] = React.useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
  const debouncedUserSearch = useDebounce(userSearch, 350);

  // Product search
  const [productSearch, setProductSearch] = React.useState('');
  const [productResults, setProductResults] = React.useState<ApiProduct[]>([]);
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = React.useState<ApiProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = React.useState<ApiVariant | null>(null);
  const debouncedProductSearch = useDebounce(productSearch, 350);

  // Hub + delivery
  const [hubs, setHubs] = React.useState<Hub[]>([]);
  const [selectedHubId, setSelectedHubId] = React.useState('');
  const [addr, setAddr] = React.useState({ line1: '', line2: '', city: '', state: '', pincode: '' });
  const [paymentMethod, setPaymentMethod] = React.useState<'cod' | 'offline_transfer' | 'already_paid'>('cod');
  const [internalNote, setInternalNote] = React.useState('');

  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  const showToast = (type: ToastData['type'], title: string, msg?: string) =>
    setToasts(t => [...t, createToast(type, title, msg)]);

  React.useEffect(() => {
    setLoading(true); setError('');
    ordersApi.list({ search: debouncedSearch || undefined, stage: stageFilter as OrderStage || undefined, mode: modeFilter || undefined, page, limit: LIMIT })
      .then(r => { setOrders(r.orders); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(e => { const msg = e instanceof Error ? e.message : 'Failed to load'; setError(msg); showToast('error', 'Load failed', msg); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, stageFilter, modeFilter, page]);

  React.useEffect(() => {
    if (!showCreate) return;
    hubsApi.list({ status: 'Active' }).then(r => setHubs(r.hubs)).catch(() => {});
  }, [showCreate]);

  React.useEffect(() => {
    if (debouncedUserSearch.length < 2) { setUserResults([]); return; }
    usersApi.list({ search: debouncedUserSearch, limit: 6 }).then(r => setUserResults(r.users)).catch(() => {});
  }, [debouncedUserSearch]);

  React.useEffect(() => {
    if (debouncedProductSearch.length < 2) { setProductResults([]); return; }
    catalogApi.getProducts({ search: debouncedProductSearch, status: 'active', limit: 8 })
      .then(r => setProductResults(r.products))
      .catch(() => {});
  }, [debouncedProductSearch]);

  const openCreate = () => {
    setSelectedUser(null); setUserSearch(''); setUserResults([]);
    setOrderItems([]); setProductSearch(''); setProductResults([]);
    setSelectedProduct(null); setSelectedVariant(null);
    setSelectedHubId(''); setAddr({ line1: '', line2: '', city: '', state: '', pincode: '' });
    setPaymentMethod('cod'); setInternalNote('');
    setShowCreate(true);
  };

  const addItem = () => {
    if (!selectedProduct) return;
    const price = selectedVariant?.price ?? selectedProduct.base_price;
    setOrderItems(prev => [...prev, {
      product_name: selectedProduct.name + (selectedVariant ? ` — ${selectedVariant.size} / ${selectedVariant.color}` : ''),
      variant_id: selectedVariant?.id,
      unit_price: price,
      quantity: 1,
    }]);
    setSelectedProduct(null); setSelectedVariant(null); setProductSearch(''); setProductResults([]);
  };

  const updateItemQty = (i: number, qty: number) => setOrderItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, qty) } : it));
  const removeItem = (i: number) => setOrderItems(prev => prev.filter((_, idx) => idx !== i));

  const totalAmount = orderItems.reduce((s, it) => s + it.unit_price * it.quantity, 0);

  const handleCreate = async () => {
    if (!selectedUser) { showToast('error', 'Select a customer'); return; }
    if (!selectedHubId) { showToast('error', 'Select a hub'); return; }
    if (orderItems.length === 0) { showToast('error', 'Add at least one product'); return; }
    if (!addr.line1 || !addr.city || !addr.state || !addr.pincode) { showToast('error', 'Fill in the delivery address'); return; }

    setCreating(true);
    try {
      const created = await ordersApi.create({
        user_id: selectedUser.id,
        hub_id: selectedHubId,
        mode: 'simplified',
        delivery_address: addr,
        items: orderItems,
        payment_method: paymentMethod,
        internal_note: internalNote || undefined,
      });
      showToast('success', 'Order created', created.order_number ?? created.id);
      setShowCreate(false);
      setOrders(prev => [{ id: created.order_number ?? created.id, uuid: created.id, customer: selectedUser.name, phone: selectedUser.phone, email: selectedUser.email, user_id: selectedUser.id, mode: 'Simplified', stage: 'payment_confirmed', status: 'active', hub: hubs.find(h => h.id === selectedHubId)?.name ?? '', total: totalAmount, products: orderItems.map(i => i.product_name), created: new Date().toLocaleDateString('en-IN'), overdue: false, items: [], timeline: [], payments: [] }, ...prev]);
    } catch (e) {
      showToast('error', 'Failed to create order', e instanceof Error ? e.message : undefined);
    } finally { setCreating(false); }
  };

  const exportCSV = () => {
    const rows = [['Order ID','Customer','Mode','Stage','Hub','Total','Created'],
      ...orders.map(o => [o.id, o.customer, o.mode, stageLabels[o.stage], o.hub, `₹${o.total}`, o.created])];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className={styles.page}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Orders</h1>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={exportCSV}><Download size={14} /> Export CSV</button>
          <button className={styles.exportBtn} onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--green)', color: '#fff', border: 'none' }}>
            <Plus size={14}/> Create Order
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search order ID or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className={styles.filterSelect} value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1); }}>
          <option value="">All Stages</option>
          {(Object.keys(stageLabels) as OrderStage[]).map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
        </select>
        <select className={styles.filterSelect} value={modeFilter} onChange={e => { setModeFilter(e.target.value); setPage(1); }}>
          <option value="">All Modes</option>
          <option value="Simplified">Simplified</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setStageFilter(''); setModeFilter(''); setPage(1); }}><X size={14} /> Clear</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>
            <th>Order ID</th><th>Customer</th><th>Mode</th><th>Products</th>
            <th>Stage</th><th>Hub</th><th>Total</th><th>Date</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({length: 8}).map((_, i) => (
              <tr key={i}>{Array.from({length: 8}).map((__, j) => <td key={j}><div className={styles.skeleton}/></td>)}</tr>
            )) : error ? (
              <tr><td colSpan={8} className={styles.empty}>
                {error}<br/><button className={styles.retryBtn} onClick={() => setPage(1)}>Retry</button>
              </td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>No orders found.</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className={`${styles.row} ${o.overdue ? styles.rowOverdue : ''}`}
                onClick={() => navigate(`/admin/orders/${o.id}`)}>
                <td className={styles.orderId}>{o.id}</td>
                <td>
                  <div className={styles.customerName}>{o.customer}</div>
                  <div className={styles.customerPhone}>{o.phone}</div>
                </td>
                <td><span className={`${styles.modePill} ${styles.pillGreen}`}>{o.mode}</span></td>
                <td className={styles.products}>
                  {o.products?.slice(0,2).join(', ')}
                  {(o.products?.length ?? 0) > 2 ? ` +${o.products.length - 2}` : ''}
                </td>
                <td><span className={`${styles.stagePill} ${styles[stageCss[o.stage]]}`}>{stageLabels[o.stage]}</span></td>
                <td className={styles.hub}>{o.hub}</td>
                <td className={styles.total}>₹{o.total?.toLocaleString('en-IN')}</td>
                <td className={styles.date}>{o.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.paginationRow}>
        <span className={styles.pagination}>{loading ? 'Loading…' : `${total} order${total !== 1 ? 's' : ''} total`}</span>
        <div className={styles.pageButtons}>
          <button className={styles.pageBtn} disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/> Prev</button>
          <span className={styles.pageIndicator}>Page {page} of {totalPages || 1}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={15}/></button>
        </div>
      </div>

      {/* ── Create Order modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className={styles.modalTitle}>Create Order</h2>

            {/* Step 1: Customer */}
            <div className={styles.modalSection}>
              <div className={styles.modalSectionTitle}>1. Customer</div>
              {selectedUser ? (
                <div className={styles.selectedCustomer}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{selectedUser.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{selectedUser.phone} · {selectedUser.email}</div>
                  </div>
                  <button className={styles.clearSelBtn} onClick={() => { setSelectedUser(null); setUserSearch(''); }}>Change</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input className={styles.fieldInput} value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search customer by name or phone…" />
                  {userResults.length > 0 && (
                    <div className={styles.searchDropdown}>
                      {userResults.map(u => (
                        <button key={u.id} className={styles.searchResult} onClick={() => { setSelectedUser(u); setUserSearch(''); setUserResults([]); }}>
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{u.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {userSearch.length >= 2 && userResults.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 6 }}>No customers found for "{userSearch}"</div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Products */}
            <div className={styles.modalSection}>
              <div className={styles.modalSectionTitle}>2. Products</div>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <input className={styles.fieldInput} value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products to add…" />
                {productResults.length > 0 && (
                  <div className={styles.searchDropdown}>
                    {productResults.map(p => (
                      <button key={p.id} className={styles.searchResult} onClick={() => { setSelectedProduct(p); setSelectedVariant(null); setProductSearch(''); setProductResults([]); }}>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>₹{p.base_price.toLocaleString('en-IN')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className={styles.variantPicker}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{selectedProduct.name}</div>
                  {selectedProduct.variants.length > 0 ? (
                    <>
                      <select className={styles.fieldSelect} value={selectedVariant?.id ?? ''} onChange={e => setSelectedVariant(selectedProduct.variants.find(v => v.id === e.target.value) ?? null)}>
                        <option value="">— Select variant —</option>
                        {selectedProduct.variants.map(v => (
                          <option key={v.id} value={v.id}>{v.size} / {v.color} — ₹{v.price.toLocaleString('en-IN')}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>No variants — base price ₹{selectedProduct.base_price.toLocaleString('en-IN')}</div>
                  )}
                  <button className={styles.addItemBtn} onClick={addItem} disabled={selectedProduct.variants.length > 0 && !selectedVariant}>
                    <Plus size={13}/> Add to order
                  </button>
                </div>
              )}

              {orderItems.length > 0 && (
                <div className={styles.itemsList}>
                  {orderItems.map((it, i) => (
                    <div key={i} className={styles.itemRow}>
                      <span style={{ flex: 1, fontSize: 13 }}>{it.product_name}</span>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginRight: 8 }}>₹{it.unit_price.toLocaleString('en-IN')}</span>
                      <input type="number" min="1" value={it.quantity} onChange={e => updateItemQty(i, parseInt(e.target.value) || 1)}
                        style={{ width: 48, height: 28, textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: 4, fontFamily: 'inherit', fontSize: 13 }} />
                      <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: '0 6px' }}><Trash2 size={13}/></button>
                    </div>
                  ))}
                  <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', paddingTop: 8, borderTop: '1px solid var(--color-border-light)' }}>
                    Total: ₹{totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Hub */}
            <div className={styles.modalSection}>
              <div className={styles.modalSectionTitle}>3. Hub</div>
              <select className={styles.fieldSelect} value={selectedHubId} onChange={e => setSelectedHubId(e.target.value)}>
                <option value="">— Select hub —</option>
                {hubs.map(h => <option key={h.id} value={h.id}>{h.name} ({h.city})</option>)}
              </select>
            </div>

            {/* Step 4: Delivery address */}
            <div className={styles.modalSection}>
              <div className={styles.modalSectionTitle}>4. Delivery Address</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input className={styles.fieldInput} value={addr.line1} onChange={e => setAddr(a => ({ ...a, line1: e.target.value }))} placeholder="Address line 1 *" />
                <input className={styles.fieldInput} value={addr.line2} onChange={e => setAddr(a => ({ ...a, line2: e.target.value }))} placeholder="Line 2 (optional)" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input className={styles.fieldInput} value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} placeholder="City *" />
                  <input className={styles.fieldInput} value={addr.state} onChange={e => setAddr(a => ({ ...a, state: e.target.value }))} placeholder="State *" />
                  <input className={styles.fieldInput} value={addr.pincode} onChange={e => setAddr(a => ({ ...a, pincode: e.target.value }))} placeholder="Pincode *" maxLength={6} />
                </div>
              </div>
            </div>

            {/* Step 5: Payment + Note */}
            <div className={styles.modalSection}>
              <div className={styles.modalSectionTitle}>5. Payment & Notes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select className={styles.fieldSelect} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                  <option value="cod">Cash on Delivery</option>
                  <option value="offline_transfer">Offline Bank Transfer</option>
                  <option value="already_paid">Already Paid</option>
                </select>
                <input className={styles.fieldInput} value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Internal note (optional)" />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelModalBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button className={styles.createBtn} disabled={creating} onClick={handleCreate}>
                {creating ? 'Creating…' : `Create Order${orderItems.length > 0 ? ` — ₹${totalAmount.toLocaleString('en-IN')}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
