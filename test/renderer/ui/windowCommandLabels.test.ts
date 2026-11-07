import {expect, it} from 'vitest';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';

it('reserves ellipses for settings windows and names the inline song editor directly', () => {
  expect(windowCommandLabels.editSong).toBe('곡 편집');
  expect(windowCommandLabels.preferences).toBe('환경설정…');
  expect(windowCommandLabels.screens).toBe('화면 설정…');
});
