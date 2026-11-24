/** Stable v1 starter UUIDs, shared by new installs and their cross-file references. */
export const STARTER_SCREEN_IDS = {
  main: '00000000-0000-4000-8000-000000000001',
  broadcast: '00000000-0000-4000-8000-000000000002',
  stage: '00000000-0000-4000-8000-000000000003',
} as const;

export const KIND_NAMES = {
  audience: '청중',
  stage: '무대',
  broadcast: '방송',
} as const;
