import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {emptyLiveState} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import {
  parseServiceDocument,
  parseServiceEntries,
} from '@core/schema/contentDocuments';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {Theme} from '@core/schema/themes';
import type {Screen} from '@core/schema/screens';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {useLive} from '@renderer/session/live';
import * as gradientSampling from '@renderer/rendering/sampleThemeGradient';
import {mockCanvasViewport} from '@fixtures/renderer/ui/canvasTesting';
import {ThemeLeaveGuard} from '@renderer/features/screens/themes/themeLeaveGuard';
import {useThemePanels} from '@renderer/features/screens/themes/useThemePanels';
import userEvent from '@testing-library/user-event';

const MAIN = createScreenId('00000000-0000-4000-8000-000000000001');
const STAGE = createScreenId('00000000-0000-4000-8000-000000000003');

beforeEach(mockCanvasViewport);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useLive.setState({state: null});
});

function setup({
  idle = false,
  services,
  oldStandby = false,
  screenOrder,
}: {
  readonly idle?: boolean;
  /** A 대기 화면 saved before it had any screen layout. */
  readonly oldStandby?: boolean;
  readonly services?: Partial<LlpApi['services']>;
  readonly screenOrder?: readonly Screen[];
} = {}) {
  const initial = settingsDocument('themes', createDefaultThemes());
  if (initial.name !== 'themes') throw new Error('Expected themes');
  let themes = oldStandby
    ? {
        ...initial,
        value: {
          ...initial.value,
          standby: {...initial.value.standby, screens: {}},
        },
      }
    : initial;
  const song = themes.value.themes[0];
  if (song === undefined) throw new Error('Expected song theme');
  const screens = settingsDocument('screens', {
    screens: screenOrder ?? [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: '청중 화면',
        kind: 'audience',
        method: 'fullscreen',
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: '방송 화면',
        kind: 'audience',
        method: 'capture',
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: '무대 화면',
        kind: 'stage',
        method: 'fullscreen',
      },
    ],
  });
  const baseApi = mockLlpApi();
  const listeners = new Set<(document: SettingsDocument) => void>();
  let revision = 1;
  const edit = vi
    .fn<LlpApi['settings']['edit']>()
    .mockImplementation(change => {
      if (change.type !== 'settings.update' || change.name !== 'themes') {
        return baseApi.settings.edit(change);
      }
      themes = {...themes, value: change.value, revision: ++revision};
      for (const listener of listeners) listener(themes);
      return Promise.resolve({ok: true, value: {id: 'themes', revision}});
    });
  vi.stubGlobal('llp', undefined);
  const api = mockLlpApi({
    ...(services === undefined ? {} : {services}),
    settings: {
      get: async request =>
        request.name === 'themes'
          ? themes
          : request.name === 'screens'
            ? screens
            : baseApi.settings.get(request),
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  });
  window.llp = api;
  useLive.setState({
    state: idle
      ? emptyLiveState()
      : {
          ...emptyLiveState(),
          themeOutput: {
            themeId: song.id,
            revision: 1,
            missing: [],
            screens: {},
          },
        },
  });
  const report = vi.fn();
  const guard = new ThemeLeaveGuard();
  function Workspace() {
    const panels = useThemePanels(true, report, guard);
    return (
      <>
        {panels.left}
        {panels.canvas}
        {panels.right}
      </>
    );
  }
  render(<Workspace />);
  return {edit, report, guard, value: () => themes.value, listeners};
}

