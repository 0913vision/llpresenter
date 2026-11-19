/** Temporary comparison switch for card 63; remove before merging. */
export function sectionDraft(): 'a' | 'b' | null {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem('llp.section-draft');
  return value === 'a' || value === 'b' ? value : null;
}
