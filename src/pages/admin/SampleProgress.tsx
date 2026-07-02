import React from 'react';
import { StatusBadge } from '../../components';
import s from './SampleProgress.module.css';

// Single source of truth for how a sample's lifecycle is shown — so the Requests and
// Review tabs speak the same visual language (a dot stepper for active stages, a badge
// for terminal ones) instead of two different representations.
export const SAMPLE_STAGES = ['requested', 'cutting', 'stitching', 'design_review', 'reviewed'] as const;
export const SAMPLE_STAGE_LABELS: Record<string, string> = {
  requested: 'Requested',
  cutting: 'Cutting',
  stitching: 'Stitching',
  design_review: 'In review',
  reviewed: 'Reviewed',
  approved: 'Reviewed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const stageIndex = (status: string) => {
  if (status === 'approved') return 4;
  return SAMPLE_STAGES.indexOf(status as (typeof SAMPLE_STAGES)[number]);
};

/** True for statuses that are no longer moving (done / disposed). */
export const isTerminalSample = (status: string) =>
  ['reviewed', 'approved', 'rejected', 'cancelled'].includes(status);

export const SampleProgress: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'rejected') return <StatusBadge status="rejected" label="Rejected" />;
  if (status === 'cancelled') return <StatusBadge status="inactive" label="Cancelled" />;
  const idx = stageIndex(status);
  return (
    <div className={s.stepper}>
      <div className={s.dots}>
        {SAMPLE_STAGES.map((_, i) => (
          <span key={i} className={`${s.dot} ${i <= idx ? s.dotOn : ''}`} />
        ))}
      </div>
      <span className={s.stepLabel}>{SAMPLE_STAGE_LABELS[status] ?? status}</span>
    </div>
  );
};

export default SampleProgress;
