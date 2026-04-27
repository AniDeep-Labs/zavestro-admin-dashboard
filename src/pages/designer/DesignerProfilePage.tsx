import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '../../components';
import { designerProfile, designerDesigns, customerReviews } from '../../data/designerMockData';
import styles from './DesignerProfilePage.module.css';

const specialties = [
  { name: 'Sarees', level: 'Expert' },
  { name: 'Lehengas', level: 'Expert' },
  { name: 'Fusion Wear', level: 'Advanced' },
  { name: 'Custom Designs', level: 'Available' },
];

const featuredDesigns = designerDesigns.filter(d => d.status === 'published').slice(0, 6);

export const DesignerProfilePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.back} onClick={() => navigate('/designer/dashboard')}>← Designer Profile</button>
        <Button variant="outline" size="sm">Edit Profile</Button>
      </div>

      {/* Profile Header */}
      <Card variant="default" padding="lg">
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>P</div>
          <div className={styles.profileInfo}>
            <h1 className={styles.brandName}>{designerProfile.brandName}</h1>
            <div className={styles.profileMeta}>
              <span>⭐ {designerProfile.rating} ({designerProfile.reviews} reviews)</span>
              <span>{designerProfile.followers.toLocaleString()} Followers</span>
              <span>Member Since: {designerProfile.memberSince}</span>
            </div>
            <p className={styles.bio}>"{designerProfile.bio}"</p>
          </div>
        </div>
      </Card>

      {/* Specialties */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Specialties</h2>
        <div className={styles.specialtiesList}>
          {specialties.map(s => (
            <div key={s.name} className={styles.specialtyItem}>
              <span className={styles.specialtyName}>{s.name}</span>
              <span className={styles.specialtyLevel}>{s.level}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Portfolio Statistics */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Portfolio Statistics</h2>
        <div className={styles.portfolioStats}>
          <div>
            <div className={styles.portfolioStatValue}>{designerProfile.totalDesigns}</div>
            <div className={styles.portfolioStatLabel}>Total Designs</div>
          </div>
          <div>
            <div className={styles.portfolioStatValue}>Royal Saree</div>
            <div className={styles.portfolioStatLabel}>Most Popular</div>
          </div>
          <div>
            <div className={styles.portfolioStatValue}>{designerProfile.totalOrders.toLocaleString()}+</div>
            <div className={styles.portfolioStatLabel}>Total Orders</div>
          </div>
          <div>
            <div className={styles.portfolioStatValue}>{designerProfile.satisfaction}%</div>
            <div className={styles.portfolioStatLabel}>Satisfaction</div>
          </div>
          <div>
            <div className={styles.portfolioStatValue}>{designerProfile.rating} ⭐</div>
            <div className={styles.portfolioStatLabel}>Avg Rating</div>
          </div>
        </div>
      </Card>

      {/* Featured Designs */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Featured Designs</h2>
        <div className={styles.designsGrid}>
          {featuredDesigns.map(d => (
            <div key={d.id} className={styles.designCard}>
              <div className={styles.designThumb}>🎨</div>
              <div className={styles.designCardName}>{d.name}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Customer Reviews */}
      <Card variant="default" padding="lg">
        <h2 className={styles.sectionTitle}>Recent Customer Reviews</h2>
        <div className={styles.reviewsList}>
          {customerReviews.map(r => (
            <div key={r.id} className={styles.reviewItem}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewRating}>{'⭐'.repeat(r.rating)}</span>
                {r.verified && (
                  <Badge variant="success" size="sm">Verified Purchase</Badge>
                )}
              </div>
              <div className={styles.reviewText}>"{r.text}"</div>
              <div className={styles.reviewAuthor}>{r.customerName} · {r.date}</div>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm">View All Reviews</Button>
      </Card>

      {/* Social & Contact */}
      <Card variant="outlined" padding="md">
        <h2 className={styles.sectionTitle}>Social & Contact</h2>
        <div className={styles.socialList}>
          <div className={styles.socialItem}>
            <span className={styles.socialIcon}>📸</span>
            Instagram: {designerProfile.instagram}
          </div>
          <div className={styles.socialItem}>
            <span className={styles.socialIcon}>🌐</span>
            Website: {designerProfile.website}
          </div>
          <div className={styles.socialItem}>
            <span className={styles.socialIcon}>📧</span>
            Email: {designerProfile.email}
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className={styles.profileActions}>
        <Button variant="primary">Follow</Button>
        <Button variant="outline">Message</Button>
        <Button variant="outline">Share Profile</Button>
      </div>
    </div>
  );
};
