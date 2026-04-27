import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminHubs, adminOrders } from '../../data/adminMockData';
import styles from './HubDetailPage.module.css';

const TABS = ['Overview', 'Staff', 'Capacity', 'Inventory'];

const staff = [
  { name: 'Priya Menon', role: 'Hub Manager', email: 'priya@zavestro.com', phone: '+91 98001 23456', status: 'Active' },
  { name: 'Rajan Kumar', role: 'Tailor', email: 'rajan@zavestro.com', phone: '+91 97001 34567', status: 'Active' },
  { name: 'Meena Devi', role: 'QC Staff', email: 'meena@zavestro.com', phone: '+91 96001 45678', status: 'Active' },
  { name: 'Suresh P.', role: 'Tailor', email: 'suresh@zavestro.com', phone: '+91 95001 56789', status: 'Active' },
  { name: 'Anita R.', role: 'Dispatch', email: 'anita@zavestro.com', phone: '+91 94001 67890', status: 'Active' },
];

const inventory = [
  { name: 'Navy Blue Cotton', sku: 'FAB-001', material: 'Cotton', stock: 80, reserved: 35, threshold: 15, status: 'In Stock' },
  { name: 'White Linen', sku: 'FAB-002', material: 'Linen', stock: 12, reserved: 8, threshold: 20, status: 'Low Stock' },
  { name: 'Olive Linen Blend', sku: 'FAB-003', material: 'Linen Blend', stock: 45, reserved: 20, threshold: 10, status: 'In Stock' },
  { name: 'Black Cotton', sku: 'FAB-004', material: 'Cotton', stock: 0, reserved: 0, threshold: 15, status: 'Out of Stock' },
  { name: 'Grey Polyester Blend', sku: 'FAB-005', material: 'Polyester Blend', stock: 60, reserved: 25, threshold: 10, status: 'In Stock' },
];