async function saveEdits() {
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  fireEvent.click(await screen.findByRole('button', {name: '덮어쓰기'}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

it.each(['청중 화면 편집', '무대 화면 편집', '방송 화면 편집'])(
  'adds the slide name text element once on %s',
  async screenName => {
    const {value} = setup();
    fireEvent.click(await screen.findByRole('button', {name: screenName}));
    const palette = screen.getByRole('region', {name: '요소 추가'});
    fireEvent.click(
      within(palette).getByRole('button', {name: '슬라이드 이름'}),
    );
    expect(screen.getByRole('listbox', {name: '요소'}).textContent).toContain(
      '슬라이드 이름',
    );
    expect(
      within(palette).queryByRole('button', {name: '슬라이드 이름'}),
    ).toBeNull();
    await saveEdits();
    expect(
      Object.values(value().themes[0]?.screens ?? {})
        .flatMap(layout => layout.elements)
        .filter(element => element.kind === 'slideName'),
    ).toHaveLength(1);
  },
);

it('keeps standby first and LIVE before kind tags, and saves theme duplication and inline rename', async () => {
  const {value, listeners} = setup();
  const themes = await screen.findByRole('listbox', {name: '테마'});
  await waitFor(() =>
    expect(within(themes).getAllByRole('option')).toHaveLength(
      createDefaultThemes().themes.length + 1,
    ),
  );
  expect(within(themes).getAllByRole('option')[0]?.textContent).toBe(
    '대기 화면',
  );
  const song = within(themes).getByRole('option', {name: '찬양'});
  expect(song.textContent).toBe('찬양LIVE곡');
  fireEvent.contextMenu(song, {clientX: 10, clientY: 10});
  fireEvent.click(await screen.findByRole('menuitem', {name: '복제'}));
  const copied = await screen.findByRole('option', {name: '찬양 복사본'});
  fireEvent.contextMenu(copied, {clientX: 10, clientY: 10});
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
  const input = await within(copied).findByRole('textbox');
  fireEvent.change(input, {target: {value: '점검 테마'}});
  fireEvent.keyDown(input, {key: 'Enter'});
  await waitFor(() =>
    expect(value().themes.some(theme => theme.name === '점검 테마')).toBe(true),
  );
  cleanup();
  expect(listeners.size).toBe(0);
});

it('duplicates the focused 테마 with Ctrl D, the way its 복제 row does', async () => {
  setup();
  const themes = await screen.findByRole('listbox', {name: '테마'});
  await waitFor(() =>
    expect(within(themes).getAllByRole('option')).toHaveLength(
      createDefaultThemes().themes.length + 1,
    ),
  );
  const song = within(themes).getByRole('option', {name: '찬양'});
  fireEvent.click(song);
  song.focus();
  fireEvent.keyDown(song, {key: 'd', code: 'KeyD', ctrlKey: true});
  expect(await screen.findByRole('option', {name: '찬양 복사본'})).toBeTruthy();
});

it('asks before every 테마 delete, says where a 테마 is the default, and keeps it on cancel', async () => {
  const {value} = setup();
  const themes = await screen.findByRole('listbox', {name: '테마'});
  fireEvent.contextMenu(within(themes).getByRole('option', {name: '찬양'}), {
    clientX: 10,
    clientY: 10,
  });
  fireEvent.click(await screen.findByRole('menuitem', {name: '복제'}));
  const copied = await screen.findByRole('option', {name: '찬양 복사본'});

  fireEvent.contextMenu(copied, {clientX: 10, clientY: 10});
  fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
  const unused = await screen.findByRole('alertdialog');
  expect(unused.textContent).toContain('‘찬양 복사본’ 테마를 삭제할까요?');
  expect(unused.textContent).not.toContain('에서 씀');
  fireEvent.click(within(unused).getByRole('button', {name: '취소'}));
  expect(value().themes.some(theme => theme.name === '찬양 복사본')).toBe(true);

  fireEvent.contextMenu(within(themes).getByRole('option', {name: '말씀'}), {
    clientX: 10,
    clientY: 10,
  });
  fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
  const used = await screen.findByRole('alertdialog');
  expect(used.textContent).toContain('쓰는 곳: 성경, 빈 슬라이드 기본');
  fireEvent.click(within(used).getByRole('button', {name: '삭제'}));
  await waitFor(() =>
    expect(value().themes.some(theme => theme.name === '말씀')).toBe(false),
  );
});

it('says the use of a 테마 cannot be checked instead of showing no use', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  setup({
    services: {list: vi.fn().mockRejectedValue(new Error('Unreachable'))},
  });
  const themes = await screen.findByRole('listbox', {name: '테마'});
  fireEvent.contextMenu(within(themes).getByRole('option', {name: '찬양'}), {
    clientX: 10,
    clientY: 10,
  });
  fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
  const question = await screen.findByRole('alertdialog');
  expect(question.textContent).toContain('‘찬양’ 테마를 삭제할까요?');
  expect(question.textContent).toContain('쓰는 곳 확인 실패');
  expect(question.textContent).not.toContain('쓰는 곳: 예배');
  expect(screen.queryAllByRole('alert')).toEqual([]);
  expect(logged).toHaveBeenCalledTimes(1);
});

it('shows clean geometry after selection and preserves explicitly typed precision', async () => {
  const {value} = setup();
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  for (const [name, shown] of [
    ['X', '132'],
    ['Y', '141'],
    ['W', '1656'],
    ['H', '411'],
  ] as const) {
    expect(screen.getByRole('spinbutton', {name})).toHaveProperty(
      'value',
      shown,
    );
  }
  const x = screen.getByRole('spinbutton', {name: 'X'});
  fireEvent.change(x, {target: {value: '115.253'}});
  fireEvent.keyDown(x, {key: 'Enter'});
  await saveEdits();
  await waitFor(() => {
    const current = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(current?.frame.x).toBe(115.253);
    expect(x).toHaveProperty('value', '115.3');
  });
});

it('adds and deletes elements with keyboard actions and saves checkbox/text properties', async () => {
  const {value} = setup();
  await screen.findByRole('button', {name: '현재 가사'});
  const clock = screen.getByRole('button', {name: '시계'});
  fireEvent.click(clock);
  await saveEdits();
  await waitFor(() =>
    expect(
      value().themes[0]?.screens[MAIN]?.elements.some(
        element => element.kind === 'clock',
      ),
    ).toBe(true),
  );
  const pictureClock = screen.getByRole('button', {name: '시계'});
  await waitFor(() =>
    expect(pictureClock.getAttribute('aria-pressed')).toBe('true'),
  );
  fireEvent.keyDown(pictureClock, {key: 'Delete'});
  await saveEdits();
  await waitFor(() =>
    expect(
      value().themes[0]?.screens[MAIN]?.elements.some(
        element => element.kind === 'clock',
      ),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', {name: '현재 가사'}));
  const outline = await screen.findByRole('checkbox', {name: '외곽선'});
  const before = outline.getAttribute('aria-checked') === 'true';
  fireEvent.click(outline);
  await saveEdits();
  await waitFor(() => {
    const current = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(current?.text.outline.on).toBe(!before);
  });
  expect(
    screen
      .getByRole('spinbutton', {name: '크기'})
      .getAttribute('aria-valuemax'),
  ).toBe('400');
  expect(
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'}),
  ).toBeNull();
  const size = screen.getByRole('spinbutton', {name: '크기'});
  fireEvent.change(size, {target: {value: '72'}});
  fireEvent.keyDown(size, {key: 'Enter'});
  fireEvent.click(screen.getByRole('checkbox', {name: '채우기'}));
  await saveEdits();
  await waitFor(() => {
    const current = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(current?.text.size).toBe(72);
    expect(current?.box?.on).toBe(true);
  });
});

it('edits the Bible split count from screen properties and keeps text properties free of split budgets', async () => {
  const {value} = setup();
  const themes = await screen.findByRole('listbox', {name: '테마'});
  fireEvent.click(screen.getByRole('button', {name: '현재 가사'}));
  expect(
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'}),
  ).toBeNull();
  const songBefore = value().themes[0];
  fireEvent.click(within(themes).getByRole('option', {name: '말씀'}));
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  expect(
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'}),
  ).toBeNull();
  fireEvent.click(screen.getByRole('tab', {name: '화면'}));
  const count = screen.getByRole('spinbutton', {name: '성경 분할 줄 수'});
  expect(count.getAttribute('aria-valuemin')).toBe('1');
  expect(count.getAttribute('aria-valuemax')).toBe('12');
  fireEvent.change(count, {target: {value: '3'}});
  fireEvent.keyDown(count, {key: 'Enter'});
  await saveEdits();
  const bible = value().themes.find(
    theme => theme.id === value().defaults.bible,
  );
  const current = bible?.screens[MAIN]?.elements.find(
    element => element.kind === 'currentText',
  );
  expect(current?.text.maxLines).toBe(3);
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  expect(
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'}),
  ).toBeNull();
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  expect(
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'}),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: '다음 가사'}));
  expect(
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'}),
  ).toBeNull();
  fireEvent.click(within(themes).getByRole('option', {name: '찬양'}));
  expect(value().themes[0]).toEqual(songBefore);
});

it('saves a nondefault theme split budget shared by Bible and blank verse items without changing defaults', async () => {
  const defaults = createDefaultThemes();
  const theme = defaults.themes[0];
  if (theme === undefined) throw new Error('Expected song theme');
  const entries = parseServiceEntries([
    {
      id: SERVICE_ID,
      name: '예배',
      date: '2026-11-01T11:00',
      access: 'editable',
    },
  ]);
  const document = parseServiceDocument({
    revision: 1,
    access: 'editable',
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: '예배',
      date: '2026-11-01T11:00',
      order: [
        {
          id: itemId(300),
          theme: theme.id,
          bible: {
            translation: 'krv',
            ref: '요한복음 1:1',
            split: 'fit',
            reference: 'every',
            verseNumbers: true,
            translationName: false,
          },
        },
        {
          id: itemId(301),
          theme: theme.id,
          slides: {
            form: 'blank',
            name: '말씀 구절',
            slides: [
              {
                id: itemId(302),
                verse: {translation: 'krv', book: 43, chapter: 1, verse: 1},
              },
            ],
          },
        },
      ],
    },
  });
  if (!entries.ok || !document.ok || document.value === null) {
    throw new Error('Invalid Bible and blank verse service');
  }
  const service = document.value;
  const {value} = setup({
    services: {
      list: async () => entries.value,
      get: async () => service,
    },
  });
  await screen.findByRole('listbox', {name: '테마'});
  expect(value().defaults.bible).not.toBe(theme.id);
  expect(value().defaults.blank).not.toBe(theme.id);
  fireEvent.click(screen.getByRole('button', {name: '현재 가사'}));
  expect(
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'}),
  ).toBeNull();
  fireEvent.click(screen.getByRole('tab', {name: '화면'}));
  const count = within(screen.getByRole('group', {name: '성경'})).getByRole(
    'spinbutton',
    {name: '성경 분할 줄 수'},
  );
  fireEvent.change(count, {target: {value: '5'}});
  fireEvent.keyDown(count, {key: 'Enter'});
  await saveEdits();
  expect(value().defaults).toEqual(defaults.defaults);
  expect(
    value()
      .themes.find(saved => saved.id === theme.id)
      ?.screens[MAIN]?.elements.find(element => element.kind === 'currentText')
      ?.text.maxLines,
  ).toBe(5);
  expect(
    value().themes.find(saved => saved.id === defaults.defaults.bible),
  ).toEqual(
    defaults.themes.find(saved => saved.id === defaults.defaults.bible),
  );
  expect(service.service.order.every(item => item.theme === theme.id)).toBe(
    true,
  );
});

it('edits the first saved screen split budget without audience screens despite the editor display order', async () => {
  const broadcast = createScreenId('00000000-0000-4000-8000-000000000002');
  const {value} = setup({
    screenOrder: [
      {id: STAGE, name: '무대 화면', kind: 'stage', method: 'fullscreen'},
      {id: broadcast, name: '방송 화면', kind: 'broadcast', method: 'capture'},
    ],
  });
  await screen.findByRole('listbox', {name: '테마'});
  const displayed = screen.getAllByRole('button', {name: /화면 편집$/});
  expect(displayed.map(button => button.getAttribute('aria-label'))).toEqual([
    '방송 화면 편집',
    '무대 화면 편집',
  ]);
  const themeBefore = value().themes[0];
  const count = () =>
    screen.queryByRole('spinbutton', {name: '성경 분할 줄 수'});
  expect(count()).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  const field = screen.getByRole('spinbutton', {name: '성경 분할 줄 수'});
  fireEvent.change(field, {target: {value: '6'}});
  fireEvent.keyDown(field, {key: 'Enter'});
  await saveEdits();
  expect(
    value().themes[0]?.screens[STAGE]?.elements.find(
      element => element.kind === 'currentText',
    )?.text.maxLines,
  ).toBe(6);
  expect(value().themes[0]?.screens[broadcast]).toEqual(
    themeBefore?.screens[broadcast],
  );
  fireEvent.click(screen.getByRole('button', {name: '방송 화면 편집'}));
  expect(count()).toBeNull();
});

it('picks gradient presets in one undo step, edits only the selected stop and retains inheritance', async () => {
  const {value} = setup();
  await screen.findByLabelText('테마 캔버스');
  fireEvent.click(screen.getByRole('tab', {name: '화면'}));
  expect(screen.queryByRole('group', {name: '프리셋'})).toBeNull();
  fireEvent.click(screen.getByRole('radio', {name: '그라데이션'}));
  expect(screen.queryByRole('radiogroup', {name: '색 섞기'})).toBeNull();
  const presets = screen.getByRole('group', {name: '프리셋'});
  expect(within(presets).getAllByRole('button')).toHaveLength(8);
  fireEvent.click(within(presets).getByRole('button', {name: '청록'}));
  expect(screen.getByRole('textbox', {name: '색'}).getAttribute('value')).toBe(
    '#00303A',
  );
  fireEvent.click(screen.getByRole('slider', {name: '색 2, 87 %'}));
  expect(screen.getByRole('textbox', {name: '색'}).getAttribute('value')).toBe(
    '#00667A',
  );
  expect(screen.getAllByRole('spinbutton', {name: '위치'})).toHaveLength(1);
  fireEvent.click(within(presets).getByRole('button', {name: '적갈'}));
  expect(screen.getAllByRole('slider')).toHaveLength(3);
  expect(
    within(presets)
      .getByRole('button', {name: '적갈'})
      .getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.keyDown(document.body, {key: 'z', code: 'KeyZ', ctrlKey: true});
  expect(screen.getAllByRole('slider')).toHaveLength(2);
  expect(
    within(presets)
      .getByRole('button', {name: '청록'})
      .getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.keyDown(document.body, {key: 'y', code: 'KeyY', ctrlKey: true});
  expect(screen.getAllByRole('slider')).toHaveLength(3);
  await saveEdits();
  expect(value().themes[0]?.screens[MAIN]?.background).toMatchObject({
    kind: 'linear',
    angle: 135,
    mixing: 'oklch',
    stops: [
      {color: '#3A0000', position: 36},
      {color: '#5A2500', position: 61.5},
      {color: '#7A4900', position: 87},
    ],
  });
  fireEvent.click(screen.getByRole('radio', {name: '단색'}));
  expect(screen.getByRole('textbox', {name: '색'}).getAttribute('value')).toBe(
    '#3A0000',
  );
  expect(screen.queryByRole('group', {name: '프리셋'})).toBeNull();
  fireEvent.keyDown(document.body, {key: 'z', code: 'KeyZ', ctrlKey: true});
  expect(screen.getByRole('spinbutton', {name: '각도'})).toBeDefined();
  fireEvent.click(screen.getByRole('radio', {name: '화면 기본'}));
  await saveEdits();
  expect(value().themes[0]?.screens[MAIN]?.background).toBeUndefined();
});

it('adds sampled stops, drags across neighbors in one undo step, and moves or deletes with keys', async () => {
  const sample = vi
    .spyOn(gradientSampling, 'sampleThemeGradient')
    .mockReturnValue('#004A59');
  const {value} = setup();
  await screen.findByLabelText('테마 캔버스');
  fireEvent.click(screen.getByRole('tab', {name: '화면'}));
  fireEvent.click(screen.getByRole('radio', {name: '그라데이션'}));
  fireEvent.click(screen.getByRole('button', {name: '청록'}));
  const bar = screen.getByRole('group', {name: '그라데이션 색상점'});
  const track = bar.firstElementChild;
  if (track === null) throw new Error('Missing track');
  fireEvent.click(track, {clientX: 480});
  expect(sample).toHaveBeenLastCalledWith(expect.anything(), 50);
  expect(
    screen
      .getByRole('slider', {name: '색 2, 50 %'})
      .getAttribute('aria-current'),
  ).toBe('true');
  expect(screen.getByRole('textbox', {name: '색'}).getAttribute('value')).toBe(
    '#004A59',
  );
  fireEvent.click(track, {clientX: 672});
  fireEvent.click(track, {clientX: 768});
  expect(sample).toHaveBeenCalledTimes(2);
  expect(within(bar).getAllByRole('slider')).toHaveLength(4);
  fireEvent.keyDown(screen.getByRole('slider', {name: '색 3, 70 %'}), {
    key: 'Backspace',
  });
  expect(within(bar).getAllByRole('slider')).toHaveLength(3);
  const handle = screen.getByRole('slider', {name: '색 1, 36 %'});
  fireEvent.pointerDown(handle, {pointerId: 1, button: 0, clientX: 345.6});
  fireEvent.pointerMove(bar, {pointerId: 1, clientX: 576});
  fireEvent.pointerMove(bar, {pointerId: 1, clientX: 768});
  fireEvent.pointerMove(bar, {pointerId: 1, clientX: 921.6});
  expect(screen.getByRole('slider', {name: '색 3, 96 %'})).toBe(
    document.activeElement,
  );
  fireEvent.pointerUp(bar, {pointerId: 1});
  fireEvent.keyDown(document.body, {key: 'z', code: 'KeyZ', ctrlKey: true});
  expect(screen.getByRole('slider', {name: '색 1, 36 %'})).toBeDefined();
  fireEvent.keyDown(document.body, {key: 'y', code: 'KeyY', ctrlKey: true});
  const last = screen.getByRole('slider', {name: '색 3, 96 %'});
  fireEvent.keyDown(last, {key: 'ArrowLeft', shiftKey: true});
  fireEvent.keyDown(screen.getByRole('slider', {name: '색 2, 86 %'}), {
    key: 'ArrowRight',
  });
  expect(screen.getByRole('slider', {name: '색 2, 87 %'})).toBeDefined();
  fireEvent.keyDown(screen.getByRole('slider', {name: '색 2, 87 %'}), {
    key: 'Delete',
  });
  expect(within(bar).getAllByRole('slider')).toHaveLength(2);
  fireEvent.keyDown(within(bar).getAllByRole('slider')[0] ?? bar, {
    key: 'Delete',
  });
  expect(within(bar).getAllByRole('slider')).toHaveLength(2);
  await saveEdits();
  const background = value().themes[0]?.screens[MAIN]?.background;
  expect(background).toMatchObject({
    stops: [
      {color: '#004A59', position: 50},
      {color: '#00667A', position: 87},
    ],
  });
});

it('renders the edited background through a screen link and restores retained elements after empty mode', async () => {
  const {value} = setup();
  await screen.findByLabelText('테마 캔버스');
  const canvas = () => screen.getByLabelText('테마 캔버스');
  await screen.findByRole('button', {name: '현재 가사'});
  fireEvent.click(screen.getByRole('tab', {name: '화면'}));
  fireEvent.click(screen.getByRole('radio', {name: '단색'}));
  const background = screen.getByRole('textbox', {name: '색'});
  background.focus();
  fireEvent.change(background, {target: {value: '#1C355C'}});
  fireEvent.keyDown(background, {key: 'Enter'});
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[MAIN]?.background).toBe('#1C355C');
    expect(canvas().querySelector('svg')?.style.backgroundColor).toBe(
      'rgb(28, 53, 92)',
    );
  });
  const mainElements = value().themes[0]?.screens[MAIN]?.elements;
  const stageElements = value().themes[0]?.screens[STAGE]?.elements;
  expect(mainElements?.length).toBeGreaterThan(0);
  expect(stageElements?.length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  fireEvent.click(screen.getByRole('radio', {name: '청중 화면과 같음'}));
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[STAGE]?.mode).toEqual({
      kind: 'same',
      screen: MAIN,
    });
    expect(canvas().querySelector('svg')?.style.backgroundColor).toBe(
      'rgb(28, 53, 92)',
    );
    expect(canvas().querySelectorAll('[data-canvas-element]')).toHaveLength(
      mainElements?.length ?? 0,
    );
  });
  fireEvent.click(screen.getByRole('radio', {name: '비움'}));
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[STAGE]?.mode).toEqual({kind: 'empty'});
    expect(canvas().querySelectorAll('[data-canvas-element]')).toHaveLength(0);
  });
  fireEvent.click(screen.getByRole('radio', {name: '직접 배치'}));
  await saveEdits();
  await waitFor(() => {
    expect(value().themes[0]?.screens[STAGE]?.mode).toEqual({kind: 'own'});
    expect(value().themes[0]?.screens[STAGE]?.elements).toEqual(stageElements);
    expect(canvas().querySelectorAll('[data-canvas-element]')).toHaveLength(
      stageElements?.length ?? 0,
    );
  });
});

