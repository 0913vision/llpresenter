/** The pages of the 환경설정 window, in the order its list shows them. */
export const PREFERENCE_PAGE_IDS = [
  'general',
  'output',
  'library',
  'bible',
  'import',
  'shortcuts',
] as const;

export type PreferencePageId = (typeof PREFERENCE_PAGE_IDS)[number];
