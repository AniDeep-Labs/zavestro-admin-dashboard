import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Textarea } from '../../components';
import styles from './DesignUploadDetailsPage.module.css';

const categoryOptions = [
  { value: 'saree', label: 'Saree' },
  { value: 'kurta', label: 'Kurta' },
  { value: 'lehenga', label: 'Lehenga' },
  { value: 'dress', label: 'Dress' },
  { value: 'salwar', label: 'Salwar Kameez' },
  { value: 'palazzo', label: 'Palazzo Set' },
];

const subCategoryOptions = [
  { value: 'traditional', label: 'Traditional' },
  { value: 'contemporary', label: 'Contemporary' },
  { value: 'fusion', label: 'Indo-Western Fusion' },
  { value: 'bridal', label: 'Bridal' },
  { value: 'casual', label: 'Casual' },
];

const styleOptions = [
  { value: 'embroidered', label: 'Embroidered' },
  { value: 'printed', label: 'Printed' },
  { value: 'plain', label: 'Plain/Minimal' },
  { value: 'heavy', label: 'Heavy Work' },
  { value: 'block-print', label: 'Block Print' },
];

export const DesignUploadDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const photos = [true, true, true, false];

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/designer/dashboard')}>← Upload New Design</button>

      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Design Details</h1>
        <p className={styles.headerStep}>Step 1 of 4</p>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: '25%' }} />
      </div>

      <Card variant="default" padding="lg">
        <div className={styles.formGroup}>
          <Input
            label="Design Name"
            placeholder="Royal Embroidered Saree"
            value="Royal Embroidered Saree"
            onChange={() => {}}
          />

          <Select label="Category" options={categoryOptions} value="saree" onChange={() => {}} />
          <Select label="Sub-Category / Style" options={subCategoryOptions} value="traditional" onChange={() => {}} />
          <Select label="Design Style" options={styleOptions} value="embroidered" onChange={() => {}} />

          <Textarea
            label="Description"
            placeholder="Describe your design..."
            value="Stunning traditional saree with intricate embroidery and gold threadwork. Perfect for weddings and special occasions."
            onChange={() => {}}
            rows={4}
          />

          <Textarea
            label="Design Story (Optional)"
            placeholder="Share your inspiration behind this design..."
            value=""
            onChange={() => {}}
            rows={3}
          />

          <div>
            <div className={styles.label}>Upload Design Photos</div>
            <div className={styles.hint}>Min 3, Max 10 photos</div>
            <div className={styles.uploadGrid}>
              {photos.map((filled, i) => (
                <div
                  key={i}
                  className={`${styles.uploadSlot} ${filled ? styles.uploadSlotFilled : ''}`}
                >
                  {filled ? `✓ Photo ${i + 1}` : '+ Add'}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.label}>Upload Video Preview</div>
            <div className={styles.hint}>HD, 30-60 seconds showing design details</div>
            <div className={`${styles.videoUpload} ${styles.videoUploaded}`}>
              <div className={styles.videoIcon}>🎬</div>
              <div className={styles.videoText}>Video Preview Uploaded</div>
              <div className={styles.videoDuration}>✓ 1:45 duration</div>
            </div>
          </div>
        </div>
      </Card>

      <div className={styles.actions}>
        <Button variant="primary" onClick={() => navigate('/designer/upload/fabric')}>
          Next: Fabric Requirements →
        </Button>
      </div>
    </div>
  );
};
