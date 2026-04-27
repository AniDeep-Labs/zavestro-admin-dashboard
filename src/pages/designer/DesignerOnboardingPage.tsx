import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Checkbox, Textarea } from '../../components';
import styles from './DesignerOnboardingPage.module.css';

const experienceOptions = [
  { value: '0-2', label: '0-2 years' },
  { value: '2-5', label: '2-5 years' },
  { value: '5-10', label: '5-10 years' },
  { value: '10+', label: '10+ years' },
];

const bankOptions = [
  { value: 'icici', label: 'ICICI Bank' },
  { value: 'hdfc', label: 'HDFC Bank' },
  { value: 'sbi', label: 'State Bank of India' },
  { value: 'axis', label: 'Axis Bank' },
  { value: 'kotak', label: 'Kotak Mahindra Bank' },
];

const specialtyOptions = ['Sarees', 'Lehengas', 'Kurtis', 'Fusion', 'Western'];

export const DesignerOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [specialties, setSpecialties] = useState<string[]>(['Sarees', 'Lehengas']);
  const [uploads, setUploads] = useState([true, true, true]);

  const toggleSpecialty = (s: string) => {
    setSpecialties(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const renderStepIndicator = () => (
    <div className={styles.stepIndicator}>
      {[1, 2, 3].map((s, i) => (
        <React.Fragment key={s}>
          <div
            className={`${styles.stepDot} ${
              step === s ? styles.stepDotActive : step > s ? styles.stepDotCompleted : styles.stepDotPending
            }`}
          >
            {step > s ? '✓' : s}
          </div>
          {i < 2 && (
            <div className={`${styles.stepLine} ${step > s ? styles.stepLineCompleted : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <>
      <h3 className={styles.stepTitle}>Step 1/3: Basic Information</h3>
      <div className={styles.formGroup}>
        <Input label="Designer/Brand Name" placeholder="Priya Designs" value="Priya Designs" onChange={() => {}} />
        <Input label="Owner Name" placeholder="Priya Kumar" value="Priya Kumar" onChange={() => {}} />
        <div className={styles.row}>
          <Input label="Email" type="email" placeholder="priya@designs.com" value="priya@designs.com" onChange={() => {}} />
          <Input label="Phone" placeholder="+91 98765 43210" value="+91 98765 43210" onChange={() => {}} />
        </div>
        <Input label="City/State" placeholder="New Delhi, Delhi" value="New Delhi, Delhi" onChange={() => {}} />
        <Select
          label="Years of Experience"
          options={experienceOptions}
          value="5-10"
          onChange={() => {}}
        />
        <div>
          <div className={styles.label}>Specialties</div>
          <div className={styles.checkboxGroup}>
            {specialtyOptions.map(s => (
              <Checkbox
                key={s}
                label={s}
                checked={specialties.includes(s)}
                onChange={() => toggleSpecialty(s)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => setStep(2)}>Continue to Step 2</Button>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <h3 className={styles.stepTitle}>Step 2/3: Portfolio Verification</h3>
      <div className={styles.formGroup}>
        <div>
          <div className={styles.label}>Upload Portfolio (Minimum 3 design samples)</div>
          <div className={styles.uploadArea}>
            {uploads.map((filled, i) => (
              <div
                key={i}
                className={`${styles.uploadSlot} ${filled ? styles.uploadSlotFilled : ''}`}
              >
                {filled ? '✓' : '+'} Design {i + 1}
              </div>
            ))}
            <div
              className={styles.uploadSlot}
              onClick={() => setUploads([...uploads, false])}
            >
              + Add More
            </div>
          </div>
        </div>
        <Textarea
          label="About Your Designs"
          placeholder="What makes your designs unique? Share your design philosophy..."
          value="Creating timeless traditional and fusion designs with intricate embroidery and attention to detail."
          onChange={() => {}}
          rows={4}
        />
      </div>
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
        <Button variant="primary" onClick={() => setStep(3)}>Continue to Step 3</Button>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <h3 className={styles.stepTitle}>Step 3/3: Bank Account Setup</h3>
      <div className={styles.formGroup}>
        <Input label="Account Holder Name" placeholder="Priya Kumar" value="Priya Kumar" onChange={() => {}} />
        <Select
          label="Bank Name"
          options={bankOptions}
          value="icici"
          onChange={() => {}}
        />
        <Input
          label="Account Number"
          placeholder="••••••••••••9876"
          value="••••••••••••9876"
          onChange={() => {}}
        />
        <Input
          label="IFSC Code"
          placeholder="ICIC0000123"
          value="ICIC0000123"
          onChange={() => {}}
        />
        <Button variant="outline" className={styles.verifyBtn}>Verify Account</Button>
      </div>
      <div className={styles.actions}>
        <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
        <Button variant="primary" onClick={() => navigate('/designer/dashboard')}>
          Create Designer Account
        </Button>
      </div>
    </>
  );

  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>
        <span className={styles.shellBrand}>Zavestro</span>
      </header>
      <div className={styles.shellContent}>
        <div className={styles.page}>
          <h1 className={styles.title}>Become a Designer on Zavestro</h1>
          <p className={styles.subtitle}>Set up your designer profile and start earning</p>

          {renderStepIndicator()}

          <Card variant="default" padding="lg">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </Card>
        </div>
      </div>
    </div>
  );
};
