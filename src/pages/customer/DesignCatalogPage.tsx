import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SearchInput, Badge } from '../../components';
import { designs } from '../../data/mockData';
import styles from './DesignCatalogPage.module.css';

const TYPES = ['All', 'Saree', 'Lehenga', 'Kurta', 'Dress', 'Salwar'];
const COMPLEXITY = ['All', 'Simple', 'Medium', 'Complex'];

export const DesignCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const [complexity, setComplexity] = useState('All');

  const filtered = useMemo(() => {
    return designs.filter((d) => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (type !== 'All' && d.type !== type) return false;
      if (complexity !== 'All' && d.complexity !== complexity) return false;
      return true;
    });
  }, [search, type, complexity]);

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)}>← Designs</button>
      <SearchInput value={search} onChange={setSearch} placeholder="Search designs..." />

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Type:</span>
          <div className={styles.chips}>
            {TYPES.map((t) => (
              <button key={t} className={`${styles.chip} ${type === t ? styles.chipActive : ''}`} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Complexity:</span>
          <div className={styles.chips}>
            {COMPLEXITY.map((c) => (
              <button key={c} className={`${styles.chip} ${complexity === c ? styles.chipActive : ''}`} onClick={() => setComplexity(c)}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      <span className={styles.count}>{filtered.length} designs found</span>

      <div className={styles.grid}>
        {filtered.map((design) => (
          <Card key={design.id} variant="default" padding="md" hoverable onClick={() => navigate(`/designs/${design.id}`)}>
            <div className={styles.designImage}>
              <span>{design.type[0]}</span>
              <Badge variant="secondary" size="sm" className={styles.complexityBadge}>{design.complexity}</Badge>
            </div>
            <div className={styles.info}>
              <h3 className={styles.name}>{design.name}</h3>
              <p className={styles.designer}>{design.designer}</p>
              <div className={styles.meta}>
                <span>⭐ {design.rating} ({design.reviews})</span>
                <span>Est. {design.estimatedDays} days</span>
              </div>
              <div className={styles.reqs}>
                <span>Fabric: {design.fabricRequirements.type}</span>
                <span>Min: {design.fabricRequirements.minLength}m</span>
              </div>
              <div className={styles.measurements}>
                <span>Measurements: {design.measurementsNeeded.length} required</span>
              </div>
              <div className={styles.pricing}>
                <span className={styles.price}>₹{design.basePrice.toLocaleString()}</span>
                <span className={styles.fee}>+ ₹{design.designerFee} designer fee</span>
              </div>
              <div className={styles.actions}>
                <button className={styles.detailBtn}>View Details</button>
                <button className={styles.selectBtn}>Select Design</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
