import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Badge } from '../../components';
import styles from './OrderTrackingPage.module.css';

interface TrackingStep {
  label: string;
  date: string;
  status: 'completed' | 'current' | 'pending';
  details: string[];
}

const trackingSteps: TrackingStep[] = [
  {
    label: 'Order Confirmed',
    date: 'Mar 19, 10:30 AM',
    status: 'completed',
    details: ['Payment: ₹5,850 ✅ Paid', 'Status: Confirmed'],
  },
  {
    label: 'Fabric Pickup',
    date: 'Tomorrow (Mar 20)',
    status: 'current',
    details: [
      '⏰ 2:00 PM - 3:00 PM',
      '📍 123, Park Street, Delhi 110001',
      '👤 Pickup Agent: Assigned ⭐4.9',
      '💵 Cost: ₹150',
      'Fabric: Silk Blend, Maroon, 6.5m, Brand new',
    ],
  },
  {
    label: 'Delivered to Tailor',
    date: 'Expected: Mar 21',
    status: 'pending',
    details: ['📍 Raj Tailoring, South Delhi'],
  },
  {
    label: 'Tailor Confirms Measurements',
    date: 'Expected: Mar 22',
    status: 'pending',
    details: ['Tailor will review and approve measurements'],
  },
  {
    label: 'Stitching In Progress',
    date: 'Expected: Mar 23 - Apr 2',
    status: 'pending',
    details: ['Duration: 10-12 days', 'Tailor may share progress photos'],
  },
  {
    label: 'Quality Check & Ready',
    date: 'Expected: Apr 2',
    status: 'pending',
    details: ['Final quality check', 'Prepares for shipping'],
  },
  {
    label: 'In Transit to You',
    date: 'Expected: Apr 3-4',
    status: 'pending',
    details: ['Track shipment here'],
  },
  {
    label: 'Delivered to Your Home',
    date: 'Expected: Apr 4-5',
    status: 'pending',
    details: ['📍 123, Park Street, Delhi 110001'],
  },
];

export const OrderTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/')}>← Back</button>

      <div className={styles.orderHeader}>
        <div>
          <h1 className={styles.orderId}>Order #{id || 'Z-2024-00523'}</h1>
          <p className={styles.orderDesign}>Royal Embroidered Saree</p>
        </div>
        <Badge variant="warning" size="md">📦 Fabric Pickup Scheduled</Badge>
      </div>

      {/* Timeline */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Timeline & Progress</h2>
        <div className={styles.timeline}>
          {trackingSteps.map((step, i) => (
            <div key={i} className={`${styles.step} ${styles[`step-${step.status}`]}`}>
              <div className={styles.stepIndicator}>
                <div className={styles.stepDot}>
                  {step.status === 'completed' ? '✅' : step.status === 'current' ? '→' : '○'}
                </div>
                {i < trackingSteps.length - 1 && <div className={styles.stepLine} />}
              </div>
              <div className={styles.stepContent}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepLabel}>
                    {step.status === 'completed' ? 'STEP' : step.status === 'current' ? '→ STEP' : 'STEP'} {i + 1}: {step.label}
                  </span>
                  <span className={styles.stepDate}>📅 {step.date}</span>
                </div>
                <div className={styles.stepDetails}>
                  {step.details.map((d, j) => (
                    <div key={j} className={styles.stepDetail}>{d}</div>
                  ))}
                </div>
                {step.status === 'current' && (
                  <div className={styles.stepActions}>
                    <button className={styles.stepBtn}>📞 Call Pickup Agent</button>
                    <button className={styles.stepBtn}>📅 Reschedule</button>
                    <button className={styles.stepBtnDanger}>❌ Cancel</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tailor Info */}
      <Card variant="outlined" padding="md">
        <h3 className={styles.sectionTitle}>👥 Your Tailor</h3>
        <div className={styles.tailorInfo}>
          <div className={styles.tailorRow}>
            <div className={styles.tailorAvatar}>R</div>
            <div>
              <div className={styles.tailorName}>Raj Tailoring</div>
              <div className={styles.tailorMeta}>⭐ 4.9 (245 reviews) · South Delhi · 15 years exp.</div>
            </div>
          </div>
          <div className={styles.tailorActions}>
            <button className={styles.tailorBtn}>💬 Message</button>
            <button className={styles.tailorBtn}>📞 Call</button>
            <button className={styles.tailorBtn}>👤 Profile</button>
          </div>
        </div>
      </Card>

      {/* Delivery Address */}
      <Card variant="outlined" padding="md">
        <h3 className={styles.sectionTitle}>📍 Delivery Address</h3>
        <div className={styles.addressInfo}>
          <div>Sarah Johnson</div>
          <div>123, Park Street</div>
          <div>New Delhi, 110001</div>
          <div>Phone: +91 98765 43210</div>
        </div>
        <button className={styles.editBtn}>📝 Edit Address</button>
      </Card>
    </div>
  );
};
