import {settingsDocument} from '@core/testing/settingsDocument';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {EditResult} from '@core/schema/contentEdit';
import * as v from 'valibot';
import {screenIdSchema} from '@core/schema/ids';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {useLive} from '@renderer/session/live';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import {useScreensSelection} from '../selection';
import {
  CAPTIONS_ID,
  LOOK_ID,
  MAIN_ID,
  STAGE_ID,
  SERMON_LOOK_ID,
  looksDocument,
  screensDocument,
  stageLayoutsDocument,
} from '@core/testing/screenDocuments';
import {LookEditor} from './LookEditor';

const mainId = v.parse(screenIdSchema, MAIN_ID);
const stageId = v.parse(screenIdSchema, STAGE_ID);
const captionsId = v.parse(screenIdSchema, CAPTIONS_ID);

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

function setup(
  readOnly = false,
  beforeSave = () => Promise.resolve(),
  screens = screensDocument(),
) {
  const initial = looksDocument();
  if (initial.name !== 'looks') throw new Error('Wrong document');
  let document: SettingsDocument = {
    ...settingsDocument('looks', {
      ...initial.value,
      lyricStyles: [
        {
          ...DEFAULT_LYRIC_STYLE,
          id: '00000000-0000-4000-8000-0000000000d1',
          name: '큰 글씨',
        },
      ],
    }),
    access: readOnly ? 'readOnly' : 'editable',
  };
  const listeners = new Set<(next: SettingsDocument) => void>();
  const send = vi.fn();
  const edit = vi.fn(async (change: SettingsEdit) => {
    if (change.type !== 'settings.update' || change.name !== 'looks') {
      throw new Error('Unexpected edit');
    }
    await beforeSave();
    document = settingsDocument('looks', change.value, document.revision + 1);
    for (const listener of listeners) listener(document);
    return {
      ok: true,
      value: {id: 'looks', revision: document.revision},
    } as const;
  });
  const api = mockLlpApi({
    live: {send},
    settings: {
      get: request => {
        if (request.name === 'looks') return Promise.resolve(document);
        if (request.name === 'screens') {
          return Promise.resolve(screens);
        }
        if (request.name === 'stage-layouts') {
          return Promise.resolve(stageLayoutsDocument());
        }
        if (request.name === 'timers') {
          return Promise.resolve(settingsDocument('timers', {timers: []}));
        }
        return Promise.reject(new Error(`Unexpected read: ${request.name}`));
      },
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  window.llp = api;
  const onProblem = vi.fn();
  const view = render(<LookEditor onProblem={onProblem} />);
  return {
    view,
    api,
    edit,
    send,
    onProblem,
    document: () => document,
    user: userEvent.setup(),
  };
}

beforeEach(() => {
  useScreensSelection.setState({selection: {kind: 'look', id: LOOK_ID}});
  useLive.setState({state: emptyLiveState()});
  document.documentElement.style.setProperty('--chroma', '#00b140');
  document.documentElement.style.setProperty('--output-black', '#000000');
});

afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
  document.documentElement.style.removeProperty('--chroma');
  document.documentElement.style.removeProperty('--output-black');
  resetTooltips();
  vi.unstubAllGlobals();
});

it('bounds mounted screen cards for a large configured screen list', async () => {
  const observers: Array<{
    targets: Set<Element>;
    notify: (target: Element, visible: boolean) => void;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      readonly root = null;
      readonly rootMargin = '';
      readonly scrollMargin = '';
      readonly thresholds: readonly number[] = [];
      private readonly targets = new Set<Element>();
      readonly disconnect = vi.fn(() => this.targets.clear());
      constructor(callback: IntersectionObserverCallback) {
        observers.push({
          targets: this.targets,
          disconnect: this.disconnect,
          notify: (target, isIntersecting) =>
            callback(
              [
                {
                  target,
                  isIntersecting,
                  time: 0,
                  boundingClientRect: new DOMRectReadOnly(),
                  intersectionRect: new DOMRectReadOnly(),
                  rootBounds: null,
                  intersectionRatio: isIntersecting ? 1 : 0,
                },
              ],
              this,
            ),
        });
      }
      observe(target: Element): void {
        this.targets.add(target);
      }
      unobserve(target: Element): void {
        this.targets.delete(target);
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    },
  );
  const screens = settingsDocument('screens', {
    screens: Array.from({length: 200}, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `검사 화면 ${index + 1}`,
      kind: 'audience',
      method: 'window',
    })),
  });
  const {view} = setup(false, () => Promise.resolve(), screens);
  await screen.findByRole('region', {name: '검사 화면 1'});
  expect(
    screen.getAllByRole('region', {name: /^검사 화면/}).length,
  ).toBeLessThan(30);
  const shared = observers.find(observer => observer.targets.size === 200);
  if (shared === undefined) throw new Error('Missing shared observer');
  const sentinel = screen.getByRole('button', {
    name: '검사 화면 200 설정 열기',
  });
  const slot = sentinel.closest('[data-look-card-slot]');
  if (slot === null) throw new Error('Missing card slot');
  act(() => shared.notify(slot, true));
  const last = await screen.findByRole('region', {name: '검사 화면 200'});
  expect(within(last).getByRole('checkbox', {name: '가사'})).toBeDefined();
  act(() => shared.notify(slot, false));
  await waitFor(() =>
    expect(screen.queryByRole('region', {name: '검사 화면 200'})).toBeNull(),
  );
  const keyboard = screen.getByRole('button', {
    name: '검사 화면 200 설정 열기',
  });
  act(() => keyboard.focus());
  await waitFor(() =>
    expect(
      within(screen.getByRole('region', {name: '검사 화면 200'})).getByRole(
        'checkbox',
        {name: '배경 미디어'},
      ),
    ).toBe(document.activeElement),
  );
  const following = document.createElement('button');
  document.body.append(following);
  act(() => following.focus());
  await waitFor(() =>
    expect(screen.queryByRole('region', {name: '검사 화면 200'})).toBeNull(),
  );
  act(() =>
    screen.getByRole('button', {name: '검사 화면 200 설정 열기'}).focus(),
  );
  await waitFor(() =>
    expect(
      within(screen.getByRole('region', {name: '검사 화면 200'})).getByRole(
        'button',
        {name: '검사 화면 200 메시지 스타일 추가'},
      ),
    ).toBe(document.activeElement),
  );
  following.remove();
  view.unmount();
  expect(shared.disconnect).toHaveBeenCalled();
});

