import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '../../components';
import {
  earningsSummary,
  designerDesigns,
  designerOrders,
  bankDetails,
  payoutHistory,
} from '../../data/designerMockData';
import styles from './EarningsPayoutsPage.module.css';

export const EarningsPayoutsPage: React.FC = () => {
  const navigate = useNavigate();
  const topEarningDesigns = designerDesigns
    .filter(d => d.earningsThisMonth > 0)
    .sort((a, b) => b.earningsThisMonth - a.earningsThisMonth)
    .slice(0, 3);

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/designer/dashboard')}>← Earnings & Payouts</button>

      {/* Earnings Summary */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Earnings Summary</h2>
        <div className={styles.summaryGrid}>
          <div>
            <div className={styles.summaryValue}>₹{earningsSummary.totalAllTime.toLocaleString()}</div>
            <div className={styles.summaryLabel}>Total (All Time)</div>
          </div>
          <div>
            <div className={styles.summaryValue}>₹{earningsSummary.thisMonth.toLocaleString()}</div>
            <div className={styles.summaryLabel}>This Month</div>
          </div>
          <div>
            <div className={styles.summaryValue}>₹{earningsSummary.thisWeek.toLocaleString()}</div>
            <div className={styles.summaryLabel}>This Week</div>
          </div>
        </div>
      </Card>

      {/* Payout Status */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Payout Status</h2>
        <div className={styles.payoutGrid}>
          <div className={styles.payoutItem}>
            <span className={styles.payoutItemLabel}>Available for Payout</span>
            <span className={styles.payoutItemValue}>₹{earningsSummary.availablePayout.toLocaleString()}</span>
          </div>
          <div className={styles.payoutItem}>
            <span className={styles.payoutItemLabel}>Last Payout</span>
            <span className={styles.payoutItemValue}>₹{earningsSummary.lastPayoutAmount.toLocaleString()} ({earningsSummary.lastPayoutDate})</span>
          </div>
          <div className={styles.payoutItem}>
            <span className={styles.payoutItemLabel}>Next Payout</span>
            <span className={styles.payoutItemValue}>{earningsSummary.nextPayoutDate}</span>
          </div>
          <div className={styles.payoutItem}>
            <span className={styles.payoutItemLabel}>Frequency</span>
            <span className={styles.payoutItemValue}>{earningsSummary.payoutFrequency}</span>
          </div>
        </div>
      </Card>

      {/* Earnings Breakdown */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Earnings Breakdown</h2>
        <div className={styles.breakdownList}>
          {topEarningDesigns.map(d => (
            <div key={d.id} className={styles.breakdownItem}>
              <span className={styles.breakdownName}>{d.name}</span>
              <span className={styles.breakdownValue}>₹{d.earningsThisMonth.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className={styles.breakdownActions}>
          <Button variant="outline" size="sm">View Detailed History</Button>
          <Button variant="primary" size="sm">Withdraw Now</Button>
        </div>
      </Card>

      {/* Recent Orders */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Recent Orders With Your Designs</h2>
        <div className={styles.orderList}>
          {designerOrders.slice(0, 3).map(order => (
            <div key={order.id} className={styles.orderItem}>
              <div className={styles.orderInfo}>
                <span className={styles.orderCustomer}>{order.customerName} - {order.designName}</span>
                <span className={styles.orderDesign}>
                  {order.status === 'Delivered' || order.status === 'Completed'
                    ? `✓ ${order.status}`
                    : `🧵 ${order.status}`}
                  {order.rating && ` · ${'⭐'.repeat(order.rating)}`}
                </span>
                {order.review && (
                  <span className={styles.orderReview}>"{order.review}"</span>
                )}
              </div>
              <div className={styles.orderRight}>
                <span className={order.isPending ? styles.orderPending : styles.orderEarned}>
                  ₹{order.earned} {order.isPending ? 'pending' : 'earned'}
                </span>
                <Badge
                  variant={order.isPending ? 'warning' : 'success'}
                  size="sm"
                >
                  {order.isPending ? 'Pending' : 'Paid'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm">View All Orders</Button>
      </Card>

      {/* Payment Method */}
      <Card variant="outlined" padding="md">
        <h2 className={styles.sectionTitle}>Payment Methods</h2>
        <div className={styles.bankCard}>
          <div className={styles.bankInfo}>
            <span className={styles.bankName}>{bankDetails.bankName}</span>
            <span className={styles.bankAccount}>Account: {bankDetails.accountNumber}</span>
          </div>
          <Button variant="outline" size="sm">Update Bank Details</Button>
        </div>
      </Card>

      {/* Payout History */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Payout History</h2>
        <div className={styles.historyList}>
          {payoutHistory.map(p => (
            <div key={p.id} className={styles.historyItem}>
              <span className={styles.historyDate}>{p.date}</span>
              <span className={styles.historyAmount}>₹{p.amount.toLocaleString()}</span>
              <span className={styles.historyStatus}>{p.status}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm">View Complete History</Button>
      </Card>
    </div>
  );
};
