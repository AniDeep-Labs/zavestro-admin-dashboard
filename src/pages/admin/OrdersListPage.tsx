import React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminOrders, type OrderStage } from '../../data/adminMockData';
import styles from './OrdersListPage.module.css';

const stageColors: Record<OrderStage, string> = {
  payment_pending: 'neutral',
  payment_confirmed: 'blue',
  fabric_sourced: 'blue',
  in_tailoring: 'warning',
  quality_check: 'warning',
  ready_to_dispatch: 'success',
  dispatched: 'success',
  delivered: 'success',
  return_requested: 'error',
  returned: 'neutral',
};

const stageLabels: Record<OrderStage, string> = {
  payment_pending: 'Payment Pending',
  payment_confirmed: 'Payment Confirmed',
  fabric_sourced: 'Fabric Sourced',
  in_tailoring: 'In Tailoring',
  quality_check: 'Quality Check',
  ready_to_dispatch: 'Ready to Dispatch',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  return_requested: 'Return Requested',
  returned: 'Returned',
};

export const OrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [modeFilter, setModeFilter] = React.useState('All');
  const [statusFilter, setStatusFilter] = React.useState('All');

  const filtered = adminOrders.filter(o => {
    const matchSearch = !search || o.id.toLowerCase().includes(search.toLowerCase()) || o.customer.toLowerCase().includes(search.toLowerCase());
    const matchMode = modeFilter === 'All' || o.mode === modeFilter;
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchMode && matchStatus;
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Orders</h1>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn}>Export CSV</button>
          <button className={styles.bulkBtn} disabled>Bulk Update</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by order # or customer name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filterSelect} value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
          <option>All</option>
          <option>Simplified</option>
          <option>Luxe</option>
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option>All</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className={styles.clearBtn} onClick={() => { setSearch(''); setModeFilter('All'); setStatusFilter('All'); }}>
          Clear All
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Mode</th>
              <th>Products</th>
              <th>Stage</th>
              <th>Hub</th>
              <th>Created</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className={styles.empty}>No orders found. Try changing your filters.</td>
              </tr>
            ) : (
              filtered.map(order => (
                <tr
                  key={order.id}
                  className={`${styles.row} ${order.overdue ? styles.rowOverdue : ''}`}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                >
                  <td className={styles.orderId}>{order.id}</td>
                  <td>
                    <div className={styles.customerName}>{order.customer}</div>
                    <div className={styles.customerPhone}>{order.phone.replace(/\d{5}$/, 'XXXXX')}</div>
                  </td>
                  <td>
                    <span className={`${styles.pill} ${order.mode === 'Luxe' ? styles.pillGold : styles.pillGreen}`}>
                      {order.mode}
                    </span>
                  </td>
                  <td className={styles.products}>
                    {order.products.slice(0, 2).join(', ')}
                    {order.products.length > 2 && <span className={styles.moreProducts}> +{order.products.length - 2}</span>}
                  </td>
                  <td>
                    <span className={`${styles.stagePill} ${styles[`stage-${stageColors[order.stage]}`]}`}>
                      {stageLabels[order.stage]}
                    </span>
                  </td>
                  <td className={styles.hub}>{order.hub}</td>
                  <td className={styles.date}>{order.created}</td>
                  <td className={styles.total}>₹{order.total.toLocaleString()}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[`status-${order.status}`]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className={styles.actionBtn} onClick={() => navigate(`/admin/orders/${order.id}`)}>
                      👁
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        Showing {filtered.length} of {adminOrders.length} orders
      </div>
    </div>
  );
};
