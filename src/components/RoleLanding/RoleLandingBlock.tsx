/**
 * [SHL-4-8] A role-native block for the two roles whose landing page answered nothing.
 *
 * `design` and `procurement` hold neither `orders:read` nor `reports:read`, so the dashboard
 * skips its data fetch for them entirely (correctly — the read policy would 403 it) and they
 * see the ActionInbox's "All clear ✓" and nothing else. Their landing page therefore answered
 * no question about their own work: design got no sample queue, procurement got no stock, no
 * in-transit, no reorder signal.
 *
 * The audit was explicit that the honest emptiness was the RIGHT instinct — it fabricates
 * nothing — and that the surface, not the data, was thin. So this adds nothing new to the
 * backend and invents no number: it reads endpoints these roles already own and shows the few
 * facts their own console is about.
 *
 * Every figure here is server-derived. `is_low` in particular is NOT recomputed — three
 * surfaces used to derive it independently and disagreed about a fabric sitting exactly at its
 * reorder point ([CM-19-4]), so this reads the server's answer like the others now do.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { fabricsApi, restockApi, sampleJobsApi, hasCapability } from '../../api/adminApi';
import type { FabricStockRow, RestockRequest, SampleJob } from '../../api/adminApi';
import { supplySummary, samplingSummary } from './roleLandingStats';
import s from './RoleLandingBlock.module.css';

/** One fact, with somewhere to go and a plain sentence when there is nothing to do. */
const Stat: React.FC<{ label: string; value: number | string; to: string; hint: string }> = ({
  label,
  value,
  to,
  hint,
}) => (
  <Link className={s.stat} to={to}>
    <span className={s.statValue}>{value}</span>
    <span className={s.statLabel}>{label}</span>
    <span className={s.statHint}>{hint}</span>
  </Link>
);

export const RoleLandingBlock: React.FC = () => {
  const isProcurement = hasCapability('distribution:write');
  const isDesign = hasCapability('samples:write') || hasCapability('designs:write');

  const [stock, setStock] = React.useState<FabricStockRow[] | null>(null);
  const [restocks, setRestocks] = React.useState<RestockRequest[] | null>(null);
  const [samples, setSamples] = React.useState<SampleJob[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const fail = () => {
      if (alive) setFailed(true);
    };
    if (isProcurement) {
      fabricsApi
        .stock({})
        .then((r) => alive && setStock(r))
        .catch(fail);
      restockApi
        .list({})
        .then((r) => alive && setRestocks(r))
        .catch(fail);
    }
    if (isDesign) {
      // The bucket design actually acts on. `statuses` is bounded server-side ([DSG-12-11]).
      sampleJobsApi
        .list({ statuses: ['design_review', 'stitching', 'cutting', 'requested'], limit: 200 })
        .then((r) => alive && setSamples(r))
        .catch(fail);
    }
    return () => {
      alive = false;
    };
  }, [isProcurement, isDesign]);

  if (!isProcurement && !isDesign) return null;

  // A failed read must not render as zeros — "0 fabrics below reorder" and "we could not ask"
  // are opposite facts, and the first one reads as all-clear.
  if (failed) {
    return (
      <section className={s.block}>
        <p className={s.err}>
          Could not load your workspace summary. The pages themselves are unaffected.
        </p>
      </section>
    );
  }

  const blocks: React.ReactNode[] = [];

  if (isProcurement && stock && restocks) {
    const { low, inTransitMeters: inTransit, restocksOwed: owed } = supplySummary(stock, restocks);
    blocks.push(
      <div key="prc" className={s.group}>
        <h3 className={s.groupTitle}>Your supply, right now</h3>
        <div className={s.stats}>
          <Stat
            label="fabrics below reorder"
            value={low}
            to="/admin/procurement/stock"
            hint={low === 0 ? 'Nothing needs reordering' : 'Reorder before a hub runs dry'}
          />
          <Stat
            label="metres in transit"
            value={Math.round(inTransit)}
            to="/admin/procurement/track"
            hint={inTransit === 0 ? 'Nothing on the road' : 'Sent, not yet received'}
          />
          <Stat
            label="restocks still owed"
            value={owed}
            to="/admin/procurement/restock"
            hint={owed === 0 ? 'Every request is settled' : 'Ship, or chase what has stalled'}
          />
        </div>
      </div>,
    );
  }

  if (isDesign && samples) {
    const { awaitingVerdict: awaiting, inFlight } = samplingSummary(samples);
    blocks.push(
      <div key="dsg" className={s.group}>
        <h3 className={s.groupTitle}>Your sampling pipeline</h3>
        <div className={s.stats}>
          <Stat
            label="samples awaiting your verdict"
            value={awaiting}
            to="/admin/design/samples?tab=review"
            hint={awaiting === 0 ? 'Nothing is waiting on you' : 'A hub is blocked until you decide'}
          />
          <Stat
            label="samples being made"
            value={inFlight}
            to="/admin/design/samples"
            hint={inFlight === 0 ? 'Nothing in the hubs' : 'Requested, cutting or stitching'}
          />
        </div>
      </div>,
    );
  }

  if (blocks.length === 0) return null;
  return <section className={s.block}>{blocks}</section>;
};