it('shows screen-specific layers and saves independent switches in the selected Look', async () => {
  const {user, document, send} = setup();
  const main = within(await screen.findByRole('region', {name: '본 화면'}));
  const stage = within(screen.getByRole('region', {name: '무대 화면'}));
  expect(main.queryByRole('checkbox', {name: '시계'})).toBeNull();
  expect(stage.getByRole('checkbox', {name: '시계'})).toBeDefined();
  expect(stage.getByRole('checkbox', {name: '무대 메시지'})).toBeDefined();
  expect(stage.queryByRole('checkbox', {name: '공지'})).toBeNull();
  await user.click(main.getByRole('checkbox', {name: '배경 미디어'}));
  await user.click(main.getByRole('checkbox', {name: '가사'}));
  await waitFor(() => {
    const saved = document();
    if (saved.name !== 'looks') throw new Error('Wrong document');
    expect(saved.value.looks[0]?.screens[mainId]?.layers).toMatchObject({
      media: false,
      slide: false,
      message: true,
    });
  });
  expect(send).not.toHaveBeenCalled();
});

it('stores a shared lyric style, stage layout and caption background choice', async () => {
  const {user, document} = setup();
  await user.click(
    await screen.findByRole('button', {name: '본 화면 가사 스타일'}),
  );
  await user.click(screen.getByRole('menuitemradio', {name: '큰 글씨'}));
  await user.click(screen.getByRole('button', {name: '무대 화면 무대 배치'}));
  await user.click(screen.getByRole('menuitemradio', {name: '하단 자막'}));
  await user.click(screen.getByRole('button', {name: '방송 자막 배경색'}));
  await user.click(screen.getByRole('menuitemradio', {name: '검정'}));
  await waitFor(() => {
    const saved = document();
    if (saved.name !== 'looks') throw new Error('Wrong document');
    expect(saved.value.looks[0]?.screens[mainId]?.lyricStyle).toBe(
      saved.value.lyricStyles[0]?.id,
    );
    expect(saved.value.looks[0]?.screens[stageId]?.stageLayout).toBe(
      '00000000-0000-4000-8000-0000000000b2',
    );
    expect(saved.value.looks[0]?.screens[captionsId]?.background).toMatchObject(
      {kind: 'color', color: '#000000'},
    );
    expect(saved.value.looks[1]?.screens[stageId]?.stageLayout).toBe(
      '00000000-0000-4000-8000-0000000000b2',
    );
  });
});

it('can return shared style and stage layout assignments to their default values', async () => {
  const {user, document} = setup();
  await user.click(
    await screen.findByRole('button', {name: '본 화면 가사 스타일'}),
  );
  await user.click(screen.getByRole('menuitemradio', {name: '큰 글씨'}));
  await user.click(screen.getByRole('button', {name: '본 화면 가사 스타일'}));
  await user.click(screen.getByRole('menuitemradio', {name: '기본값'}));
  await user.click(screen.getByRole('button', {name: '무대 화면 무대 배치'}));
  await user.click(screen.getByRole('menuitemradio', {name: '없음'}));
  const saved = document();
  if (saved.name !== 'looks') throw new Error('Wrong document');
  expect(saved.value.looks[0]?.screens[mainId]).not.toHaveProperty(
    'lyricStyle',
  );
  expect(saved.value.looks[0]?.screens[stageId]).not.toHaveProperty(
    'stageLayout',
  );
});

