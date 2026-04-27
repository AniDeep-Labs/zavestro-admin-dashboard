import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components';
import { useOrder } from '../../context/OrderContext';
import styles from './OrderSummaryPage.module.css';

export const OrderSummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useOrder();

  const design = state.selectedDesign;
  const tailor = state.selectedTailor;
  const isOwn = state.fabricSource === 'own';
  const ownFabric = state.ownFabricDetails;
  const zavestroFabric = state.selectedFabric;

  const pickupCost = isOwn && tailor?.canPickup ? tailor.pickupCost : 0;
  const designerFee = design?.designerFee || 0;
  const stitchingPrice = tailor?.basePrice || design?.basePrice || 0;
  const fabricCost = !isOwn && zavestroFabric ? zavestroFabric.pricePerMeter * (state.fabricMeters || design?.fabricRequirements.minLength || 6) : 0;
  const platformFee = 200;
  const total = pickupCost + designerFee + stitchingPrice + fabricCost + platformFee;

  const measurements = Object.values(state.measurements);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Order Summary</h1>

      {/* Fabric */}
      <Card variant="default" padding="md">
        <h3 className={styles.sectionIcon}>🧵 Fabric</h3>
        {isOwn && ownFabric ? (
          <div className={styles.details}>
            <span className={styles.detailLabel}>YOUR OWN FABRIC</span>
            <div className={styles.detailRow}><span>Type:</span><span>{ownFabric.type}</span></div>
            <div className={styles.detailRow}><span>Color:</span><span>{ownFabric.color}</span></div>
            <div className={styles.detailRow}><span>Quantity:</span><span>{ownFabric.quantity} meters</span></div>
            <div className={styles.detailRow}><span>Condition:</span><span>{ownFabric.condition === 'new' ? 'Brand new' : ownFabric.condition}</span></div>
            {pickupCost > 0 && (
              <>
                <h4 className={styles.subheading}>Pickup Details</h4>
                <div className={styles.detailRow}><span>Date:</span><span>Tomorrow</span></div>
                <div className={styles.detailRow}><span>Time:</span><span>2:00 PM - 3:00 PM</span></div>
                <div className={styles.detailRow}><span>Address:</span><span>{ownFabric.pickupAddress}</span></div>
                <div className={styles.detailRow}><span>Pickup Cost:</span><span>₹{pickupCost}</span></div>
              </>
            )}
          </div>
        ) : zavestroFabric ? (
          <div className={styles.details}>
            <span className={styles.detailLabel}>ZAVESTRO FABRIC</span>
            <div className={styles.detailRow}><span>Name:</span><span>{zavestroFabric.name}</span></div>
            <div className={styles.detailRow}><span>Material:</span><span>{zavestroFabric.material}</span></div>
            <div className={styles.detailRow}><span>Price:</span><span>₹{zavestroFabric.pricePerMeter}/meter</span></div>
            <div className={styles.detailRow}><span>Total Fabric Cost:</span><span>₹{fabricCost.toLocaleString()}</span></div>
          </div>
        ) : (
          <p className={styles.notSelected}>No fabric selected</p>
        )}
      </Card>

      {/* Design */}
      <Card variant="default" padding="md">
        <h3 className={styles.sectionIcon}>👗 Design</h3>
        {design ? (
          <div className={styles.details}>
            <div className={styles.detailRow}><span>{design.name}</span></div>
            <div className={styles.detailRow}><span>Designer:</span><span>{design.designer} ⭐{design.rating}</span></div>
            <div className={styles.detailRow}><span>Designer Fee:</span><span>₹{designerFee}</span></div>
          </div>
        ) : <p className={styles.notSelected}>No design selected</p>}
      </Card>

      {/* Tailor / Stitching */}
      <Card variant="default" padding="md">
        <h3 className={styles.sectionIcon}>✂️ Stitching</h3>
        {tailor ? (
          <div className={styles.details}>
            <div className={styles.detailRow}><span>Tailor:</span><span>{tailor.name}</span></div>
            <div className={styles.detailRow}><span>Stitching Price:</span><span>₹{stitchingPrice.toLocaleString()}</span></div>
            <div className={styles.detailRow}><span>Estimated Time:</span><span>{tailor.estimatedDays} days</span></div>
            <div className={styles.detailRow}><span>Rating:</span><span>⭐{tailor.rating} ({tailor.reviews} reviews)</span></div>

            <h4 className={styles.subheading}>Timeline</h4>
            <div className={styles.timeline}>
              <div className={styles.timelineItem}>Tomorrow: Fabric picked up</div>
              <div className={styles.timelineItem}>Day 2: Delivered to tailor</div>
              <div className={styles.timelineItem}>Day 4-14: Stitching in progress</div>
              <div className={styles.timelineItem}>Day 15: Quality check & ready</div>
              <div className={styles.timelineItem}>Day 16: Shipped to you</div>
              <div className={styles.timelineItem}>Day 17-18: Delivery to your address</div>
            </div>
          </div>
        ) : <p className={styles.notSelected}>No tailor selected</p>}
      </Card>

      {/* Measurements */}
      <Card variant="default" padding="md">
        <h3 className={styles.sectionIcon}>📏 Measurements {measurements.length > 0 ? '✅ CONFIRMED' : ''}</h3>
        {measurements.length > 0 ? (
          <div className={styles.measurementsList}>
            {measurements.map((m) => (
              <span key={m.id}>{m.id}: {m.value}cm</span>
            ))}
          </div>
        ) : (
          <p className={styles.notSelected}>No measurements yet</p>
        )}
      </Card>

      {/* Price Breakdown */}
      <Card variant="elevated" padding="lg">
        <h3 className={styles.priceTitle}>Price Breakdown</h3>
        <div className={styles.priceBreakdown}>
          {fabricCost > 0 && <div className={styles.priceRow}><span>Fabric Cost:</span><span>₹{fabricCost.toLocaleString()}</span></div>}
          {pickupCost > 0 && <div className={styles.priceRow}><span>Pickup Cost:</span><span>₹{pickupCost}</span></div>}
          <div className={styles.priceRow}><span>Design Fee:</span><span>₹{designerFee}</span></div>
          <div className={styles.priceRow}><span>Stitching:</span><span>₹{stitchingPrice.toLocaleString()}</span></div>
          <div className={styles.priceRow}><span>Measurement Service:</span><span>₹0 (FREE)</span></div>
          <div className={styles.priceRow}><span>Platform Fee:</span><span>₹{platformFee}</span></div>
          <div className={styles.priceDivider} />
          <div className={`${styles.priceRow} ${styles.totalRow}`}><span>TOTAL:</span><span>₹{total.toLocaleString()}</span></div>
        </div>
      </Card>

      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => navigate(-1)}>Edit Order</button>
        <button className={styles.payBtn} onClick={() => navigate('/order-confirmation')}>Proceed to Payment →</button>
      </div>
    </div>
  );
};
