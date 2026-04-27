import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Checkbox, Textarea } from '../../components';
import styles from './DesignUploadMeasurementsPage.module.css';

const measurementOptions = [
  { id: 'bust', label: 'Bust / Chest (Full measurement)' },
  { id: 'waist', label: 'Waist (Natural waist)' },
  { id: 'hips', label: 'Hips (Fullest part)' },
  { id: 'blouse-length', label: 'Blouse Length (Back shoulder to waist)' },
  { id: 'blouse-sleeve', label: 'Blouse Sleeve Length' },
  { id: 'blouse-shoulder', label: 'Blouse Shoulder Width' },
  { id: 'saree-length', label: 'Saree Length (Total from hip to ankle)' },
  { id: 'neck', label: 'Neck Size (if applicable)' },
  { id: 'arm-hole', label: 'Arm Hole Size' },
];

const includedItems = [
  'Cutting & tailoring',
  'Embroidery (if part of design)',
  'Quality check',
  'Pressing & finishing',
  'Packaging',
];

const careInstructions = [
  'Hand wash recommended',
  'Dry clean for heavy embroidery',
  'Do not machine wash',
];

type Complexity = 'Simple' | 'Medium' | 'Complex';

export const DesignUploadMeasurementsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMeasurements, setSelectedMeasurements] = useState([
    'bust', 'waist', 'hips', 'blouse-length', 'blouse-sleeve', 'blouse-shoulder', 'saree-length',
  ]);
  const [complexity, setComplexity] = useState<Complexity>('Medium');
  const [includedChecks, setIncludedChecks] = useState(includedItems);

  const toggleMeasurement = (id: string) => {
    setSelectedMeasurements(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleIncluded = (item: string) => {
    setIncludedChecks(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  };

  const complexityDescriptions: Record<Complexity, string> = {
    Simple: 'Basic stitching',
    Medium: 'Embroidery, some details',
    Complex: 'Detailed embroidery, multiple techniques',
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/designer/upload/fabric')}>← Upload New Design</button>

      <div>
        <h1 className={styles.headerTitle}>Measurement Specifications</h1>
        <p className={styles.headerStep}>Step 3 of 4</p>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: '75%' }} />
      </div>

      <Card variant="default" padding="lg">
        <div className={styles.formGroup}>
          <div>
            <div className={styles.label}>Which Measurements Are Needed?</div>
            <div className={styles.hint}>Check all that apply</div>
            <div className={styles.checkboxGroup}>
              {measurementOptions.map(m => (
                <Checkbox
                  key={m.id}
                  label={m.label}
                  checked={selectedMeasurements.includes(m.id)}
                  onChange={() => toggleMeasurement(m.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className={styles.label}>Stitching Complexity</div>
            <div className={styles.complexityOptions}>
              {(['Simple', 'Medium', 'Complex'] as Complexity[]).map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.complexityOption} ${complexity === c ? styles.complexityOptionActive : ''}`}
                  onClick={() => setComplexity(c)}
                >
                  <div className={styles.complexityLabel}>{c}</div>
                  <div className={styles.complexityDesc}>{complexityDescriptions[c]}</div>
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Estimated Stitching Time (days)"
            placeholder="10-14"
            value="10-14"
            onChange={() => {}}
          />
          <div className={styles.hint}>Time from fabric receipt to completion</div>

          <div>
            <div className={styles.label}>What's Included in Stitching</div>
            <div className={styles.checkboxGroup}>
              {includedItems.map(item => (
                <Checkbox
                  key={item}
                  label={item}
                  checked={includedChecks.includes(item)}
                  onChange={() => toggleIncluded(item)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className={styles.label}>Care Instructions</div>
            <div className={styles.careList}>
              {careInstructions.map(c => (
                <div key={c} className={styles.careItem}>
                  {c}
                </div>
              ))}
            </div>
          </div>

          <Textarea
            label="Special Handling Notes"
            placeholder="For tailor reference - any special techniques or materials they should know about?"
            value=""
            onChange={() => {}}
            rows={3}
          />
        </div>
      </Card>

      <div className={styles.actions}>
        <Button variant="outline" onClick={() => navigate('/designer/upload/fabric')}>← Back</Button>
        <Button variant="primary" onClick={() => navigate('/designer/upload/pricing')}>
          Next: Pricing & Publishing →
        </Button>
      </div>
    </div>
  );
};
