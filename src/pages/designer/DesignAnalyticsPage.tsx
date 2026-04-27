import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatCard, Button } from '../../components';
import { designAnalytics } from '../../data/designerMockData';
import styles from './DesignAnalyticsPage.module.css';

export const DesignAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const totalReviews = designAnalytics.reviewBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/designer/designs')}>
        ← Design Analytics: Royal Embroidered Saree
      </button>

      {/* Performance Overview */}
      <div className={styles.statsGrid}>
        <StatCard label="Total Views" value={designAnalytics.totalViews.toLocaleString()} />
        <StatCard label="Total Orders" value={String(designAnalytics.totalOrders)} />
        <StatCard label="Total Revenue" value={`₹${designAnalytics.totalRevenue.toLocaleString()}`} />
        <StatCard label="Avg Rating" value={`${designAnalytics.avgRating} ⭐`} />
        <StatCard label="Conversion Rate" value={`${designAnalytics.conversionRate}%`} />
      </div>

      {/* Views Trend */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Views Trend (Last 30 days)</h2>
        <div className={styles.graphPlaceholder}>📈 Views trend graph</div>
        <div className={styles.trendRow}>
          <div>
            <div className={styles.trendValue}>{designAnalytics.viewsCurrentMonth.toLocaleString()}</div>
            <div className={styles.trendLabel}>Current Month</div>
          </div>
          <div>
            <div className={styles.trendValue}>{designAnalytics.viewsPreviousMonth.toLocaleString()}</div>
            <div className={styles.trendLabel}>Previous Month</div>
          </div>
          <div>
            <div className={`${styles.trendValue} ${styles.trendGrowth}`}>+{designAnalytics.viewsGrowth}%</div>
            <div className={styles.trendLabel}>Growth</div>
          </div>
        </div>
      </Card>

      {/* Orders Trend */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Orders Trend (Last 30 days)</h2>
        <div className={styles.graphPlaceholder}>📊 Orders trend graph</div>
        <div className={styles.trendRow}>
          <div>
            <div className={styles.trendValue}>{designAnalytics.ordersCurrentMonth}</div>
            <div className={styles.trendLabel}>Current Month</div>
          </div>
          <div>
            <div className={styles.trendValue}>{designAnalytics.ordersPreviousMonth}</div>
            <div className={styles.trendLabel}>Previous Month</div>
          </div>
          <div>
            <div className={`${styles.trendValue} ${styles.trendGrowth}`}>+{designAnalytics.ordersGrowth}%</div>
            <div className={styles.trendLabel}>Growth</div>
          </div>
        </div>
      </Card>

      {/* Customer Reviews */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Customer Reviews</h2>
        <div className={styles.ratingBig}>
          <div className={styles.ratingValue}>{designAnalytics.avgRating} ⭐</div>
          <div className={styles.ratingLabel}>Average Rating ({totalReviews} reviews)</div>
        </div>
        <div className={styles.reviewsBreakdown}>
          {designAnalytics.reviewBreakdown.map(r => (
            <div key={r.stars} className={styles.reviewRow}>
              <span className={styles.reviewStars}>{r.stars}⭐</span>
              <div className={styles.reviewBar}>
                <div
                  className={styles.reviewBarFill}
                  style={{ width: totalReviews > 0 ? `${(r.count / totalReviews) * 100}%` : '0%' }}
                />
              </div>
              <span className={styles.reviewCount}>{r.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Popular Tailor Combinations */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Popular Tailor Combinations</h2>
        <div className={styles.tailorList}>
          {designAnalytics.popularTailors.map((t, i) => (
            <div key={t.name} className={styles.tailorItem}>
              <span className={styles.tailorName}>{i + 1}. {t.name}</span>
              <span className={styles.tailorOrders}>{t.orders} orders</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Customer Demographics */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Customer Demographics</h2>
        <div className={styles.demographicsGrid}>
          <div className={styles.demoSection}>
            <div className={styles.demoTitle}>Age Groups</div>
            {designAnalytics.demographics.ageGroups.map(g => (
              <div key={g.label} className={styles.demoItem}>
                <span className={styles.demoLabel}>{g.label}</span>
                <span className={styles.demoValue}>{g.percentage}%</span>
              </div>
            ))}
          </div>
          <div className={styles.demoSection}>
            <div className={styles.demoTitle}>Top Cities</div>
            {designAnalytics.demographics.topCities.map(c => (
              <div key={c} className={styles.demoItem}>
                <span className={styles.demoLabel}>{c}</span>
              </div>
            ))}
          </div>
          <div className={styles.demoSection}>
            <div className={styles.demoTitle}>Repeat Customers</div>
            <div className={styles.demoItem}>
              <span className={styles.demoValue}>{designAnalytics.demographics.repeatCustomers}%</span>
            </div>
          </div>
        </div>
      </Card>

      <Button variant="outline" onClick={() => navigate('/designer/designs')}>← Back to My Designs</Button>
    </div>
  );
};
