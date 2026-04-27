import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Checkbox } from '../../components';
import styles from './DesignUploadPricingPage.module.css';

const tags = ['traditional', 'saree', 'wedding', 'embroidered', 'gold', 'luxury'];
const audiences = ['Brides', 'Wedding attendees', 'Festival wear', 'Party wear'];

export const DesignUploadPricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [earningsType, setEarningsType] = useState<'fixed' | 'percentage'>('fixed');
  const [visibility, setVisibility] = useState(['profile', 'recommendations', 'tailor-search']);
  const [selectedAudiences, setSelectedAudiences] = useState(audiences);

  const toggleVisibility = (v: string) => {
    setVisibility(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  };

  const toggleAudience = (a: string) => {
    setSelectedAudiences(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/designer/upload/measurements')}>← Upload New Design</button>

      <div>
        <h1 className={styles.headerTitle}>Pricing & Publishing</h1>
        <p className={styles.headerStep}>Step 4 of 4</p>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: '100%' }} />
      </div>

      <Card variant="default" padding="lg">
        <div className={styles.formGroup}>
          <div>
            <Input
              label="Base Stitching Price (₹)"
              placeholder="5000"
              value="5000"
              onChange={() => {}}
            />
            <div className={styles.hint}>Recommended starting price. Tailors can adjust +/- 10-20%</div>
          </div>

          <div>
            <div className={styles.label}>Your Earnings Per Order</div>
            <div className={styles.earningsOptions}>
              <div
                className={`${styles.earningsOption} ${earningsType === 'fixed' ? styles.earningsOptionActive : ''}`}
                onClick={() => setEarningsType('fixed')}
              >
                <div className={`${styles.earningsOptionRadio} ${earningsType === 'fixed' ? styles.earningsOptionRadioActive : ''}`} />
                <span className={styles.earningsOptionLabel}>Fixed Amount</span>
                <div className={styles.earningsOptionInput}>
                  <Input placeholder="₹500" value="500" onChange={() => {}} size="sm" />
                </div>
              </div>
              <div
                className={`${styles.earningsOption} ${earningsType === 'percentage' ? styles.earningsOptionActive : ''}`}
                onClick={() => setEarningsType('percentage')}
              >
                <div className={`${styles.earningsOptionRadio} ${earningsType === 'percentage' ? styles.earningsOptionRadioActive : ''}`} />
                <span className={styles.earningsOptionLabel}>Percentage Share</span>
                <div className={styles.earningsOptionInput}>
                  <Input placeholder="10%" value="10" onChange={() => {}} size="sm" />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.noteBox}>
            When a customer orders this design, you'll receive your earnings when the order completes (after delivery).
          </div>

          <div className={styles.divider} />

          <div>
            <div className={styles.label}>Visibility</div>
            <div className={styles.checkboxGroup}>
              <Checkbox label="Show on my public profile" checked={visibility.includes('profile')} onChange={() => toggleVisibility('profile')} />
              <Checkbox label="Allow in recommendations" checked={visibility.includes('recommendations')} onChange={() => toggleVisibility('recommendations')} />
              <Checkbox label="Allow tailor searching" checked={visibility.includes('tailor-search')} onChange={() => toggleVisibility('tailor-search')} />
            </div>
          </div>

          <div>
            <div className={styles.label}>Design Tags (for discoverability)</div>
            <div className={styles.tags}>
              {tags.map(t => (
                <span key={t} className={styles.tag}>{t}</span>
              ))}
              <button className={styles.addTag}>+ Add more tags</button>
            </div>
          </div>

          <div>
            <div className={styles.label}>Target Audience</div>
            <div className={styles.checkboxGroup}>
              {audiences.map(a => (
                <Checkbox
                  key={a}
                  label={a}
                  checked={selectedAudiences.includes(a)}
                  onChange={() => toggleAudience(a)}
                />
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          <div>
            <div className={styles.label}>Design Status</div>
            <div className={styles.statusList}>
              <div className={styles.statusItem}>✓ All details completed</div>
              <div className={styles.statusItem}>✓ Photos uploaded</div>
              <div className={styles.statusItem}>✓ Fabric requirements set</div>
              <div className={styles.statusItem}>✓ Measurements specified</div>
              <div className={styles.statusItem}>✓ Ready to publish</div>
            </div>
          </div>
        </div>
      </Card>

      <div className={styles.actions}>
        <Button variant="outline" onClick={() => navigate('/designer/upload/measurements')}>← Back</Button>
        <div className={styles.actionsRight}>
          <Button variant="outline" onClick={() => navigate('/designer/designs')}>Save as Draft</Button>
          <Button variant="primary" onClick={() => navigate('/designer/designs')}>Publish Design</Button>
        </div>
      </div>

      <p className={styles.publishNote}>
        Once published, your design will be visible to all customers. Basic details can be edited, but specs cannot be changed after publishing.
      </p>
    </div>
  );
};
