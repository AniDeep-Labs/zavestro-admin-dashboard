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
      {/* [CM-19-7] The framing follows the SAME capability that already decides the tabs.
          Before this, a catalog_manager reading their own "Sample Requests" nav item was shown
          "DESIGN · SAMPLING" and a subtitle promising them a review step they cannot perform —
          copy written for the design team, addressed to someone else. Deriving both from
          `canReview` means the two can never disagree: whoever gets the Review tab gets the
          reviewer's framing, and whoever does not gets the requester's. */}
      <PageHeader
        eyebrow={canReview ? 'Design · Sampling' : 'Catalog · Sampling'}
        title={canReview ? 'Samples' : 'Sample requests'}
        subtitle={
          canReview
            ? 'Request samples from hubs, then review what comes back before catalog lists it.'
            : 'Ask a hub to stitch a sample of a design in a fabric. Design reviews it, and once it passes you can list it.'
        }
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
