import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {
  screensDocument,
  looksDocument,
  stageLayoutsDocument,
  STAGE_ID,
  LAYOUT_ID,
  WIDE_LAYOUT_ID,
} from '@core/testing/screenDocuments';
import {useScreensSelection} from '@renderer/features/screens/selection';
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
  window.llp = mockLlpApi({live: {send}});
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

it.each([false, true])(
  'lists three screen groups before final screen settings with warnings=%s',
  warnings => {
    const {input} = fixture();
    const rows = outputMenuEntries({
      ...input,
      warnings: warnings ? input.warnings : [],
    });
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
      '[방송 자막]',
      '출력 켜기',
      '방송 설정…',
      ...(warnings ? ['|', '무대 화면 경고 보기'] : []),
      '|',
      '화면 설정…',
    ]);
    expect(
      menuItems(rows)
        .filter(row => row.check === 'checkbox')
        .map(row => row.id),
    ).toEqual([]);
    expect(menuItems(rows).every(row => row.icon === undefined)).toBe(true);
    expect(
      menuItems(rows).find(row => row.id === 'broadcast-settings'),
    ).toMatchObject({disabled: true, title: '아직 없는 기능'});
  },
);

it.each([false, true])(
  'labels and toggles the broadcast group with output on=%s',
  on => {
    const {input, send} = fixture();
    const broadcastId = input.screens[1]?.id;
    if (!broadcastId) throw new Error('Missing broadcast fixture');
    const row = menuItems(
      outputMenuEntries({...input, outputs: {[broadcastId]: on}}),
    ).find(item => item.id === 'broadcast');
    expect(row?.label).toBe(on ? '출력 끄기' : '출력 켜기');
    expect(row?.check).toBeUndefined();
    row?.onSelect?.();
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'live.batch',
      commands: [{type: 'output.set', screenId: broadcastId, on: !on}],
    });
  },
);

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

it('selects Look and layout editors, changes one stage screen, and preserves warning actions', () => {
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
  rows.find(row => row.id === `warning:${STAGE_ID}`)?.onSelect?.();
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
  expect(rows.find(row => row.id === 'look')?.title).toBe('Look 불러오는 중');
  expect(rows.find(row => row.id === 'edit-look')?.title).toBe(
    '선택한 Look 없음',
  );
  expect(rows.find(row => row.id === `layout:${STAGE_ID}`)?.title).toBe(
    '무대 배치 불러오는 중',
  );
  expect(rows.find(row => row.id === 'edit-layout')?.title).toBe(
    '선택한 배치 없음',
  );
});

it('explains empty choices and unavailable editor callbacks separately', () => {
  const {input} = fixture();
  const empty = menuItems(
    outputMenuEntries({
      ...input,
      looks: {...input.looks, looks: []},
      layouts: {...input.layouts, layouts: []},
    }),
  );
  expect(empty.find(row => row.id === 'look')?.title).toBe('Look 없음');
  expect(empty.find(row => row.id === `layout:${STAGE_ID}`)?.title).toBe(
    '무대 배치 없음',
  );
  const disconnected = menuItems(
    outputMenuEntries({...input, onWorkspace: undefined}),
  );
  for (const id of ['edit-look', 'edit-layout', 'screens']) {
    expect(disconnected.find(row => row.id === id)).toMatchObject({
      disabled: true,
      title: '화면 설정 연결 안 됨',
    });
  }
  const screen = input.screens[0];
  if (!screen) throw new Error('Missing screen fixture');
  const invalid = menuItems(
    outputMenuEntries({
      ...input,
      screens: [{...screen, id: 'invalid', kind: 'stage', statusLabel: '무대'}],
    }),
  );
  expect(invalid.find(row => row.id === 'layout:invalid')?.title).toBe(
    '화면을 찾을 수 없음',
  );
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
