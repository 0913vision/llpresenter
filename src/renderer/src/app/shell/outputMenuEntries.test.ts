import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {
  screensDocument,
  looksDocument,
  stageLayoutsDocument,
  STAGE_ID,
  LAYOUT_ID,
  WIDE_LAYOUT_ID,
} from '@renderer/screens/testing/documents';
import {useScreensSelection} from '@renderer/screens/selection';
import {menuItems} from '@renderer/ui/menuModel';
import {summarizeScreens} from '../../platform/screens';
import {outputMenuEntries} from './outputMenuEntries';

function fixture() {
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
  window.llp = fakeLlpApi({live: {send}});
  const input = {
    screens: summarizeScreens(screens.value.screens),
    looks: looks.value,
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
afterEach(() => {
  delete window.llp;
});

it('lists every output group, row and separator in spec order with no per-screen checks', () => {
  const {input} = fixture();
  const rows = outputMenuEntries(input);
  expect(
    rows.map(row =>
      row.kind === 'separator'
        ? '|'
        : row.kind === 'group'
          ? `[${row.label}]`
          : row.label,
    ),
  ).toEqual([
    '[본 화면]',
    '출력 끄기',
    'Look: 평상시',
    'Look 편집…',
    '|',
    '[무대 화면]',
    '출력 켜기',
    '무대 화면: 현재와 다음',
    '무대 배치 편집…',
    '|',
    '화면 설정…',
    '|',
    '방송 자막 켜기',
    '방송 설정…',
    '|',
    '무대 화면 경고 보기',
  ]);
  expect(
    menuItems(rows)
      .filter(row => row.check === 'checkbox')
      .map(row => row.id),
  ).toEqual(['broadcast']);
  expect(menuItems(rows).every(row => row.icon === undefined)).toBe(true);
  expect(
    menuItems(rows).find(row => row.id === 'broadcast-settings'),
  ).toMatchObject({disabled: true, title: '아직 없는 기능'});
});

it('toggles whole output groups and broadcast through bounded transactions', () => {
  const {input, send} = fixture();
  const rows = menuItems(outputMenuEntries(input));
  for (const id of ['audience-output', 'stage-output', 'broadcast']) {
    rows.find(row => row.id === id)?.onSelect?.();
  }
  const ids = input.screens.map(screen => screen.id);
  expect(send.mock.calls).toEqual([
    [
      {
        type: 'live.batch',
        commands: ids
          .slice(0, 2)
          .map(screenId => ({type: 'output.set', screenId, on: false})),
      },
    ],
    [
      {
        type: 'live.batch',
        commands: [{type: 'output.set', screenId: ids[2], on: true}],
      },
    ],
    [
      {
        type: 'live.batch',
        commands: [{type: 'output.set', screenId: ids[1], on: true}],
      },
    ],
  ]);
  const source = input.screens[0];
  if (!source) throw new Error('Missing screen');
  send.mockClear();
  const many = Array.from({length: 257}, (_, index) => ({
    ...source,
    id: `screen-${index}`,
  }));
  menuItems(outputMenuEntries({...input, screens: many, outputs: {}}))
    .find(row => row.id === 'audience-output')
    ?.onSelect?.();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenNthCalledWith(2, {
    type: 'live.batch',
    commands: [{type: 'output.set', screenId: 'screen-256', on: true}],
  });
});

it('selects Look and layout editors, changes one stage screen, and keeps warnings last', () => {
  const {input, send, onWorkspace, onShowWarning} = fixture();
  const live = parseLiveState({
    ...emptyLiveState(),
    stageLayouts: {[STAGE_ID]: WIDE_LAYOUT_ID},
  });
  if (!live.ok) throw new Error('Invalid live fixture');
  const rows = menuItems(
    outputMenuEntries({...input, stageLayouts: live.value.stageLayouts}),
  );
  rows.find(row => row.id === 'edit-look')?.onSelect?.();
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'look',
    id: input.looks.current,
  });
  rows.find(row => row.id === 'edit-layout')?.onSelect?.();
  expect(useScreensSelection.getState().selection).toEqual({
    kind: 'stage',
    id: WIDE_LAYOUT_ID,
  });
  rows.find(row => row.id === 'screens')?.onSelect?.();
  expect(onWorkspace.mock.calls).toEqual([
    ['screens'],
    ['screens'],
    ['screens'],
  ]);
  const choices = menuItems(
    rows.find(row => row.id === `layout:${STAGE_ID}`)?.loadSubmenu?.() ?? [],
  );
  expect(choices.map(row => row.checked)).toEqual([false, true]);
  choices[0]?.onSelect?.();
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'stage.layout.set',
    screenId: STAGE_ID,
    layoutId: LAYOUT_ID,
  });
  rows.at(-1)?.onSelect?.();
  expect(onShowWarning).toHaveBeenCalledExactlyOnceWith(STAGE_ID);
});

it('keeps output commands usable before settings load and disables unavailable editors', () => {
  const {input} = fixture();
  const rows = menuItems(
    outputMenuEntries({...input, looks: null, layouts: null}),
  );
  expect(rows.find(row => row.id === 'audience-output')?.disabled).toBe(false);
  for (const id of ['look', 'edit-look', 'edit-layout', `layout:${STAGE_ID}`]) {
    expect(rows.find(row => row.id === id)?.disabled).toBe(true);
  }
});

it('keeps the saved broadcast output available when its destination is a window', () => {
  const {input} = fixture();
  const screens = input.screens.map(screen => ({
    ...screen,
    targetKind: 'window' as const,
  }));
  expect(
    menuItems(outputMenuEntries({...input, screens})).find(
      row => row.id === 'broadcast',
    )?.disabled,
  ).toBe(false);
});
