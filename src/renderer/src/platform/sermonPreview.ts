import {displayReference} from '@core/bible/displayReference';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import type {ItemRow} from '@core/presentation/model';

/** Resolve the title slide exactly like the live sermon-title output. */
export function sermonPreviewRow(id: string, reference: string): ItemRow {
  return {
    id,
    kind: 'slides',
    form: 'blank',
    title: displayReference(reference),
    theme: SERMON_TITLE_THEME_ID,
  };
}
