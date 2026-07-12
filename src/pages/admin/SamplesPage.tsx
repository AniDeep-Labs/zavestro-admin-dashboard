import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { hasCapability } from '../../api/adminApi';
import { PageHeader, Tabs } from '../../components';
import DesignSampleRequestsPage from './DesignSampleRequestsPage';
import SampleVerificationPage from './SampleVerificationPage';
import base from './OrdersListPage.module.css';

// One home for the sampling pipeline — replaces the two confusable pages ("My Sample
// Requests" + "Sample Review"). Requests = samples you asked a hub to make (anyone with
// samples:write, incl. the CM); Review = stitched samples awaiting your verdict (design only).
export const SamplesPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const canReview = hasCapability('designs:write');

  // Deep-link from a design ("request a sample") lands on Requests with the modal pre-filled.
  const deepLinkRequest = params.has('design');
  const initialTab = deepLinkRequest ? 'requests' : params.get('tab') ?? 'requests';

  const tabs = [
    { id: 'requests', label: 'Requests', content: <DesignSampleRequestsPage embedded /> },
    ...(canReview
      ? [{ id: 'review', label: 'Review', content: <SampleVerificationPage embedded /> }]
      : []),
  ];

  return (
    <div className={base.page}>
      <PageHeader
        eyebrow="Design · Sampling"
        title="Samples"
        subtitle="Request samples from hubs, then review what comes back before catalog lists it."
      />
      <Tabs
        tabs={tabs}
        defaultTab={initialTab}
        onChange={(id) => {
          // Keep the tab in the URL (so back/refresh stays put), but don't clobber ?design=.
          const next = new URLSearchParams(params);
          next.set('tab', id);
          setParams(next, { replace: true });
        }}
      />
    </div>
  );
};

export default SamplesPage;
