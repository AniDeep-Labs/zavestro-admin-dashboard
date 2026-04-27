import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge } from '../../components';
import { designs, sampleOrders, tailors } from '../../data/mockData';
import styles from './HomePage.module.css';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* Welcome */}
      <section className={styles.welcome}>
        <h1 className={styles.greeting}>Welcome Back, Sarah! 👋</h1>
        <p className={styles.subtitle}>Let's create something amazing</p>
      </section>

      {/* Quick Start */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Start</h2>
        <div className={styles.quickStart}>
          <Card variant="outlined" hoverable padding="lg" onClick={() => navigate('/fabrics')}>
            <div className={styles.quickCard}>
              <span className={styles.quickIcon}>📦</span>
              <h3 className={styles.quickTitle}>Buy Fabric</h3>
              <p className={styles.quickDesc}>Browse our premium fabric collection</p>
              <span className={styles.quickLink}>Browse Fabrics →</span>
            </div>
          </Card>
          <Card variant="outlined" hoverable padding="lg" onClick={() => navigate('/own-fabric')}>
            <div className={styles.quickCard}>
              <span className={styles.quickIcon}>👜</span>
              <h3 className={styles.quickTitle}>Use My Own Fabric</h3>
              <p className={styles.quickDesc}>I already have fabric at home</p>
              <span className={styles.quickLink}>Use My Fabric →</span>
            </div>
          </Card>
        </div>
      </section>

      {/* Trending Designs */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Trending Designs</h2>
          <button className={styles.viewAll} onClick={() => navigate('/designs')}>View All →</button>
        </div>
        <div className={styles.designGrid}>
          {designs.slice(0, 6).map((design) => (
            <Card key={design.id} variant="default" hoverable padding="sm" onClick={() => navigate(`/designs/${design.id}`)}>
              <div className={styles.designImagePlaceholder}>
                <span>{design.type[0]}</span>
              </div>
              <div className={styles.designInfo}>
                <h4 className={styles.designName}>{design.name}</h4>
                <p className={styles.designDesigner}>{design.designer}</p>
                <div className={styles.designMeta}>
                  <span className={styles.rating}>⭐ {design.rating}</span>
                  <span className={styles.price}>₹{design.basePrice.toLocaleString()}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Your Orders */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Your Orders</h2>
          <button className={styles.viewAll} onClick={() => navigate('/orders')}>View All →</button>
        </div>
        <div className={styles.ordersList}>
          {sampleOrders.map((order) => (
            <Card key={order.id} variant="outlined" padding="md" onClick={() => navigate(`/orders/${order.id}`)}>
              <div className={styles.orderRow}>
                <div className={styles.orderInfo}>
                  <span className={styles.orderName}>{order.customerName}: {order.designName}</span>
                  <span className={styles.orderStatus}>{order.status}: {order.statusDetail}</span>
                </div>
                <Badge
                  variant={order.progress >= 90 ? 'success' : order.progress >= 50 ? 'primary' : 'warning'}
                  size="sm"
                >
                  {order.progress}%
                </Badge>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${order.progress}%` }} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Recommended Tailors */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recommended Tailors</h2>
        <p className={styles.sectionSubtitle}>Based on your previous orders</p>
        <div className={styles.tailorGrid}>
          {tailors.slice(0, 2).map((tailor) => (
            <Card key={tailor.id} variant="default" hoverable padding="md">
              <div className={styles.tailorCard}>
                <div className={styles.tailorAvatar}>{tailor.name[0]}</div>
                <div className={styles.tailorInfo}>
                  <h4 className={styles.tailorName}>{tailor.name}</h4>
                  <span className={styles.tailorMeta}>⭐ {tailor.rating} · ₹{tailor.basePrice.toLocaleString()}</span>
                  <span className={styles.tailorLocation}>{tailor.location}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};
