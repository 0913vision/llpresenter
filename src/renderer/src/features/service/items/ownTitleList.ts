import type {SavedTitle} from '@core/schema/screens/themes';

/**
 * The kept titles once the title `id` is saved as `title`, in its place or
 * after the others when it is new, or taken out when `title` is null.
 */
export function titlesAfter(
  titles: readonly SavedTitle[],
  id: string,
  title: SavedTitle | null,
): readonly SavedTitle[] {
  if (title === null) return titles.filter(entry => entry.id !== id);
  return titles.some(entry => entry.id === id)
    ? titles.map(entry => (entry.id === id ? title : entry))
    : [...titles, title];
}
