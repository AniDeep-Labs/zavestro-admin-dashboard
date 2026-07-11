import React from 'react';
import { UilMapMarkerSlash } from '@iconscout/react-unicons';
import { EmptyState } from '../EmptyState';

/**
 * NoHubAssigned (T2-38 / PR-5) — the shared dead-end for a catalog_manager who has no hub
 * assigned. CM request forms (restock, listing) are hub-scoped, so without a hub they can't
 * function; instead of a form that fails on submit, show one honest instruction.
 */
export const NoHubAssigned: React.FC<{ action: string }> = ({ action }) => (
  <EmptyState
    icon={<UilMapMarkerSlash size={26} />}
    title="No hub assigned yet"
    body={`Your catalog-manager account isn't linked to a hub, so you can't ${action}. Ask a super admin to assign your hub, then reload.`}
  />
);