export const HubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('Overview');

  const hub = adminHubs.find(h => h.id === id) || adminHubs[0];
  const hubOrders = adminOrders.filter(o => o.hub === hub.name).slice(0, 10);

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/admin/hubs')}>← Back to Hubs</button>

      <div className={styles.hubHeader}>
        <div>
          <h1 className={styles.hubName}>{hub.name}</h1>
          <div className={styles.hubSub}>{hub.city}, {hub.state}</div>
        </div>
        <div className={styles.hubActions}>
          <button className={styles.editBtn}>Edit Hub</button>
          <button className={styles.deactivateBtn}>Deactivate Hub</button>
        </div>
      </div>

      {hub.status === 'At Capacity' && (
        <div className={styles.capacityBanner}>
          Hub at capacity. New orders to this hub are currently blocked.
        </div>
      )}
      {hub.status === 'Inactive' && (
        <div className={styles.inactiveBanner}>
          This hub is inactive. It is not accepting new orders.
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div className={styles.tabContent}>
          <div className={styles.twoCol}>
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>Hub Details</h3>
              <div className={styles.detailGrid}>
                <div><div className={styles.metaLabel}>Address</div><div className={styles.metaValue}>{hub.address}</div></div>
                <div><div className={styles.metaLabel}>Pincode</div><div className={styles.metaValue}>{hub.pincode}</div></div>
                <div><div className={styles.metaLabel}>Hub Manager</div><div className={styles.metaValue}>{hub.managerName}</div></div>
                <div><div className={styles.metaLabel}>Contact</div><div className={styles.metaValue}>{hub.managerPhone}</div></div>
              </div>
            </div>
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>Performance</h3>
              <div className={styles.perfGrid}>
                <div className={styles.perfCard}>
                  <div className={styles.perfValue}>{hub.activeOrders}</div>
                  <div className={styles.perfLabel}>Active Orders</div>
                </div>
                <div className={styles.perfCard}>
                  <div className={styles.perfValue}>{hub.capacityUsed}%</div>
                  <div className={styles.perfLabel}>Capacity Used</div>
                </div>
                <div className={styles.perfCard}>
                  <div className={styles.perfValue}>{hub.qcPassRate}%</div>
                  <div className={styles.perfLabel}>QC Pass Rate</div>
                </div>
                <div className={styles.perfCard}>
                  <div className={styles.perfValue}>7.8d</div>
                  <div className={styles.perfLabel}>Avg. Production</div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Recent Orders</h3>
              <button className={styles.linkBtn} onClick={() => navigate('/admin/orders')}>View All →</button>
            </div>
            {hubOrders.length === 0 ? (
              <div className={styles.empty}>No recent orders.</div>
            ) : (
              <table className={styles.miniTable}>
                <thead><tr><th>Order #</th><th>Customer</th><th>Stage</th><th>Total</th><th>Date</th></tr></thead>
                <tbody>
                  {hubOrders.map((o, i) => (
                    <tr key={i} className={styles.miniRow} onClick={() => navigate(`/admin/orders/${o.id}`)}>
                      <td className={styles.orderId}>{o.id}</td>
                      <td>{o.customer}</td>
                      <td>{o.stage.replace(/_/g, ' ')}</td>
                      <td>₹{o.total.toLocaleString()}</td>
                      <td>{o.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Staff Tab */}
      {activeTab === 'Staff' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{hub.name} — Staff</h3>
              <button className={styles.addBtn}>+ Add Staff Member</button>
            </div>
            <table className={styles.staffTable}>
              <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {staff.map((s, i) => (
                  <tr key={i}>
                    <td className={styles.staffName}>{s.name}</td>
                    <td><span className={styles.rolePill}>{s.role}</span></td>
                    <td>{s.email}</td>
                    <td>{s.phone}</td>
                    <td><span className={styles.statusActive}>Active</span></td>
                    <td>
                      <div className={styles.staffActions}>
                        <button className={styles.actionBtn}>Reset Password</button>
                        <button className={styles.removeBtn}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Capacity Tab */}
      {activeTab === 'Capacity' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>{hub.name} — Capacity</h3>
            <div className={styles.capacitySettings}>
              <div className={styles.capacityRow}>
                <span className={styles.metaLabel}>Daily order limit</span>
                <div className={styles.capacityInput}>
                  <input type="number" defaultValue={60} className={styles.numInput} />
                  <button className={styles.saveBtn}>Save</button>
                </div>
              </div>
              <div className={styles.capacityProgress}>
                <span className={styles.metaLabel}>Today: {hub.activeOrders} / 60 orders</span>
                <div className={styles.progressBar}>
                  <div className={`${styles.progressFill} ${hub.capacityUsed >= 100 ? styles.progressFull : hub.capacityUsed >= 80 ? styles.progressHigh : styles.progressNormal}`}
                    style={{ width: `${Math.min(hub.capacityUsed, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'Inventory' && (
        <div className={styles.tabContent}>
          {inventory.some(i => i.status !== 'In Stock') && (
            <div className={styles.lowStockBanner}>
              {inventory.filter(i => i.status !== 'In Stock').length} fabrics below minimum threshold
            </div>
          )}
          <div className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{hub.name} — Fabric Inventory</h3>
              <button className={styles.addBtn}>+ Add Fabric</button>
            </div>
            <table className={styles.inventoryTable}>
              <thead>
                <tr><th>Fabric Name</th><th>SKU</th><th>Material</th><th>Total (m)</th><th>Reserved (m)</th><th>Available (m)</th><th>Min Threshold</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {inventory.map((item, i) => (
                  <tr key={i}>
                    <td className={styles.fabricName}>{item.name}</td>
                    <td className={styles.sku}>{item.sku}</td>
                    <td>{item.material}</td>
                    <td>{item.stock}</td>
                    <td>{item.reserved}</td>
                    <td className={item.stock - item.reserved === 0 ? styles.zeroStock : ''}>{item.stock - item.reserved}</td>
                    <td>{item.threshold}</td>
                    <td>
                      <span className={`${styles.stockStatus} ${item.status === 'In Stock' ? styles.stockGood : item.status === 'Low Stock' ? styles.stockLow : styles.stockOut}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.staffActions}>
                        <button className={styles.actionBtn}>Edit</button>
                        <button className={styles.actionBtn}>Restock</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
