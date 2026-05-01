export const mockTelescopeNightTimelines = [
  {
    site: 'GN',
    observingDate: '2026-08-01',
    displayInterval: {
      start: '2026-08-02T04:00:00Z',
      end: '2026-08-02T15:30:00Z',
    },
    availability: [
      {
        interval: {
          start: '2026-08-02T04:00:00Z',
          end: '2026-08-02T15:30:00Z',
        },
        availability: 'OPEN',
        reason: null,
        plannedAvailability: null,
        site: 'GN',
      },
    ],
    tooStatus: [
      {
        interval: {
          start: '2026-08-02T04:00:00Z',
          end: '2026-08-02T10:00:00Z',
        },
        tooSupport: 'RAPID',
        site: 'GN',
      },
      {
        interval: {
          start: '2026-08-02T10:00:00Z',
          end: '2026-08-02T15:30:00Z',
        },
        tooSupport: 'INTERRUPT',
        site: 'GN',
      },
    ],
    modes: [
      {
        interval: {
          start: '2026-08-02T04:00:00Z',
          end: '2026-08-02T15:30:00Z',
        },
        site: 'GN',
        mode: {
          type: 'QUEUE',
          programReference: null,
        },
      },
    ],
  },
];
