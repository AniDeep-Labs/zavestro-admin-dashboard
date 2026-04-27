import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatCard, Button, Badge } from '../../components';
import {
  designerProfile,
  designerStats,
  designerDesigns,
  designerOrders,
  earningsSummary,
  customerReviews,
} from '../../data/designerMockData';
import styles from './DesignerDashboardPage.module.css';

export const DesignerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const topDesigns = designerDesigns.filter(d => d.status === 'published').slice(0, 3);
  const recentOrders = designerOrders.slice(0, 3);

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.welcome}>Welcome, {designerProfile.ownerName.split(' ')[0]}!</h1>
        <p className={styles.welcomeSub}>{designerProfile.brandName} · {designerProfile.followers.toLocaleString()} Followers</p>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard label="Design Views" value={designerStats.designViews.toLocaleString()} />
        <StatCard label="New Followers" value={`+${designerStats.newFollowers}`} />
        <StatCard label="Orders Placed" value={String(designerStats.ordersPlaced)} />
        <StatCard label="Earnings" value={`₹${designerStats.earnings.toLocaleString()}`} />
        <StatCard label="Avg Rating" value={`${designerStats.avgRating} ⭐`} />
      </div>

      {/* Top Performing Designs */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Top Performing Designs</h2>
        <div className={styles.designList}>
          {topDesigns.map((design, i) => (
            <div key={design.id} className={styles.designItem}>
              <div>
                <div className={styles.designName}>{i + 1}. {design.name}</div>
                <div className={styles.designStats}>
                  Views: {design.views.toLocaleString()} | Orders: {design.orders} | Earnings: ₹{design.earningsThisMonth.toLocaleString()}
                </div>
              </div>
              <div className={styles.designActions}>
                <Button variant="outline" size="sm" onClick={() => navigate('/designer/analytics')}>View Analytics</Button>
                <Button variant="ghost" size="sm">Edit</Button>
                <Button variant="ghost" size="sm">Archive</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Earnings & Payouts */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Earnings & Payouts</h2>
        <div className={styles.earningsGrid}>
          <div className={styles.earningItem}>
            <div className={styles.earningValue}>₹{earningsSummary.totalAllTime.toLocaleString()}</div>
            <div className={styles.earningLabel}>Total Earned (All Time)</div>
          </div>
          <div className={styles.earningItem}>
            <div className={styles.earningValue}>₹{earningsSummary.thisMonth.toLocaleString()}</div>
            <div className={styles.earningLabel}>This Month</div>
          </div>
          <div className={styles.earningItem}>
            <div className={styles.earningValue}>₹{earningsSummary.availablePayout.toLocaleString()}</div>
            <div className={styles.earningLabel}>Pending Payout</div>
          </div>
        </div>
        <div className={styles.payoutInfo}>
          <span>Last Payout: ₹{earningsSummary.lastPayoutAmount.toLocaleString()} ({earningsSummary.lastPayoutDate})</span>
          <span>Payout Schedule: {earningsSummary.payoutFrequency}</span>
          <span>Next Payout: {earningsSummary.nextPayoutDate}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/designer/earnings')}>
          View Payment History
        </Button>
      </Card>

      {/* Recent Orders */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Recent Orders</h2>
        <div className={styles.orderList}>
          {recentOrders.map(order => (
            <div key={order.id} className={styles.orderItem}>
              <div>
                <div className={styles.orderCustomer}>{order.customerName} ordered {order.designName}</div>
                <div className={styles.orderDetail}>
                  Status: {order.status}
                  {order.rating && ` · ${'⭐'.repeat(order.rating)}`}
                </div>
              </div>
              <div className={styles.orderEarned}>
                ₹{order.earned} {order.isPending ? <Badge variant="warning" size="sm">pending</Badge> : 'earned'}
              </div>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm">View All Orders</Button>
      </Card>

      {/* Customer Reviews */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Customer Reviews</h2>
        <div className={styles.ratingBig}>{designerProfile.rating} ⭐</div>
        <div className={styles.ratingLabel}>Average Rating ({designerProfile.reviews} reviews)</div>
        <div className={styles.reviewCard}>
          <div className={styles.reviewRating}>{'⭐'.repeat(customerReviews[0].rating)}</div>
          <div className={styles.reviewText}>"{customerReviews[0].text}"</div>
          <div className={styles.reviewAuthor}>{customerReviews[0].customerName}</div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.quickActions}>
          <Button variant="primary" onClick={() => navigate('/designer/upload/details')}>+ Upload New Design</Button>
          <Button variant="outline" onClick={() => navigate('/designer/designs')}>View All Designs</Button>
          <Button variant="outline" onClick={() => navigate('/designer/analytics')}>View Analytics</Button>
          <Button variant="outline">Manage Collaborations</Button>
        </div>
      </Card>
    </div>
  );
};
