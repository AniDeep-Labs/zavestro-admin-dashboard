import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input } from '../../components';
import { useOrder } from '../../context/OrderContext';
import { measurementFields } from '../../data/mockData';
import styles from './SelfMeasurePage.module.css';

export const SelfMeasurePage: React.FC = () => {
  const navigate = useNavigate();
  const { state, dispatch } = useOrder();
  const design = state.selectedDesign;

  const requiredFields = design
    ? measurementFields.filter(f => design.measurementsNeeded.some(m => m.toLowerCase().includes(f.name.toLowerCase())))
    : measurementFields;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});

  const current = requiredFields[currentIndex];
  const completedCount = Object.keys(confirmed).filter(k => confirmed[k]).length;
  const allDone = completedCount === requiredFields.length;

  const handleConfirm = () => {
    if (!current || !values[current.id]) return;
    dispatch({
      type: 'SET_MEASUREMENT',
      payload: { id: current.id, value: values[current.id], confirmed: true },
    });
    setConfirmed(prev => ({ ...prev, [current.id]: true }));
    if (currentIndex < requiredFields.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleFinish = () => {
    navigate('/tailors');
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/measurements')}>← Self-Measurement</button>
      <div className={styles.progress}>
        Progress: {completedCount}/{requiredFields.length} measurements
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${(completedCount / requiredFields.length) * 100}%` }} />
        </div>
      </div>

      {current && (
        <Card variant="default" padding="lg">
          <h2 className={styles.measureTitle}>Measurement {currentIndex + 1}: {current.name}</h2>

          {/* Video placeholder */}
          <div className={styles.videoPlaceholder}>
            <span className={styles.playBtn}>▶</span>
            <span>HD Video Guide</span>
            <span className={styles.videoDuration}>{current.videoDuration}</span>
          </div>

          {/* Instructions */}
          <div className={styles.instructions}>
            <h3>Step-by-Step Instructions:</h3>
            <ol>
              <li>Stand straight, in a relaxed position</li>
              <li>Place measuring tape around {current.name.toLowerCase()}</li>
              <li>Measurement should be snug, not tight</li>
              <li>Read the tape at the meeting point</li>
              <li>Record the number below</li>
            </ol>
          </div>

          {/* Input */}
          <div className={styles.inputSection}>
            <h3>Enter Your Measurement:</h3>
            <div className={styles.inputRow}>
              <Input
                label={`${current.name} (${current.unit})`}
                type="number"
                value={values[current.id] || ''}
                onChange={(v) => setValues(prev => ({ ...prev, [current.id]: v }))}
                placeholder={`e.g. 78`}
                size="lg"
              />
            </div>

            {/* Consistency check */}
            {confirmed[current.id] && values[current.id] && (
              <div className={styles.consistency}>
                <span className={styles.checkMark}>✅</span>
                <span>Value: {values[current.id]}{current.unit} — Confirmed</span>
              </div>
            )}
          </div>

          <div className={styles.measureActions}>
            <button
              className={styles.clearBtn}
              onClick={() => setValues(prev => ({ ...prev, [current.id]: '' }))}
            >
              Clear
            </button>
            <button
              className={styles.confirmMeasureBtn}
              onClick={handleConfirm}
              disabled={!values[current.id]}
            >
              ✓ Confirm
            </button>
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className={styles.navRow}>
        <button
          className={styles.navBtn}
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          ← Previous
        </button>
        {allDone ? (
          <button className={styles.finishBtn} onClick={handleFinish}>
            All Done — Select Tailor →
          </button>
        ) : (
          <button
            className={styles.navBtn}
            onClick={() => setCurrentIndex(Math.min(requiredFields.length - 1, currentIndex + 1))}
            disabled={currentIndex === requiredFields.length - 1}
          >
            Next →
          </button>
        )}
      </div>

      {/* Completed list */}
      <Card variant="outlined" padding="md">
        <h3 className={styles.completedTitle}>Measurements:</h3>
        <div className={styles.completedList}>
          {requiredFields.map((field, i) => (
            <div
              key={field.id}
              className={`${styles.completedItem} ${i === currentIndex ? styles.currentItem : ''}`}
              onClick={() => setCurrentIndex(i)}
            >
              <span>{confirmed[field.id] ? '✅' : '○'}</span>
              <span>{field.name}</span>
              {confirmed[field.id] && <span className={styles.completedValue}>({values[field.id]}{field.unit})</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
