import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components';
import { useOrder } from '../../context/OrderContext';
import styles from './OrderConfirmationPage.module.css';

export const OrderConfirmationPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useOrder();
  const isOwn = state.fabricSource === 'own';
  const tailor = state.selectedTailor;
  const design = state.selectedDesign;

  const orderId = 'Z-2024-00523';

  const pickupCost = isOwn && tailor?.canPickup ? tailor.pickupCost : 0;
  const stitchingPrice = tailor?.basePrice || design?.basePrice || 0;
  const designerFee = design?.designerFee || 0;
  const total = pickupCost + designerFee + stitchingPrice + 200;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.checkmark}>✅</div>
        <h1 className={styles.heroTitle}>Order Placed!</h1>
        <p className={styles.heroSubtitle}>Your custom outfit is on the way!</p>
      </div>

      <Card variant="default" padding="md">
        <div className={styles.orderInfo}>
          <div className={styles.infoRow}><span>Order</span><span className={styles.orderId}>{orderId}</span></div>
          <div className={styles.infoRow}><span>Total Amount</span><span className={styles.totalAmount}>₹{total.toLocaleString()}</span></div>
          <div className={styles.infoRow}><span>Status</span><span className={styles.confirmed}>CONFIRMED ✅</span></div>
        </div>
        <div className={styles.confirmSent}>
          <div>✅ Email: sarah@email.com</div>
          <div>✅ SMS: +91 98765 43210</div>
        </div>
      </Card>

      <Card variant="outlined" padding="lg">
        <h2 className={styles.stepsTitle}>What Happens Next</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1️⃣</span>
            <div className={styles.stepContent}>
              <h4>Fabric Pickup (Tomorrow, 2:00 PM)</h4>
              <p>Zavestro specialist will pick up your fabric</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2️⃣</span>
            <div className={styles.stepContent}>
              <h4>Delivered to Tailor (Day 2-3)</h4>
              <p>Fabric transported to {tailor?.name || 'your tailor'}</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3️⃣</span>
            <div className={styles.stepContent}>
              <h4>Stitching In Progress (Days 4-14)</h4>
              <p>Tailor starts work on your garment</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>4️⃣</span>
            <div className={styles.stepContent}>
              <h4>Quality Check & Delivery (Day 15)</h4>
              <p>Final quality check and ships to your address</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>5️⃣</span>
            <div className={styles.stepContent}>
              <h4>Delivery to Your Home (Days 16-18)</h4>
              <p>Track your shipment in the app</p>
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>6️⃣</span>
            <div className={styles.stepContent}>
              <h4>Enjoy & Review</h4>
              <p>Leave reviews and share photos!</p>
            </div>
          </div>
        </div>
      </Card>

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={() => navigate(`/orders/${orderId}`)}>View Order Details</button>
        <button className={styles.actionBtn} onClick={() => navigate(`/orders/${orderId}`)}>Track Fabric Pickup</button>
        <button className={styles.actionBtn}>Message Tailor</button>
        <button className={styles.primaryBtn} onClick={() => navigate('/')}>Continue Shopping</button>
      </div>

      <div className={styles.support}>
        Questions? <button className={styles.linkBtn}>Contact Support</button>
      </div>
    </div>
  );
};
