import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Badge, Alert } from '../../components';
import { useOrder } from '../../context/OrderContext';
import { designs } from '../../data/mockData';
import styles from './DesignDetailPage.module.css';

export const DesignDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state, dispatch } = useOrder();
  const design = designs.find((d) => d.id === id);

  if (!design) {
    return <div>Design not found. <button onClick={() => navigate('/designs')}>Browse designs</button></div>;
  }

  const ownFabric = state.ownFabricDetails;
  const zavestroFabric = state.selectedFabric;

  // Compatibility check
  const checks = [];
  if (state.fabricSource === 'own' && ownFabric) {
    const typeMatch = design.fabricRequirements.type.toLowerCase().includes(ownFabric.type.toLowerCase());
    const lengthMatch = parseFloat(ownFabric.quantity) >= design.fabricRequirements.minLength;
    const colorMatch = design.fabricRequirements.bestColors.includes('Any') || design.fabricRequirements.bestColors.some(c => c.toLowerCase() === ownFabric.color.toLowerCase());

    checks.push({ label: `Type: ${design.fabricRequirements.type}`, pass: typeMatch, detail: `Your fabric: ${ownFabric.type}` });
    checks.push({ label: `Minimum: ${design.fabricRequirements.minLength}m length`, pass: lengthMatch, detail: `Your quantity: ${ownFabric.quantity}m` });
    checks.push({ label: `Min Width: ${design.fabricRequirements.minWidth} inches`, pass: null, detail: 'Will be confirmed' });
    checks.push({ label: `Best Colors: ${design.fabricRequirements.bestColors.join(', ')}`, pass: colorMatch, detail: `Your color: ${ownFabric.color}` });
  } else if (state.fabricSource === 'zavestro' && zavestroFabric) {
    const typeMatch = design.fabricRequirements.type.toLowerCase().includes(zavestroFabric.material.split(' ')[0].toLowerCase());
    const widthMatch = zavestroFabric.width >= design.fabricRequirements.minWidth;
    const colorMatch = design.fabricRequirements.bestColors.includes('Any') || design.fabricRequirements.bestColors.some(c => c.toLowerCase() === zavestroFabric.color.toLowerCase());

    checks.push({ label: `Type: ${design.fabricRequirements.type}`, pass: typeMatch, detail: `Your fabric: ${zavestroFabric.material}` });
    checks.push({ label: `Min Width: ${design.fabricRequirements.minWidth} inches`, pass: widthMatch, detail: `Your fabric: ${zavestroFabric.width} inches` });
    checks.push({ label: `Best Colors: ${design.fabricRequirements.bestColors.join(', ')}`, pass: colorMatch, detail: `Your color: ${zavestroFabric.color}` });
  }

  const allPass = checks.length > 0 && checks.every(c => c.pass !== false);

  const handleProceed = () => {
    dispatch({ type: 'SET_DESIGN', payload: design });
    navigate('/measurements');
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/designs')}>← Design Details</button>

      <Card variant="default" padding="lg">
        <div className={styles.designImage}>
          <span>{design.type[0]}</span>
        </div>

        <h2 className={styles.title}>{design.name}</h2>
        <p className={styles.designer}>Designer: {design.designer}</p>
        <div className={styles.ratingRow}>
          <span>⭐ {design.rating} ({design.reviews} reviews)</span>
          <Badge variant="secondary" size="md">{design.complexity}</Badge>
        </div>

        <div className={styles.specs}>
          <div className={styles.specRow}><span>Type:</span><span>{design.type}</span></div>
          <div className={styles.specRow}><span>Style:</span><span>{design.style}</span></div>
          <div className={styles.specRow}><span>Est. Stitching:</span><span>{design.estimatedDays} days</span></div>
          <div className={styles.specRow}><span>Base Price:</span><span className={styles.priceVal}>₹{design.basePrice.toLocaleString()}</span></div>
          <div className={styles.specRow}><span>Designer Fee:</span><span>₹{design.designerFee}</span></div>
        </div>

        <div className={styles.reqSection}>
          <h3>Fabric Requirements</h3>
          <ul>
            <li>{design.fabricRequirements.type}</li>
            <li>{design.fabricRequirements.minLength}m minimum</li>
            <li>Width: {design.fabricRequirements.minWidth}+ inches</li>
            <li>Colors: {design.fabricRequirements.bestColors.join(', ')}</li>
          </ul>
        </div>

        <div className={styles.reqSection}>
          <h3>Measurements Needed</h3>
          <ul>
            {design.measurementsNeeded.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      </Card>

      {/* Compatibility Check */}
      {checks.length > 0 && (
        <Card variant="outlined" padding="lg">
          <h3 className={styles.compatTitle}>Fabric Compatibility Check</h3>
          <div className={styles.checks}>
            {checks.map((check, i) => (
              <div key={i} className={styles.checkRow}>
                <span className={styles.checkIcon}>
                  {check.pass === true ? '✅' : check.pass === false ? '❌' : '❓'}
                </span>
                <div>
                  <span>{check.label}</span>
                  <span className={styles.checkDetail}>{check.detail}</span>
                </div>
              </div>
            ))}
          </div>
          {allPass && (
            <Alert type="success" title="Excellent Match!" message="Your fabric is perfect for this design." />
          )}
          {!allPass && checks.some(c => c.pass === false) && (
            <Alert type="warning" title="Partial Match" message="Some fabric requirements may not be met. Proceed with caution." />
          )}
        </Card>
      )}

      <div className={styles.actionRow}>
        <button className={styles.browseBtn} onClick={() => navigate('/designs')}>Browse Other Designs</button>
        <button className={styles.proceedBtn} onClick={handleProceed}>
          {state.fabricSource ? 'Proceed with This Design' : 'Select This Design'}
        </button>
      </div>
    </div>
  );
};
