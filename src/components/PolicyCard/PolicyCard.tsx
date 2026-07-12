import React from 'react';
import { UilShieldCheck } from '@iconscout/react-unicons';
import styles from './PolicyCard.module.css';

// T3-3 (W-S5): the policy an agent enforces, written where they work — so a new hire doesn't
// improvise terms. Pairs with the ReturnDetail verdict chip (T2-31). Static reference only.
const POLICIES: { term: string; detail: string }[] = [
  {
    term: 'Fit Promise',
    detail: 'A fit issue is fixed free — one free alteration + re-measure. It is NOT a refund.',
  },
  {
    term: 'Returns — defect / wrong item',
    detail: 'Refund to the original payment method (never wallet), after the garment is picked up and the defect is confirmed.',
  },
  {
    term: 'Returns — change of mind',
    detail: 'Not accepted — every garment is made to the customer’s measurements.',
  },
  {
    term: 'Goodwill credits',
    detail: 'Support may issue up to ₹500. Above ₹500 escalates to finance for approval.',
  },
  {
    term: 'COD',
    detail: 'Available on eligible orders; any COD refund still goes to the customer’s UPI/bank, not COD.',
  },
];

export const PolicyCard: React.FC = () => (
  <div className={styles.card}>
    <h3 className={styles.title}>
      <UilShieldCheck size={16} /> Policy reference
    </h3>
    <dl className={styles.list}>
      {POLICIES.map((p) => (
        <div key={p.term} className={styles.row}>
          <dt className={styles.term}>{p.term}</dt>
          <dd className={styles.detail}>{p.detail}</dd>
        </div>
      ))}
    </dl>
  </div>
);

export default PolicyCard;
