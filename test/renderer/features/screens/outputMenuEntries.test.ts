import {useLive} from '@renderer/session/live';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {menuItems} from '@renderer/ui/menuModel';
import {outputMenuFixture} from '@fixtures/renderer/platform/outputMenu';
import {
  screenOutputSections,
  type ScreenOutputInput,
} from '@renderer/features/screens/outputMenuEntries';

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
    ).find(item => item.id === 'broadcast-output');
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

it('turns each role on or off with only its own screens', () => {
  const {input, send} = fixture();
  const rows = menuItems(screenEntries({...input, outputs: {}}));
  const byRole = {
    'audience-output': input.screens.filter(
      screen => screen.kind === 'audience',
    ),
    'broadcast-output': input.screens.filter(
      screen => screen.kind === 'broadcast',
    ),
    'stage-output': input.screens.filter(screen => screen.kind === 'stage'),
  };
  for (const [id, screens] of Object.entries(byRole)) {
    expect(screens).toHaveLength(1);
    send.mockClear();
    rows.find(row => row.id === id)?.onSelect?.();
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'live.batch',
      commands: screens.map(screen => ({
        type: 'output.set',
        screenId: screen.id,
        on: true,
      })),
    });
  }
});

it('leaves 방송 화면 off when 청중 화면 turns on, and the reverse', () => {
  const {input} = fixture();
  const audience = input.screens.find(screen => screen.kind === 'audience');
  const broadcast = input.screens.find(screen => screen.kind === 'broadcast');
  if (!audience || !broadcast) throw new Error('Missing fixture screens');
  const label = (id: string, outputs: Record<string, boolean>) =>
    menuItems(screenEntries({...input, outputs})).find(row => row.id === id)
      ?.label;
  expect(label('audience-output', {[broadcast.id]: true})).toBe('출력 켜기');
  expect(label('broadcast-output', {[audience.id]: true})).toBe('출력 켜기');
});

it('opens the theme editor and the screen settings window', () => {
  const {input, send, onWorkspace} = fixture();
  const rows = menuItems(screenEntries(input));
  menuItems(rows.find(row => row.id === 'theme')?.loadSubmenu?.() ?? [])
    .find(row => row.id === 'edit')
    ?.onSelect?.();
  const openScreens = vi.fn();
  window.llp = mockLlpApi({window: {openScreens}, live: {send}});
  rows.find(row => row.id === 'screens')?.onSelect?.();
  expect(openScreens).toHaveBeenCalledOnce();
  expect(onWorkspace.mock.calls).toEqual([[]]);
});

it('opens screen settings without a workspace callback and explains a missing window bridge', () => {
  const {input} = fixture();
  const rows = menuItems(screenEntries({...input, onEditScreens: undefined}));
  expect(rows.find(row => row.id === 'screens')?.disabled).toBe(false);
  delete window.llp;
  const unavailable = menuItems(screenEntries(input));
  expect(unavailable.find(row => row.id === 'screens')).toMatchObject({
    disabled: true,
    title: '이 창에서는 쓸 수 없음',
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
      row => row.id === 'broadcast-output',
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