it.each(['single', 'all'] as const)(
  'keeps the remaining %s selection when the row trash removes another element',
  async selection => {
    const {value} = setup();
    await screen.findByRole('button', {name: '현재 가사'});
    const tile = screen.getByRole('button', {name: '시계'});
    tile.focus();
    await userEvent.keyboard('{Enter}');
    await saveEdits();
    await waitFor(() =>
      expect(
        value().themes[0]?.screens[MAIN]?.elements.some(
          element => element.kind === 'clock',
        ),
      ).toBe(true),
    );
    const clock = screen.getByRole('button', {name: '시계'});
    await waitFor(() => expect(document.activeElement).toBe(clock));
    const current = screen.getByRole('button', {name: '현재 가사'});
    fireEvent.click(current);
    if (selection === 'all') {
      fireEvent.keyDown(current, {key: 'a', code: 'KeyA', ctrlKey: true});
    }
    fireEvent.click(screen.getByRole('button', {name: '시계 삭제'}));
    await saveEdits();
    await waitFor(() =>
      expect(
        value().themes[0]?.screens[MAIN]?.elements.some(
          element => element.kind === 'clock',
        ),
      ).toBe(false),
    );
    const list = screen.getByRole('listbox', {name: '요소'});
    expect(
      within(list)
        .getAllByRole('option')
        .filter(row => row.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(selection === 'all' ? 3 : 1);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        selection === 'all' ? screen.getByLabelText('테마 캔버스') : current,
      ),
    );
  },
);