it.each(['selection', 'unmount'])(
  'keeps a later navigation while a header copy waits: %s',
  async navigation => {
    const {user, api, view} = setup();
    let release: (value: EditResult) => void = () => undefined;
    const held = new Promise<EditResult>(resolve => {
      release = resolve;
    });
    const edit = vi
      .spyOn(api.settings, 'edit')
      .mockImplementationOnce(() => held);
    await screen.findByRole('textbox', {name: 'Look 이름'});
    await user.click(screen.getByRole('button', {name: '복제'}));
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    if (navigation === 'unmount') view.unmount();
    else {
      act(() => useScreensSelection.getState().select('look', SERMON_LOOK_ID));
    }
    const previous = useScreensSelection.getState().selection;
    await act(async () => {
      release({ok: true, value: {id: 'looks', revision: 2}});
      await held;
    });
    expect(useScreensSelection.getState().selection).toBe(previous);
  },
);

it('cancels a header name with Escape and commits its valid focused draft before close flush', async () => {
  const {user, api, edit} = setup();
  const field = await screen.findByRole('textbox', {name: 'Look 이름'});
  await user.clear(field);
  await user.type(field, '취소할 이름{Escape}');
  expect(edit).not.toHaveBeenCalled();
  expect(field.getAttribute('value')).toBe('평상시');
  await user.clear(field);
  await user.type(field, '새 이름');
  act(() => field.blur());
  await act(async () => {
    expect(await pendingWritesOf(api).flush()).toBe(true);
  });
  expect(edit).toHaveBeenCalledOnce();
  expect(field.getAttribute('value')).toBe('새 이름');
});

it('saves a queued reversion to the displayed Look name after a held rename', async () => {
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const {user, edit, document: saved} = setup(false, () => held);
  const field = await screen.findByRole('textbox', {name: 'Look 이름'});
  await user.clear(field);
  await user.type(field, '임시 Look{Enter}');
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  await user.clear(field);
  await user.type(field, '평상시{Enter}');
  expect(edit).toHaveBeenCalledTimes(1);
  release();
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  await waitFor(() => {
    const document = saved();
    if (document.name !== 'looks') throw new Error('Wrong document');
    expect(document.value.looks[0]?.name).toBe('평상시');
  });
});

it('does not save a name that remains unchanged', async () => {
  const {user, edit} = setup();
  const field = await screen.findByRole('textbox', {name: 'Look 이름'});
  await user.clear(field);
  await user.type(field, '평상시{Enter}');
  await act(async () => {
    await Promise.resolve();
  });
  expect(edit).not.toHaveBeenCalled();
});

it('duplicates from the center header and selects the copy without changing live output', async () => {
  const {user, send, document} = setup();
  await screen.findByRole('textbox', {name: 'Look 이름'});
  await user.click(screen.getByRole('button', {name: '복제'}));
  await waitFor(() =>
    expect(useScreensSelection.getState().selection.id).not.toBe(LOOK_ID),
  );
  expect(document().value).toHaveProperty('current', LOOK_ID);
  expect(send).not.toHaveBeenCalled();
  expect(
    screen.getByRole('textbox', {name: 'Look 이름'}).getAttribute('value'),
  ).toBe('평상시 복사본');
});

it('sends no edit from read-only name, duplicate, layer or style controls', async () => {
  const {user, edit} = setup(true);
  const field = await screen.findByRole('textbox', {name: 'Look 이름'});
  expect(field.getAttribute('readonly')).not.toBeNull();
  await user.type(field, '변경{Enter}');
  for (const button of screen.getAllByRole('button')) {
    if (
      button.getAttribute('aria-label')?.endsWith(' \uc124\uc815 \uc5f4\uae30')
    ) {
      continue;
    }
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await user.click(button);
  }
  for (const checkbox of screen.getAllByRole('checkbox')) {
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(checkbox);
  }
  expect(edit).not.toHaveBeenCalled();
});

it('keeps a Look name draft on modified Enter and Escape', async () => {
  const {edit} = setup();
  const field = await screen.findByRole('textbox', {name: 'Look \uC774\uB984'});
  field.focus();
  fireEvent.change(field, {target: {value: 'Revised Look'}});
  fireEvent.keyDown(field, {key: 'Enter', ctrlKey: true});
  fireEvent.keyDown(field, {key: 'Escape', shiftKey: true});
  expect(document.activeElement).toBe(field);
  expect(field).toHaveProperty('value', 'Revised Look');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.keyDown(field, {key: 'Enter'});
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
});

