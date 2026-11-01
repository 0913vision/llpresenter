import {vi} from 'vitest';
import {themeFile} from '@core/testing/themeOutput';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {screensDocument, STAGE_ID} from '@core/testing/screenDocuments';
import {summarizeScreens} from '../screens';

export function outputMenuFixture() {
  const screens = screensDocument();
  if (screens.name !== 'screens') throw new Error('Invalid fixtures');
  const send = vi.fn();
  const onWorkspace = vi.fn();
  const onShowWarning = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const input = {
    screens: summarizeScreens(screens.value.screens),
    themes: themeFile(),
    themeId: undefined,
    hasItem: false,
    outputs: {[screens.value.screens[0]?.id ?? '']: true},
    warnings: [{screenId: STAGE_ID, screenName: '무대 화면'}],
    onWorkspace,
    onShowWarning,
    onProblem: vi.fn(),
  };
  return {input, send, onWorkspace, onShowWarning};
}
