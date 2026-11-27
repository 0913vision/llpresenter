import {vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {screensDocument, STAGE_ID} from '@fixtures/core/screenDocuments';
import {summarizeScreens} from '@renderer/platform/screens/screenSummary';

export function outputMenuFixture() {
  const screens = screensDocument();
  if (screens.name !== 'screens') throw new Error('Invalid fixtures');
  const send = vi.fn();
  const onShowWarning = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const input = {
    screens: summarizeScreens(screens.value.screens),
    hasItem: false,
    outputs: {[screens.value.screens[0]?.id ?? '']: true},
    warnings: [{screenId: STAGE_ID, screenName: '무대 화면'}],
    onShowWarning,
  };
  return {input, send, onShowWarning};
}
