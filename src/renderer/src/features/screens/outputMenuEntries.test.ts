import {useLive} from '@renderer/session/live';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {
  STAGE_ID,
  LAYOUT_ID,
  WIDE_LAYOUT_ID,
} from '@core/testing/screenDocuments';
import {menuItems} from '@renderer/ui/menuModel';
import {outputMenuFixture} from '@renderer/platform/testing/outputMenu';
import {
  screenOutputSections,
  type ScreenOutputInput,
} from './outputMenuEntries';

function fixture() {
  const {input, send, onWorkspace} = outputMenuFixture();
  return {input: {...input, onEditScreens: onWorkspace}, send, onWorkspace};
}

function screenEntries(input: ScreenOutputInput) {
  const sections = screenOutputSections(input);
  return [
    ...sections.audience,
    ...sections.stage,
    ...sections.broadcast,
    ...sections.settings,
  ];
}

afterEach(() => {
  delete window.llp;
});

it.each([false, true])(
  'labels and toggles the broadcast group with output on=%s',
  on => {
    const {input, send} = fixture();
    const broadcastId = input.screens[1]?.id;
    if (!broadcastId) throw new Error('Missing broadcast fixture');
    const row = menuItems(
      screenEntries({...input, outputs: {[broadcastId]: on}}),
    ).find(item => item.id === 'broadcast');
    expect(row?.label).toBe(on ? '출력 끄기' : '출력 켜기');
    expect(row?.check).toBeUndefined();
    expect(
      menuItems(screenEntries(input)).find(
        row => row.id === 'broadcast-settings',
      ),
    ).toMatchObject({disabled: true, title: '아직 없는 기능'});
    row?.onSelect?.();
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'live.batch',
      commands: [{type: 'output.set', screenId: broadcastId, on: !on}],
    });
  },
);

it('opens the theme editor and changes one stage screen', () => {
  const {input, send, onWorkspace} = fixture();
  const live = parseLiveState({
    ...emptyLiveState(),
    stageLayouts: {[STAGE_ID]: WIDE_LAYOUT_ID},
  });
  if (!live.ok) throw new Error('Invalid live fixture');
  const rows = menuItems(
    screenEntries({...input, stageLayouts: live.value.stageLayouts}),
  );
  menuItems(rows.find(row => row.id === 'theme')?.loadSubmenu?.() ?? [])
    .find(row => row.id === 'edit')
    ?.onSelect?.();
  const openScreens = vi.fn();
  window.llp = mockLlpApi({window: {openScreens}, live: {send}});
  rows.find(row => row.id === 'screens')?.onSelect?.();
  expect(openScreens).toHaveBeenCalledOnce();
  expect(onWorkspace.mock.calls).toEqual([[]]);
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
});

it('keeps output commands usable before settings load and disables unavailable editors', () => {
  const {input} = fixture();
  const rows = menuItems(screenEntries({...input, looks: null, layouts: null}));
  expect(rows.find(row => row.id === 'audience-output')?.disabled).toBe(false);
  expect(rows.find(row => row.id === `layout:${STAGE_ID}`)?.disabled).toBe(
    true,
  );
  expect(rows.find(row => row.id === `layout:${STAGE_ID}`)?.title).toBe(
    '무대 배치 불러오는 중',
  );
});

it('explains empty choices', () => {
  const {input} = fixture();
  const empty = menuItems(
    screenEntries({
      ...input,
      looks: {...input.looks, looks: []},
      layouts: {...input.layouts, layouts: []},
    }),
  );
  expect(empty.find(row => row.id === `layout:${STAGE_ID}`)?.title).toBe(
    '무대 배치 없음',
  );
  const screen = input.screens[0];
  if (!screen) throw new Error('Missing screen fixture');
  const invalid = menuItems(
    screenEntries({
      ...input,
      screens: [{...screen, id: 'invalid', kind: 'stage', statusLabel: '무대'}],
    }),
  );
  expect(invalid.find(row => row.id === 'layout:invalid')?.title).toBe(
    '화면을 찾을 수 없음',
  );
});

it('opens screen settings without a workspace callback and explains a missing window bridge', () => {
  const {input} = fixture();
  const rows = menuItems(screenEntries({...input, onEditScreens: undefined}));
  expect(rows.find(row => row.id === 'screens')?.disabled).toBe(false);
  delete window.llp;
  const unavailable = menuItems(screenEntries(input));
  expect(unavailable.find(row => row.id === 'screens')).toMatchObject({
    disabled: true,
    title: '화면 설정 연결 안 됨',
  });
});

it('keeps the saved broadcast output available when its destination is a window', () => {
  const {input} = fixture();
  const screens = input.screens.map(screen => ({
    ...screen,
    targetKind: 'window' as const,
  }));
  expect(
    menuItems(screenEntries({...input, screens})).find(
      row => row.id === 'broadcast',
    )?.disabled,
  ).toBe(false);
});

it('selects a live theme through its Output command', () => {
  const {input, send} = fixture();
  const theme = input.themes.themes[0];
  if (!theme) throw new Error('Missing fixture theme');
  const live = {
    ...emptyLiveState(),
    themeItem: {id: 'item', kind: 'song' as const, source: 'service' as const},
    themeOutput: {themeId: theme.id, revision: 1, missing: [], screens: {}},
  };
  useLive.setState({state: live});
  const rows = menuItems(
    screenEntries({...input, themeId: theme.id, hasItem: true}),
  );
  const choices = menuItems(
    rows.find(row => row.id === 'theme')?.loadSubmenu?.() ?? [],
  );
  expect(choices.find(row => row.id === theme.id)?.checked).toBe(true);
  choices.find(row => row.id === theme.id)?.onSelect?.();
  expect(send.mock.calls).toEqual([[{type: 'theme.set', themeId: theme.id}]]);
  useLive.setState({state: null});
});