it('shares the aspect-ratio toggle with numeric frame properties and commits multiline fixed text', async () => {
  const {value} = setup();
  await screen.findByRole('button', {name: '현재 가사'});
  fireEvent.click(
    within(screen.getByRole('region', {name: '요소 추가'})).getByRole(
      'button',
      {name: '글자'},
    ),
  );
  const content = await screen.findByRole('textbox', {name: '내용'});
  content.focus();
  fireEvent.change(content, {target: {value: 'First line\nSecond line'}});
  fireEvent.keyDown(content, {key: 'Enter', ctrlKey: true});
  fireEvent.click(screen.getByRole('button', {name: '비율 고정'}));
  const width = screen.getByRole('spinbutton', {name: 'W'});
  fireEvent.change(width, {target: {value: '400'}});
  fireEvent.keyDown(width, {key: 'Enter'});
  await saveEdits();
  await waitFor(() => {
    const element = value().themes[0]?.screens[MAIN]?.elements.find(
      element => element.kind === 'text',
    );
    expect(element?.content).toBe('First line\nSecond line');
    expect(element?.frame).toMatchObject({w: 400, h: 120});
  });
});

it('selects every element and pastes the clipboard into another screen with retained position and appearance', async () => {
  const {value} = setup();
  const canvas = await screen.findByLabelText('테마 캔버스');
  await screen.findByRole('button', {name: '현재 가사'});
  fireEvent.keyDown(canvas, {key: 'a', code: 'KeyA', ctrlKey: true});
  const elements = screen.getByRole('listbox', {name: '요소'});
  expect(
    within(elements)
      .getAllByRole('option')
      .every(row => row.getAttribute('aria-selected') === 'true'),
  ).toBe(true);
  let text = '';
  fireEvent.copy(canvas, {
    clipboardData: {
      setData: (_format: string, value: string) => {
        text = value;
      },
    },
  });
  const source = value().themes[0]?.screens[MAIN]?.elements.find(
    element => element.kind === 'currentText',
  );
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  await act(async () => {
    fireEvent.paste(screen.getByLabelText('테마 캔버스'), {
      clipboardData: {getData: () => text},
    });
  });
  await saveEdits();
  await waitFor(() => {
    const pasted = value().themes[0]?.screens[STAGE]?.elements.find(
      element => element.kind === 'currentText',
    );
    expect(pasted?.frame).toEqual(source?.frame);
    expect(pasted?.text).toEqual(source?.text);
  });
});

