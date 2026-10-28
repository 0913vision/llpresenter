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
import {emptyLiveState} from '@shared/live';
import type {EditResult} from '@shared/schema/contentEdit';
import * as v from 'valibot';
import {screenIdSchema} from '@shared/schema/ids';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {DEFAULT_MESSAGE_STYLE} from '@shared/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {useLive} from '@renderer/state/live';
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
  settingsDocument,
  stageLayoutsDocument,
} from '../testing/documents';
import {LookEditor} from './LookEditor';

const mainId = v.parse(screenIdSchema, MAIN_ID);
const stageId = v.parse(screenIdSchema, STAGE_ID);
const captionsId = v.parse(screenIdSchema, CAPTIONS_ID);

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

function setup(readOnly = false, beforeSave = () => Promise.resolve()) {
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
  const api = fakeLlpApi({
    live: {send},
    settings: {
      get: request => {
        if (request.name === 'looks') return Promise.resolve(document);
        if (request.name === 'screens') {
          return Promise.resolve(screensDocument());
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
