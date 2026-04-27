import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Textarea, Select } from '../../components';
import { useOrder } from '../../context/OrderContext';
import styles from './OwnFabricPage.module.css';

const FABRIC_TYPES = [
  { label: 'Silk', value: 'silk' },
  { label: 'Cotton', value: 'cotton' },
  { label: 'Blend', value: 'blend' },
  { label: 'Linen', value: 'linen' },
  { label: 'Chiffon', value: 'chiffon' },
  { label: 'Other', value: 'other' },
];

const COLORS = [
  { label: 'Maroon', value: 'Maroon' },
  { label: 'Red', value: 'Red' },
  { label: 'Blue', value: 'Blue' },
  { label: 'Green', value: 'Green' },
  { label: 'Gold', value: 'Gold' },
  { label: 'White', value: 'White' },
  { label: 'Cream', value: 'Cream' },
  { label: 'Black', value: 'Black' },
  { label: 'Other', value: 'Other' },
];

export const OwnFabricPage: React.FC = () => {
  const navigate = useNavigate();
  const { dispatch } = useOrder();

  const [fabricType, setFabricType] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<'new' | 'worn' | 'stained'>('new');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [address, setAddress] = useState('123, Park Street\nNew Delhi, 110001');
  const [readyToPickup, setReadyToPickup] = useState(true);
  const [pickupDate, setPickupDate] = useState('');

  const handlePhotoAdd = () => {
    setPhotos((prev) => [...prev, `Photo ${prev.length + 1}`]);
  };

  const handleConfirm = () => {
    dispatch({ type: 'SET_FABRIC_SOURCE', payload: 'own' });
    dispatch({
      type: 'SET_OWN_FABRIC',
      payload: {
        type: fabricType,
        color,
        quantity,
        condition,
        details,
        photos,
        pickupAddress: address,
        readyToPickup,
        pickupDate,
      },
    });
    navigate('/designs');
  };

  const isValid = fabricType && color && quantity && parseFloat(quantity) > 0;

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/')}>← Your Fabric Details</button>

      <Card variant="default" padding="lg">
        <h2 className={styles.title}>Tell us about your fabric</h2>

        <div className={styles.form}>
          <Select
            label="Fabric Type"
            value={fabricType}
            onChange={setFabricType}
            options={FABRIC_TYPES}
            placeholder="Select fabric type"
            required
          />

          <Select
            label="Color"
            value={color}
            onChange={setColor}
            options={COLORS}
            placeholder="Select color"
            required
          />

          <Input
            label="Quantity You Have"
            type="number"
            value={quantity}
            onChange={setQuantity}
            placeholder="e.g. 6.5"
            helperText="In meters"
            required
          />

          <div className={styles.conditionGroup}>
            <span className={styles.label}>Fabric Condition</span>
            <label className={styles.conditionOption}>
              <input type="radio" name="condition" checked={condition === 'new'} onChange={() => setCondition('new')} />
              <span>Brand new / unused</span>
            </label>
            <label className={styles.conditionOption}>
              <input type="radio" name="condition" checked={condition === 'worn'} onChange={() => setCondition('worn')} />
              <span>Worn before / has blemishes</span>
            </label>
            <label className={styles.conditionOption}>
              <input type="radio" name="condition" checked={condition === 'stained'} onChange={() => setCondition('stained')} />
              <span>Has stains / needs attention</span>
            </label>
          </div>

          <Textarea
            label="Additional Details"
            value={details}
            onChange={setDetails}
            placeholder="e.g. Silk blend with gold thread accents..."
            rows={3}
          />
        </div>
      </Card>

      <Card variant="default" padding="lg">
        <h3 className={styles.subtitle}>Upload Fabric Photos</h3>
        <div className={styles.photoSection}>
          <div className={styles.photoButtons}>
            <button className={styles.photoBtn} onClick={handlePhotoAdd}>📷 Camera</button>
            <button className={styles.photoBtn} onClick={handlePhotoAdd}>🖼️ Gallery</button>
          </div>
          {photos.length > 0 && (
            <div className={styles.photoGrid}>
              {photos.map((_p, i) => (
                <div key={i} className={styles.photoThumb}>
                  <span>📷</span>
                  <span className={styles.photoCheck}>✓</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card variant="default" padding="lg">
        <h3 className={styles.subtitle}>Pickup Location</h3>
        <pre className={styles.address}>{address}</pre>
        <button className={styles.changeBtn} onClick={() => setAddress(address)}>Change Address</button>

        <div className={styles.pickupOptions}>
          <span className={styles.label}>Pickup Status</span>
          <label className={styles.conditionOption}>
            <input type="radio" name="pickup" checked={readyToPickup} onChange={() => setReadyToPickup(true)} />
            <span>Ready to pick from my home</span>
          </label>
          <label className={styles.conditionOption}>
            <input type="radio" name="pickup" checked={!readyToPickup} onChange={() => setReadyToPickup(false)} />
            <span>Will be ready by:</span>
          </label>
          {!readyToPickup && (
            <Input type="date" value={pickupDate} onChange={setPickupDate} />
          )}
        </div>
      </Card>

      <button className={styles.confirmBtn} onClick={handleConfirm} disabled={!isValid}>
        Confirm Fabric Details →
      </button>
    </div>
  );
};