it('marks standby as live while the output is idle', async () => {
  setup({idle: true});
  const themes = await screen.findByRole('listbox', {name: '테마'});

  await waitFor(() =>
    expect(
      within(themes).getByRole('option', {name: '대기 화면'}).textContent,
    ).toContain('LIVE'),
  );
  expect(
    within(themes).getByRole('option', {name: '찬양'}).textContent,
  ).not.toContain('LIVE');
});

const EDITED_X = 120;
const SERVICE_ID = '00000000-0000-4000-8000-000000000010';
const itemId = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

function servicesWithSongItems(count: number): Partial<LlpApi['services']> {
  const entries = parseServiceEntries([
    {
      id: SERVICE_ID,
      name: '예배',
      date: '2026-11-01T11:00',
      access: 'editable',
    },
  ]);
  const document = parseServiceDocument({
    revision: 1,
    access: 'editable',
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: '예배',
      date: '2026-11-01T11:00',
      order: Array.from({length: count}, (_, index) => ({
        slides: [],
        id: itemId(index + 100),
        song: itemId(index + 200),
      })),
    },
  });
  if (!entries.ok || !document.ok || !document.value) {
    throw new Error('Invalid invented service');
  }
  const {value} = document;
  return {list: async () => entries.value, get: async () => value};
}

