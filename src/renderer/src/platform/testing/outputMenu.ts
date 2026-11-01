import {vi} from 'vitest';
import {themeFile} from '@core/testing/themeOutput';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {
  screensDocument,
  looksDocument,
  stageLayoutsDocument,
  STAGE_ID,
} from '@core/testing/screenDocuments';
import {summarizeScreens} from '../screens';

export function outputMenuFixture() {
  const screens = screensDocument();
  const looks = looksDocument();
  const layouts = stageLayoutsDocument();
  if (
    screens.name !== 'screens' ||
    looks.name !== 'looks' ||
    layouts.name !== 'stage-layouts'
  ) {
    throw new Error('Invalid fixtures');
  }
  const send = vi.fn();
  const onWorkspace = vi.fn();
  const onShowWarning = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const input = {
    screens: summarizeScreens(screens.value.screens),
    looks: looks.value,
    themes: themeFile(),
    themeId: undefined,
    hasItem: false,
    layouts: layouts.value,
    outputs: {[screens.value.screens[0]?.id ?? '']: true},
    lookId: null,
    stageLayouts: undefined,
    warnings: [{screenId: STAGE_ID, screenName: '무대 화면'}],
    onWorkspace,
    onShowWarning,
    onProblem: vi.fn(),
  };
  return {input, send, onWorkspace, onShowWarning};
}
