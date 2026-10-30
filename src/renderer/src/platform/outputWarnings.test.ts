import {beforeEach, expect, it} from 'vitest';
import type {Notice} from '@renderer/ui/notices';
import {
  dropOutputWarning,
  keepOutputWarning,
  outputWarningCards,
  useOutputWarnings,
  warningScreens,
} from './outputWarnings';

function warning(key: string, screenId: string, screenName: string) {
  const notice: Notice = {
    key,
    kind: 'warning',
    icon: 'plug',
    title: `${screenName} 경고`,
    time: '11:24',
  };
  return {screenId, screenName, notice};
}

beforeEach(() => useOutputWarnings.setState({warnings: new Map()}));

it('keeps each warning by its key and replaces it in place', () => {
  keepOutputWarning(warning('screen:stage', 'stage', '무대 화면'));
  keepOutputWarning(warning('screen:main', 'main', '본 화면'));
  keepOutputWarning(warning('screen:stage', 'stage', '무대 화면'));
  expect([...useOutputWarnings.getState().warnings.keys()]).toEqual([
    'screen:stage',
    'screen:main',
  ]);
});

it('drops a warning and ignores an unknown key without a new state', () => {
  keepOutputWarning(warning('screen:stage', 'stage', '무대 화면'));
  const before = useOutputWarnings.getState().warnings;
  dropOutputWarning('screen:main');
  expect(useOutputWarnings.getState().warnings).toBe(before);
  dropOutputWarning('screen:stage');
  expect(useOutputWarnings.getState().warnings.size).toBe(0);
});

it('lists each warned screen once and gives all its cards', () => {
  keepOutputWarning(warning('screen:main', 'main', '본 화면'));
  keepOutputWarning(warning('screen:stage', 'stage', '무대 화면'));
  keepOutputWarning(warning('output-window:main', 'main', '본 화면'));
  const {warnings} = useOutputWarnings.getState();
  expect(warningScreens(warnings)).toEqual([
    {screenId: 'main', screenName: '본 화면'},
    {screenId: 'stage', screenName: '무대 화면'},
  ]);
  expect(outputWarningCards('main').map(notice => notice.key)).toEqual([
    'screen:main',
    'output-window:main',
  ]);
});