it('creates and assigns a message style only to the chosen screen', async () => {
  const {user, document} = setup();
  const card = within(
    await screen.findByRole('region', {name: '\ubcf8 \ud654\uba74'}),
  );
  await user.click(
    card.getByRole('button', {
      name: '\ubcf8 \ud654\uba74 \uba54\uc2dc\uc9c0 \uc2a4\ud0c0\uc77c \ucd94\uac00',
    }),
  );
  await waitFor(() => {
    const saved = document();
    if (saved.name !== 'looks') throw new Error('Wrong fixture');
    const id = saved.value.messageStyles?.[0]?.id;
    expect(id).toBeDefined();
    expect(saved.value.looks[0]?.screens[mainId]?.messageStyle).toBe(id);
    expect(
      saved.value.looks[0]?.screens[captionsId]?.messageStyle,
    ).toBeUndefined();
  });
});

it('reports a meaningful error when generating a message style id fails', async () => {
  const random = vi
    .spyOn(crypto, 'randomUUID')
    .mockReturnValue('bad-bad-bad-bad-bad');
  const {user, onProblem} = setup();
  const card = within(await screen.findByRole('region', {name: '본 화면'}));
  await user.click(
    card.getByRole('button', {name: '본 화면 메시지 스타일 추가'}),
  );
  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({title: '메시지 스타일 추가 실패'}),
  );
  random.mockRestore();
});

it('saves a screen message style property through the shared queue', async () => {
  const {user, document} = setup();
  const card = within(
    await screen.findByRole('region', {name: '\ubcf8 \ud654\uba74'}),
  );
  await user.click(
    card.getByRole('button', {
      name: '\ubcf8 \ud654\uba74 \uba54\uc2dc\uc9c0 \uc2a4\ud0c0\uc77c \ucd94\uac00',
    }),
  );
  const size = await card.findByRole('spinbutton', {name: '\ud06c\uae30'});
  await user.clear(size);
  await user.type(size, '120{Enter}');
  await waitFor(() => {
    const saved = document();
    if (saved.name !== 'looks') throw new Error('Wrong fixture');
    expect(saved.value.messageStyles?.[0]?.size).toBe(120);
  });
});

it('saves a numeric reversion queued behind a held message style save', async () => {
  let release = (): void => undefined;
  let hold = false;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const {user, edit, document} = setup(false, () =>
    hold ? held : Promise.resolve(),
  );
  const card = within(await screen.findByRole('region', {name: '본 화면'}));
  await user.click(
    card.getByRole('button', {name: '본 화면 메시지 스타일 추가'}),
  );
  const size = await card.findByRole('spinbutton', {name: '크기'});
  hold = true;
  await user.clear(size);
  await user.type(size, '120{Enter}');
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  await user.clear(size);
  await user.type(size, '84{Enter}');
  release();
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(3));
  await waitFor(() => {
    const saved = document();
    if (saved.name !== 'looks') throw new Error('Wrong fixture');
    expect(saved.value.messageStyles?.[0]?.size).toBe(84);
  });
});

it('saves queued lyric effects against the latest Looks document', async () => {
  let release = (): void => undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const {user, edit, document} = setup(false, () => held);
  const outline = await screen.findByRole('switch', {
    name: '\uc678\uacfd\uc120',
  });
  await user.click(outline);
  await user.click(
    screen.getByRole('button', {name: '\ucd9c\ucc98 \uc704\uce58'}),
  );
  await user.click(screen.getByRole('menuitemradio', {name: '\uc228\uae40'}));
  expect(edit).toHaveBeenCalledTimes(1);
  release();
  await waitFor(() => {
    const saved = document();
    if (saved.name !== 'looks') throw new Error('Wrong document');
    expect(saved.value.lyricStyles[0]?.outline.on).toBe(true);
    expect(saved.value.lyricStyles[0]?.referencePosition).toBe('hidden');
  });
  expect(edit).toHaveBeenCalledTimes(2);
});

it('saves a lyric outline width reversion queued behind a held save', async () => {
  let release = (): void => undefined;
  let hold = false;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const {user, edit, document} = setup(false, () =>
    hold ? held : Promise.resolve(),
  );
  const outline = await screen.findByRole('switch', {name: '외곽선'});
  await user.click(outline);
  const width = await screen.findByRole('spinbutton', {name: '외곽선 두께'});
  await waitFor(() => expect(width).toHaveProperty('readOnly', false));
  hold = true;
  await user.clear(width);
  await user.type(width, '6{Enter}');
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  await user.clear(width);
  await user.type(width, '3{Enter}');
  release();
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(3));
  await waitFor(() => {
    const saved = document();
    if (saved.name !== 'looks') throw new Error('Wrong document');
    expect(saved.value.lyricStyles[0]?.outline.width).toBe(3);
  });
});
