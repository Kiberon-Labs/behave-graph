import React, { useState } from 'react';

import { ManageEventsPanel } from './ManageEventsPanel';
import { EditEventPanel } from './EditEventPanel';

/**
 * Events Panel
 * Focus: define Custom Events (with arbitrary parameters) for the current graph.
 */
export const EventsPanel = () => {
  const [selectedEventUiId, setSelectedEventUiId] = useState<string | null>(
    null
  );

  return selectedEventUiId ? (
    <EditEventPanel
      eventUiId={selectedEventUiId}
      onBack={() => setSelectedEventUiId(null)}
    />
  ) : (
    <ManageEventsPanel onSelectEvent={setSelectedEventUiId} />
  );
};
