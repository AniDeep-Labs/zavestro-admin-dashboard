import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Select } from '../../components';
import { designerDesigns } from '../../data/designerMockData';
import styles from './MyDesignsPage.module.css';

const filterOptions = [
  { value: 'all', label: 'All Categories' },
  { value: 'saree', label: 'Saree' },
  { value: 'kurta', label: 'Kurta' },
  { value: 'lehenga', label: 'Lehenga' },
];

const tabList = [
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'archived', label: 'Archived' },
];

export const MyDesignsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('published');

  const filteredDesigns = designerDesigns.filter(d => {
    if (activeTab === 'published') return d.status === 'published';
    if (activeTab === 'drafts') return d.status === 'draft';
    if (activeTab === 'archived') return d.status === 'archived';
    return true;
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case 'published': return 'success' as const;
      case 'draft': return 'warning' as const;
      default: return 'info' as const;
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.back} onClick={() => navigate('/designer/dashboard')}>← My Designs</button>
        <div className={styles.headerActions}>
          <Select options={filterOptions} value="all" onChange={() => {}} />
          <Button variant="primary" size="sm" onClick={() => navigate('/designer/upload/details')}>+ New Design</Button>
        </div>
      </div>

      <div className={styles.tabList} role="tablist">
        {tabList.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.designCount}>
        {filteredDesigns.length} {activeTab} design{filteredDesigns.length !== 1 ? 's' : ''}
      </div>

      <div className={styles.designGrid}>
        {filteredDesigns.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <div className={styles.emptyText}>No {activeTab} designs yet</div>
          </div>
        ) : (
          filteredDesigns.map(design => (
            <div key={design.id} className={styles.designCard}>
              <div className={styles.designThumb}>🎨</div>
              <div className={styles.designInfo}>
                <h3 className={styles.designName}>{design.name}</h3>
                <div className={styles.designMeta}>
                  <Badge variant={statusVariant(design.status)} size="sm">
                    {design.status === 'published' ? '✓ Published' : design.status === 'draft' ? 'Draft' : 'Archived'}
                  </Badge>
                  {design.rating > 0 && (
                    <span className={styles.designRating}>⭐ {design.rating} ({design.reviews} reviews)</span>
                  )}
                </div>
                <div className={styles.designStatsRow}>
                  <div className={styles.designStat}>
                    <span className={styles.designStatValue}>{design.views.toLocaleString()}</span>
                    <span className={styles.designStatLabel}>Views</span>
                  </div>
                  <div className={styles.designStat}>
                    <span className={styles.designStatValue}>{design.orders}</span>
                    <span className={styles.designStatLabel}>Orders</span>
                  </div>
                  <div className={styles.designStat}>
                    <span className={styles.designStatValue}>₹{design.earningsThisMonth.toLocaleString()}</span>
                    <span className={styles.designStatLabel}>This Month</span>
                  </div>
                  <div className={styles.designStat}>
                    <span className={styles.designStatValue}>₹{design.earningsTotal.toLocaleString()}</span>
                    <span className={styles.designStatLabel}>Total Earnings</span>
                  </div>
                </div>
                <div className={styles.designFooter}>
                  <span className={styles.designDate}>Created: {design.createdDate}</span>
                  <div className={styles.designActions}>
                    <Button variant="outline" size="sm" onClick={() => navigate('/designer/analytics')}>View Analytics</Button>
                    <Button variant="ghost" size="sm">Edit Info</Button>
                    <Button variant="ghost" size="sm">View Orders</Button>
                    {design.status === 'published' && <Button variant="ghost" size="sm">Archive</Button>}
                    {design.status !== 'published' && <Button variant="danger" size="sm">Delete</Button>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredDesigns.length > 3 && (
        <div className={styles.loadMore}>
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
};
