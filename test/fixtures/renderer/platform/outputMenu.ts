import {vi} from 'vitest';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {screensDocument, STAGE_ID} from '@fixtures/core/screenDocuments';
import {summarizeScreens} from '@renderer/platform/screens';

export function outputMenuFixture() {
  const screens = screensDocument();
  if (screens.name !== 'screens') throw new Error('Invalid fixtures');
  const send = vi.fn();
  const onWorkspace = vi.fn();
  const onShowWarning = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const input = {
    screens: summarizeScreens(screens.value.screens),
    themes: BUILT_IN_THEMES,
    theme: undefined,
    hasItem: false,
    outputs: {[screens.value.screens[0]?.id ?? '']: true},
    warnings: [{screenId: STAGE_ID, screenName: '무대 화면'}],
    onWorkspace,
    onShowWarning,
    onProblem: vi.fn(),
  };
  return {input, send, onWorkspace, onShowWarning};
}
