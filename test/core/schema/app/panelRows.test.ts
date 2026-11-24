import * as v from 'valibot';
import {describe, expect, it} from 'vitest';
import {
  PANEL_ROW_LIMITS,
  isPanelRowId,
  panelRowsChangeSchema,
  panelRowsSchema,
} from '@core/schema/app/panelRows';

describe('panel rows', () => {
  it('knows the rows of the panels and nothing else', () => {
    expect(isPanelRowId('show.order')).toBe(true);
    expect(isPanelRowId('media.audio')).toBe(true);
    expect(isPanelRowId('show.unknown')).toBe(false);
    expect(isPanelRowId('toString')).toBe(false);
  });

  it('keeps whole heights within the limits', () => {
    expect(
      v.safeParse(panelRowsSchema, {
        'show.order': PANEL_ROW_LIMITS.min,
        'prep.preview': PANEL_ROW_LIMITS.max,
      }).success,
    ).toBe(true);
    for (const height of [0, PANEL_ROW_LIMITS.max + 1, 12.5]) {
      expect(v.safeParse(panelRowsSchema, {'show.order': height}).success).toBe(
        false,
      );
    }
  });

  it('takes a change of at least one row', () => {
    expect(
      v.safeParse(panelRowsChangeSchema, {'show.tools': 240}).success,
    ).toBe(true);
    expect(v.safeParse(panelRowsChangeSchema, {}).success).toBe(false);
  });
});
