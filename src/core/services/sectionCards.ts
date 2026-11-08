import {createSlideId, type ServiceItemId} from '../schema/ids';
import type {ServiceItemOf} from '../schema/service';
import {SECTION_THEME_ID, type SundaySection} from '../themes/sundaySections';

/** The editable card shared by the item menu and built-in service templates. */
export function newSectionItem(
  id: ServiceItemId,
  section: SundaySection,
): ServiceItemOf<'slides'> {
  return {
    id,
    theme: SECTION_THEME_ID,
    background: section.background,
    slides: {
      form: 'blank',
      name: section.name,
      slides: [{id: createSlideId(crypto.randomUUID()), text: section.english}],
    },
  };
}
