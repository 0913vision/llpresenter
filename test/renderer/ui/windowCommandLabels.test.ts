import {expect, it} from 'vitest';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';

it('writes every command that opens a window with an ellipsis', () => {
  for (const label of Object.values(windowCommandLabels)) {
    expect(label.endsWith('…')).toBe(true);
  }
});
