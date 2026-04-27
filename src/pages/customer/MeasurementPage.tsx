import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components';
import { useOrder } from '../../context/OrderContext';
import styles from './MeasurementPage.module.css';

export const MeasurementPage: React.FC = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useOrder();
  const design = state.selectedDesign;

  if (!design) {
    return <div>No design selected. <button onClick={() => navigate('/designs')}>Select a design</button></div>;
  }

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)}>← Measurements</button>

      <Card variant="outlined" padding="md">
        <h3 className={styles.designRef}>{design.name} requires:</h3>
        <ul className={styles.reqList}>
          {design.measurementsNeeded.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Card>

      <h2 className={styles.title}>How do you want to measure?</h2>

      <Card variant="default" padding="lg" hoverable onClick={() => {
        dispatch({ type: 'SET_MEASUREMENT_METHOD', payload: 'self' });
        navigate('/measurements/self');
      }}>
        <div className={styles.optionCard}>
          <span className={styles.optionIcon}>📱</span>
          <div className={styles.optionInfo}>
            <h3 className={styles.optionTitle}>Self-Measure with Video Guide</h3>
            <p className={styles.optionDesc}>Step-by-step HD videos for each measurement</p>
            <div className={styles.optionMeta}>
              <span>Estimated time: 15 minutes</span>
              <span className={styles.free}>Cost: FREE</span>
              <span>Can re-measure anytime</span>
            </div>
          </div>
          <span className={styles.arrow}>→</span>
        </div>
      </Card>

      <Card variant="default" padding="lg" hoverable onClick={() => {
        dispatch({ type: 'SET_MEASUREMENT_METHOD', payload: 'professional' });
        navigate('/tailors');
      }}>
        <div className={styles.optionCard}>
          <span className={styles.optionIcon}>👨‍💼</span>
          <div className={styles.optionInfo}>
            <h3 className={styles.optionTitle}>Professional Measurement Service</h3>
            <p className={styles.optionDesc}>Expert comes to your home with professional tools</p>
            <div className={styles.optionMeta}>
              <span>Takes 20-30 minutes</span>
              <span className={styles.paid}>Cost: ₹299 (one-time)</span>
              <span>Multiple measurements allowed</span>
            </div>
          </div>
          <span className={styles.arrow}>→</span>
        </div>
      </Card>

      <button className={styles.savedBtn} onClick={() => navigate('/tailors')}>
        I Already Have Measurements →
      </button>
      <p className={styles.savedHint}>Select from your saved measurements</p>
    </div>
  );
};
