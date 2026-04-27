import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge } from '../../components';
import { useOrder } from '../../context/OrderContext';
import { tailors } from '../../data/mockData';
import styles from './TailorSelectionPage.module.css';

export const TailorSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useOrder();
  const [ratingFilter, setRatingFilter] = useState('All');
  const [sortBy, setSortBy] = useState('best');

  const filtered = useMemo(() => {
    let list = [...tailors];
    if (ratingFilter === '4+') list = list.filter(t => t.rating >= 4);
    if (ratingFilter === '4.5+') list = list.filter(t => t.rating >= 4.5);
    if (sortBy === 'best') list.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'price') list.sort((a, b) => a.basePrice - b.basePrice);
    if (sortBy === 'distance') list.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    return list;
  }, [ratingFilter, sortBy]);

  const handleSelect = (tailor: typeof tailors[0]) => {
    dispatch({ type: 'SET_TAILOR', payload: tailor });
    navigate('/order-summary');
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)}>← Select Tailor</button>

      {/* Order summary quick view */}
      {state.selectedDesign && (
        <Card variant="outlined" padding="sm">
          <div className={styles.orderQuick}>
            <div><strong>Fabric:</strong> {state.fabricSource === 'own' ? `Your Own (${state.ownFabricDetails?.color} ${state.ownFabricDetails?.type})` : state.selectedFabric?.name || 'Not selected'}</div>
            <div><strong>Design:</strong> {state.selectedDesign.name}</div>
            <div><strong>Measurements:</strong> {Object.keys(state.measurements).length > 0 ? '✅ Confirmed' : '⏳ Pending'}</div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Rating:</span>
          {['All', '4+', '4.5+'].map((r) => (
            <button key={r} className={`${styles.chip} ${ratingFilter === r ? styles.chipActive : ''}`} onClick={() => setRatingFilter(r)}>
              {r === 'All' ? 'All' : `${r}⭐`}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Sort:</span>
          {[{l: 'Best Match', v: 'best'}, {l: 'Price', v: 'price'}, {l: 'Distance', v: 'distance'}].map((s) => (
            <button key={s.v} className={`${styles.chip} ${sortBy === s.v ? styles.chipActive : ''}`} onClick={() => setSortBy(s.v)}>{s.l}</button>
          ))}
        </div>
      </div>

      <h3 className={styles.recommended}>⭐ Recommended for You</h3>

      {/* Tailor cards */}
      <div className={styles.tailorList}>
        {filtered.map((tailor) => (
          <Card key={tailor.id} variant="default" padding="lg">
            <div className={styles.tailorHeader}>
              <div className={styles.tailorAvatar}>{tailor.name[0]}</div>
              <div className={styles.tailorHeaderInfo}>
                <h3 className={styles.tailorName}>{tailor.name}</h3>
                <span className={styles.tailorRating}>⭐ {tailor.rating} ({tailor.reviews} reviews)</span>
              </div>
            </div>

            <div className={styles.tailorSpecs}>
              <div className={styles.specItem}><span>Location:</span><span>{tailor.location} ({tailor.distance} away)</span></div>
              <div className={styles.specItem}><span>Speciality:</span><span>{tailor.speciality.join(', ')}</span></div>
              <div className={styles.specItem}><span>Experience:</span><span>{tailor.experience} years</span></div>
              <div className={styles.specItem}><span>Response Time:</span><span>{tailor.responseTime}</span></div>
            </div>

            <div className={styles.pricingBox}>
              <div className={styles.specItem}><span>Stitching Price:</span><span className={styles.priceVal}>₹{tailor.basePrice.toLocaleString()}</span></div>
              <div className={styles.specItem}><span>Estimated Timeline:</span><span>{tailor.estimatedDays} days</span></div>
              <div className={styles.specItem}><span>Success Rate:</span><span>{tailor.successRate}%</span></div>
            </div>

            {tailor.canPickup && (
              <div className={styles.pickup}>
                ✅ Can pick your fabric from home (₹{tailor.pickupCost} pickup cost)
              </div>
            )}

            <div className={styles.reviewsSection}>
              <span className={styles.reviewLabel}>Recent Reviews:</span>
              {tailor.recentReviews.map((r, i) => (
                <div key={i} className={styles.reviewItem}>
                  <span>{'⭐'.repeat(r.rating)}</span>
                  <span>"{r.text}"</span>
                </div>
              ))}
            </div>

            <div className={styles.strengths}>
              {tailor.strengths.map((s, i) => (
                <Badge key={i} variant="primary" size="sm">{s}</Badge>
              ))}
            </div>

            <div className={styles.tailorActions}>
              <button className={styles.profileBtn}>View Full Profile</button>
              <button className={styles.selectTailorBtn} onClick={() => handleSelect(tailor)}>Select This Tailor</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