async function editCurrentTextX(x = EDITED_X) {
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  const field = screen.getByRole('spinbutton', {name: 'X'});
  fireEvent.change(field, {target: {value: String(x)}});
  fireEvent.keyDown(field, {key: 'Enter'});
}

const currentTextX = (theme: Theme | undefined) =>
  theme?.screens[MAIN]?.elements.find(element => element.kind === 'currentText')
    ?.frame.x;

const modifiedMark = () =>
  within(screen.getByRole('listbox', {name: '테마'})).queryByRole('img', {
    name: '저장하지 않은 변경',
  });

it('keeps edits in the working copy until 저장 asks before overwriting', async () => {
  const {edit, value} = setup();
  const original = currentTextX(value().themes[0]);
  const saveButton = await screen.findByRole('button', {name: '저장'});
  expect(saveButton.getAttribute('aria-disabled')).toBe('true');
  await editCurrentTextX();
  expect(modifiedMark()).not.toBeNull();
  expect(saveButton.getAttribute('aria-disabled')).not.toBe('true');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(saveButton);
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain('‘찬양’ 테마를 덮어쓸까요?');
  fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(edit).not.toHaveBeenCalled();
  expect(currentTextX(value().themes[0])).toBe(original);
  await saveEdits();
  expect(currentTextX(value().themes[0])).toBe(EDITED_X);
  expect(modifiedMark()).toBeNull();
  expect(saveButton.getAttribute('aria-disabled')).toBe('true');
});

