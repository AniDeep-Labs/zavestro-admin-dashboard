import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SearchInput, Badge } from '../../components';
import { useOrder } from '../../context/OrderContext';
import { fabrics } from '../../data/mockData';
import styles from './FabricCatalogPage.module.css';

const MATERIALS = ['All', 'Silk', 'Cotton', 'Blend', 'Linen', 'Chiffon'];
const COLORS = ['All', 'Maroon', 'Blue', 'White', 'Gold', 'Green', 'Cream'];
const PRICE_RANGES = ['All', '<₹300', '₹300-500', '₹500+'];

export const FabricCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const { dispatch } = useOrder();
  const [search, setSearch] = useState('');
  const [material, setMaterial] = useState('All');
  const [color, setColor] = useState('All');
  const [priceRange, setPriceRange] = useState('All');

  const filtered = useMemo(() => {
    return fabrics.filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (material !== 'All' && !f.material.toLowerCase().includes(material.toLowerCase())) return false;
      if (color !== 'All' && f.color !== color) return false;
      if (priceRange === '<₹300' && f.pricePerMeter >= 300) return false;
      if (priceRange === '₹300-500' && (f.pricePerMeter < 300 || f.pricePerMeter > 500)) return false;
      if (priceRange === '₹500+' && f.pricePerMeter < 500) return false;
      return true;
    });
  }, [search, material, color, priceRange]);

  const handleSelect = (fabric: typeof fabrics[0]) => {
    dispatch({ type: 'SET_FABRIC_SOURCE', payload: 'zavestro' });
    dispatch({ type: 'SET_SELECTED_FABRIC', payload: fabric });
    navigate('/designs');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/')}>← Fabrics</button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search fabrics..." />

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Material:</span>
          <div className={styles.filterChips}>
            {MATERIALS.map((m) => (
              <button key={m} className={`${styles.chip} ${material === m ? styles.chipActive : ''}`} onClick={() => setMaterial(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Color:</span>
          <div className={styles.filterChips}>
            {COLORS.map((c) => (
              <button key={c} className={`${styles.chip} ${color === c ? styles.chipActive : ''}`} onClick={() => setColor(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Price:</span>
          <div className={styles.filterChips}>
            {PRICE_RANGES.map((p) => (
              <button key={p} className={`${styles.chip} ${priceRange === p ? styles.chipActive : ''}`} onClick={() => setPriceRange(p)}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.results}>
        <span className={styles.resultCount}>{filtered.length} fabrics found</span>
      </div>

      <div className={styles.grid}>
        {filtered.map((fabric) => (
          <Card key={fabric.id} variant="default" padding="md" hoverable>
            <div className={styles.fabricImage}>
              <span>{fabric.color[0]}</span>
            </div>
            <div className={styles.fabricInfo}>
              <h3 className={styles.fabricName}>{fabric.name}</h3>
              <div className={styles.fabricRating}>⭐ {fabric.rating} ({fabric.reviews} reviews)</div>
              <div className={styles.fabricSpecs}>
                <span>Material: {fabric.material}</span>
                <span>Width: {fabric.width} inches</span>
                <span>GSM: {fabric.gsm}</span>
                <span>Care: {fabric.care}</span>
              </div>
              <div className={styles.fabricPricing}>
                <span className={styles.fabricPrice}>₹{fabric.pricePerMeter}/meter</span>
                <span className={styles.fabricSupplier}>Supplier: {fabric.supplier}</span>
                <Badge variant="success" size="sm">{fabric.stock}+ meters</Badge>
              </div>
              <div className={styles.fabricActions}>
                <button className={styles.wishlistBtn}>❤️ Wishlist</button>
                <button className={styles.addBtn} onClick={() => handleSelect(fabric)}>+ Select Fabric</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
