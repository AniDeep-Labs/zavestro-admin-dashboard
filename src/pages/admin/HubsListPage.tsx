import React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminHubs } from '../../data/adminMockData';
import styles from './HubsListPage.module.css';

const statusColors: Record<string, string> = {
  'Active': 'statusActive',
  'Inactive': 'statusInactive',
  'At Capacity': 'statusCapacity',
  'Critical': 'statusCritical',
};

export const HubsListPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Stitching Hubs</h1>
        <button className={styles.addBtn} onClick={() => navigate('/admin/hubs/new')}>+ Add Hub</button>
      </div>

      <div className={styles.grid}>
        {adminHubs.map(hub => (
          <div key={hub.id} className={styles.hubCard}>
            <div className={styles.hubHeader}>
              <div>
                <div className={styles.hubName}>{hub.name}</div>
                <div className={styles.hubLocation}>{hub.city}, {hub.state}</div>
              </div>
              <span className={`${styles.statusBadge} ${styles[statusColors[hub.status]]}`}>{hub.status}</span>
            </div>

            <div className={styles.kpiRow}>
              <div className={styles.kpi}>
                <div className={styles.kpiValue}>{hub.activeOrders}</div>
                <div className={styles.kpiLabel}>Active Orders</div>
              </div>
              <div className={styles.kpi}>
                <div className={`${styles.kpiValue} ${hub.capacityUsed >= 100 ? styles.kpiDanger : hub.capacityUsed >= 80 ? styles.kpiWarning : ''}`}>
                  {hub.capacityUsed}%
                </div>
                <div className={styles.kpiLabel}>Capacity</div>
              </div>
              <div className={styles.kpi}>
                <div className={`${styles.kpiValue} ${hub.qcPassRate >= 95 ? styles.kpiGood : hub.qcPassRate >= 90 ? styles.kpiWarning : styles.kpiDanger}`}>
                  {hub.qcPassRate}%
                </div>
                <div className={styles.kpiLabel}>QC Pass</div>
              </div>
            </div>

            <div className={styles.hubFooter}>
              <span className={styles.staffCount}>{hub.staffCount} staff ({hub.tailorCount} tailors, {hub.qcCount} QC)</span>
              <button className={styles.viewBtn} onClick={() => navigate(`/admin/hubs/${hub.id}`)}>
                View Details →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