it('undoes and redoes a change of 방식 with Ctrl+Z and Ctrl+Y, and picking the old one back leaves no edit', async () => {
  const {edit} = setup();
  await screen.findByRole('button', {name: '현재 가사'});
  const saveButton = await screen.findByRole('button', {name: '저장'});
  fireEvent.click(screen.getByRole('tab', {name: '화면'}));
  fireEvent.click(screen.getByRole('button', {name: '무대 화면 편집'}));
  const own = screen.getByRole('radio', {name: '직접 배치'});
  expect(own.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', {name: '청중 화면과 같음'}));
  expect(saveButton.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.keyDown(document.body, {key: 'z', code: 'KeyZ', ctrlKey: true});
  await waitFor(() =>
    expect(
      screen
        .getByRole('radio', {name: '직접 배치'})
        .getAttribute('aria-checked'),
    ).toBe('true'),
  );
  expect(saveButton.getAttribute('aria-disabled')).toBe('true');
  fireEvent.keyDown(document.body, {key: 'y', code: 'KeyY', ctrlKey: true});
  await waitFor(() =>
    expect(
      screen
        .getByRole('radio', {name: '청중 화면과 같음'})
        .getAttribute('aria-checked'),
    ).toBe('true'),
  );
  fireEvent.click(screen.getByRole('radio', {name: '직접 배치'}));
  expect(saveButton.getAttribute('aria-disabled')).toBe('true');
  expect(edit).not.toHaveBeenCalled();
});

it('counts the items that use the theme in the overwrite question and hides a zero', async () => {
  const used = setup({services: servicesWithSongItems(2)});
  await editCurrentTextX();
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  const dialog = await screen.findByRole('alertdialog');
  await waitFor(() =>
    expect(dialog.textContent).toContain('쓰는 곳: 예배 순서 항목 2곳'),
  );
  expect(used.edit).not.toHaveBeenCalled();
  cleanup();
  setup({services: servicesWithSongItems(0)});
  await editCurrentTextX();
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  const empty = await screen.findByRole('alertdialog');
  await waitFor(() =>
    expect(empty.textContent).not.toContain('쓰는 곳 확인 중'),
  );
  expect(empty.textContent).not.toContain('곳에서 씀');
});

it('saves the working copy under a new name and leaves the original as it was', async () => {
  const {value} = setup();
  const original = currentTextX(value().themes[0]);
  await editCurrentTextX();
  fireEvent.click(screen.getByRole('button', {name: '다른 이름으로 저장…'}));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('textbox')).toHaveProperty(
    'value',
    '찬양 복사본',
  );
  fireEvent.click(within(dialog).getByRole('button', {name: '저장'}));
  await waitFor(() =>
    expect(value().themes).toHaveLength(
      createDefaultThemes().themes.length + 1,
    ),
  );
  const copy = value().themes.at(-1);
  expect(copy?.name).toBe('찬양 복사본');
  expect(currentTextX(copy)).toBe(EDITED_X);
  expect(currentTextX(value().themes[0])).toBe(original);
  expect(
    (await screen.findByRole('option', {name: '찬양 복사본'})).getAttribute(
      'aria-selected',
    ),
  ).toBe('true');
  expect(modifiedMark()).toBeNull();
});

it('asks 저장, 저장 안 함, or 취소 before another theme replaces the edits', async () => {
  const {edit, value} = setup();
  const original = currentTextX(value().themes[0]);
  await editCurrentTextX();
  const other = await screen.findByRole('option', {name: '말씀'});
  fireEvent.click(other);
  let dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain('‘찬양’ 테마의 변경을 저장할까요?');
  fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(
    screen.getByRole('option', {name: '찬양'}).getAttribute('aria-selected'),
  ).toBe('true');
  expect(modifiedMark()).not.toBeNull();
  fireEvent.click(other);
  dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '저장 안 함'}));
  await waitFor(() => expect(other.getAttribute('aria-selected')).toBe('true'));
  expect(edit).not.toHaveBeenCalled();
  expect(modifiedMark()).toBeNull();
  fireEvent.click(screen.getByRole('option', {name: '찬양'}));
  await waitFor(() => expect(currentTextX(value().themes[0])).toBe(original));
  await editCurrentTextX();
  fireEvent.click(other);
  dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '저장'}));
  await waitFor(() => expect(currentTextX(value().themes[0])).toBe(EDITED_X));
  await waitFor(() => expect(other.getAttribute('aria-selected')).toBe('true'));
});

