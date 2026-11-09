/** Stable v1 starter UUIDs, shared by new installs and their cross-file references. */
export const STARTER_SCREEN_IDS = {
  main: '00000000-0000-4000-8000-000000000001',
  broadcast: '00000000-0000-4000-8000-000000000002',
  stage: '00000000-0000-4000-8000-000000000003',
} as const;

/** The presentation order shared by screen selectors and screen settings. */
export const SCREEN_KIND_ORDER = ['audience', 'stage', 'broadcast'] as const;
