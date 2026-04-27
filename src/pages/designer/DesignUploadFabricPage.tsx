import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Checkbox, Textarea } from '../../components';
import styles from './DesignUploadFabricPage.module.css';

const fabricTypes = ['Silk Saree', 'Silk Cotton Blend', 'Pure Cotton', 'Linen', 'Other'];

export const DesignUploadFabricPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFabrics, setSelectedFabrics] = useState(['Silk Saree', 'Silk Cotton Blend']);

  const toggleFabric = (f: string) => {
    setSelectedFabrics(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const bestColors = ['Gold', 'Maroon', 'Navy', 'Emerald'];

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/designer/upload/details')}>← Upload New Design</button>

      <div>
        <h1 className={styles.headerTitle}>Fabric Requirements</h1>
        <p className={styles.headerStep}>Step 2 of 4</p>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: '50%' }} />
      </div>

      <Card variant="default" padding="lg">
        <div className={styles.formGroup}>
          <div>
            <div className={styles.label}>Fabric Type Required</div>
            <div className={styles.hint}>What fabrics work for this design?</div>
            <div className={styles.checkboxGroup}>
              {fabricTypes.map(f => (
                <Checkbox
                  key={f}
                  label={f}
                  checked={selectedFabrics.includes(f)}
                  onChange={() => toggleFabric(f)}
                />
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <Input
              label="Minimum Length (meters)"
              placeholder="6.5"
              value="6.5"
              onChange={() => {}}
            />
            <Input
              label="Minimum Width (inches)"
              placeholder="45"
              value="45"
              onChange={() => {}}
            />
          </div>
          <div className={styles.hint}>For this design to work properly</div>

          <Input
            label="Recommended GSM (Weight)"
            placeholder="200-300"
            value="200-300"
            onChange={() => {}}
          />
          <div className={styles.hint}>Lighter = flowy, Heavier = structure</div>

          <div>
            <Input
              label="Best Colors / Tones"
              placeholder="Rich colors recommended"
              value="Rich colors recommended"
              onChange={() => {}}
            />
            <div className={styles.colorTags}>
              {bestColors.map(c => (
                <span key={c} className={styles.colorTag}>{c}</span>
              ))}
            </div>
          </div>

          <Input
            label="Colors to Avoid (if any)"
            placeholder="e.g., Pastel colors"
            value="Pastel colors - embroidery won't show clearly"
            onChange={() => {}}
          />

          <Textarea
            label="Special Fabric Notes"
            placeholder="Any special requirements or handling needed?"
            value=""
            onChange={() => {}}
            rows={3}
          />

          <Input
            label="Incompatible Fabrics (if any)"
            placeholder="e.g., Cheap polyester"
            value="Cheap polyester won't hold embroidery well"
            onChange={() => {}}
          />
        </div>
      </Card>

      <div className={styles.actions}>
        <Button variant="outline" onClick={() => navigate('/designer/upload/details')}>← Back</Button>
        <Button variant="primary" onClick={() => navigate('/designer/upload/measurements')}>
          Next: Measurement Specifications →
        </Button>
      </div>
    </div>
  );
};