it('asks 저장, 저장 안 함, or 취소 when the window closes with unsaved edits', async () => {
  const {edit, value} = setup();
  const api = window.llp;
  if (api === undefined) throw new Error('Expected the window API');
  const writes = pendingWritesOf(api);
  await expect(writes.settleDrafts()).resolves.toBe('settled');
  await editCurrentTextX();
  const answer = async (name: string) => {
    const settling = writes.settleDrafts();
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', {name}));
    return settling;
  };
  await expect(answer('취소')).resolves.toBe('canceled');
  expect(modifiedMark()).not.toBeNull();
  expect(edit).not.toHaveBeenCalled();
  await expect(answer('저장')).resolves.toBe('settled');
  expect(currentTextX(value().themes[0])).toBe(EDITED_X);
  await editCurrentTextX(EDITED_X + 10);
  await expect(answer('저장 안 함')).resolves.toBe('settled');
  expect(modifiedMark()).toBeNull();
});

it('saves a copy from a theme with no edits', async () => {
  const {value} = setup();
  const original = currentTextX(value().themes[0]);
  fireEvent.click(
    await screen.findByRole('button', {name: '다른 이름으로 저장…'}),
  );
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '저장'}));
  await waitFor(() =>
    expect(value().themes).toHaveLength(
      createDefaultThemes().themes.length + 1,
    ),
  );
  expect(currentTextX(value().themes.at(-1))).toBe(original);
  expect(value().themes.at(-1)?.name).toBe('찬양 복사본');
});

it('lets the shell leave at once with no edits and asks first with unsaved edits', async () => {
  const {edit, guard} = setup();
  const proceed = vi.fn();
  await screen.findByRole('button', {name: '현재 가사'});
  act(() => guard.leave(proceed));
  expect(proceed).toHaveBeenCalledTimes(1);
  await editCurrentTextX();
  act(() => guard.leave(proceed));
  expect(proceed).toHaveBeenCalledTimes(1);
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(proceed).toHaveBeenCalledTimes(1);
  act(() => guard.leave(proceed));
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: '저장 안 함',
    }),
  );
  expect(proceed).toHaveBeenCalledTimes(2);
  expect(edit).not.toHaveBeenCalled();
  expect(modifiedMark()).toBeNull();
});

it('shows, selects and edits the clock and timer of an older 대기 화면 without a 무대 화면 layout', async () => {
  const {value} = setup({oldStandby: true});
  const themes = await screen.findByRole('listbox', {name: '테마'});
  fireEvent.click(
    await within(themes).findByRole('option', {name: '대기 화면'}),
  );
  fireEvent.click(await screen.findByRole('button', {name: '무대 화면 편집'}));

  const list = await screen.findByRole('listbox', {name: '요소'});
  await waitFor(() =>
    expect(
      within(list)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(expect.arrayContaining(['시계', '타이머'])),
  );
  fireEvent.click(within(list).getByRole('option', {name: '시계'}));
  const field = await screen.findByRole('spinbutton', {name: 'X'});
  fireEvent.change(field, {target: {value: String(EDITED_X)}});
  fireEvent.keyDown(field, {key: 'Enter'});
  await saveEdits();
  await waitFor(() => {
    const layout = value().standby.screens[STAGE];
    expect(layout?.mode).toEqual({kind: 'own'});
    expect(
      layout?.elements.find(element => element.kind === 'clock')?.frame.x,
    ).toBe(EDITED_X);
    expect(layout?.elements.map(element => element.kind)).toEqual([
      'clock',
      'timer',
    ]);
  });
});
