/** The pages of the 환경설정 window, in the order its list shows them. */
export const PREFERENCE_PAGE_IDS = [
  'general',
  'show',
  'prep',
  'output',
  'serviceOrder',
  'storage',
  'labels',
  'media',
  'bible',
  'shortcuts',
  'about',
] as const;

/** One page of the 환경설정 window. */
export type PreferencePageId = (typeof PREFERENCE_PAGE_IDS)[number];
