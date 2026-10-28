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
import {afterEach, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import type {StageElement} from '@shared/schema/stageLayouts';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {settingsDocument, LAYOUT_ID} from '../testing/documents';
import {useScreensSelection} from '../selection';
import {StageProperties} from './StageProperties';
import {STAGE_DEFAULT_TEXT} from './stageEditor';

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});
function setup(
  access: 'editable' | 'readOnly' = 'editable',
  saving: Promise<void> = Promise.resolve(),
  kind: StageElement['kind'] = 'currentSlide',
) {
  const make = (value: object, revision = 1) => {
    const document = settingsDocument('stage-layouts', value, revision);
    if (document.name !== 'stage-layouts') {
      throw new Error('Expected stage settings');
    }
    return {...document, access};
  };
  let current = make({
    format: 'llsettings.stage',
    layouts: [
      {
        id: LAYOUT_ID,
        name: 'Test layout',
        width: 1920,
        height: 1080,
        elements: [
          {
            id: 'first',
            name: 'First',
            kind,
            frame: {x: 0, y: 0, w: 500, h: 100},
            text: {...STAGE_DEFAULT_TEXT, future: 'keep'},
            box: {background: '#112233', opacity: 0.375, future: 'keep'},
          },
          {
            id: 'second',
            name: 'Second',
            kind: 'nextSlide',
            frame: {x: 0, y: 200, w: 500, h: 100},
          },
        ],
      },
    ],
  });
  const listeners = new Set<(document: SettingsDocument) => void>();
  const edit = vi.fn(
    async (
      change: Parameters<NonNullable<Window['llp']>['settings']['edit']>[0],
    ) => {
      if (
        change.type !== 'settings.update' ||
        change.name !== 'stage-layouts'
      ) {
        throw new Error('Unexpected change');
      }
      await saving;
      current = make(change.value, current.revision + 1);
      for (const listener of listeners) listener(current);
      return {
        ok: true as const,
        value: {id: 'stage-layouts', revision: current.revision},
      };
    },
  );
  window.llp = fakeLlpApi({
    settings: {
      get: () => Promise.resolve(current),
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  useScreensSelection.getState().select('stage', LAYOUT_ID);
  useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'first');
  const view = render(<StageProperties />);
  const first = () => current.value.layouts[0]?.elements[0];
  return {view, first, edit, listeners};
}

it('saves text controls on the selected element and preserves unknown style fields', async () => {
  const {first, listeners, view} = setup();
  const user = userEvent.setup();
  const name = await screen.findByRole('textbox', {name: '이름'});
  await user.clear(name);
  await user.type(name, 'Renamed');
  await user.tab();
  await waitFor(() => expect(first()?.name).toBe('Renamed'));
  await user.click(screen.getByRole('button', {name: '글꼴'}));
  await user.click(await screen.findByRole('menuitemradio', {name: 'Arial'}));
  const size = screen.getByRole('spinbutton', {name: '크기'});
  fireEvent.change(size, {target: {value: '100'}});
  fireEvent.blur(size);
  await user.click(
    within(screen.getByRole('radiogroup', {name: '가로 정렬'})).getByRole(
      'radio',
      {name: '가운데'},
    ),
  );
  await user.click(screen.getByRole('switch', {name: '크기 자동 맞춤'}));
  await waitFor(() =>
    expect(first()?.text).toMatchObject({
      font: 'Arial',
      size: 100,
      align: 'center',
      autoFit: false,
      future: 'keep',
    }),
  );
  act(() =>
    useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'second'),
  );
  expect(
    screen.getByRole('textbox', {name: '이름'}).getAttribute('value'),
  ).toBe('Second');
  view.unmount();
  expect(listeners.size).toBe(0);
});

it('defaults clocks to 24-hour time and retains the saved format across selections and kinds', async () => {
  const {first} = setup('editable', Promise.resolve(), 'clock');
  const user = userEvent.setup();
  const group = await screen.findByRole('radiogroup', {name: '시계 형식'});
  expect(
    within(group)
      .getByRole('radio', {name: '24시간'})
      .getAttribute('aria-checked'),
  ).toBe('true');
  await user.click(within(group).getByRole('radio', {name: '12시간'}));
  await waitFor(() => expect(first()?.clockFormat).toBe('12h'));
  expect(first()).toMatchObject({
    frame: {w: 500},
    box: {future: 'keep'},
    text: {future: 'keep'},
  });
  act(() =>
    useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'second'),
  );
  expect(screen.queryByRole('radiogroup', {name: '시계 형식'})).toBeNull();
  act(() =>
    useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'first'),
  );
  expect(
    screen.getByRole('radio', {name: '12시간'}).getAttribute('aria-checked'),
  ).toBe('true');
  await user.click(screen.getByRole('button', {name: '내용 종류'}));
  await user.click(
    await screen.findByRole('menuitemradio', {name: '현재 가사'}),
  );
  await waitFor(() =>
    expect(screen.queryByRole('radiogroup', {name: '시계 형식'})).toBeNull(),
  );
  expect(first()?.clockFormat).toBe('12h');
  await user.click(screen.getByRole('button', {name: '내용 종류'}));
  await user.click(await screen.findByRole('menuitemradio', {name: '시계'}));
  await waitFor(() =>
    expect(
      screen.getByRole('radio', {name: '12시간'}).getAttribute('aria-checked'),
    ).toBe('true'),
  );
});

it('disables clock format changes in read-only settings', async () => {
  const {edit} = setup('readOnly', Promise.resolve(), 'clock');
  const group = await screen.findByRole('radiogroup', {name: '시계 형식'});
  const twelve = within(group).getByRole('radio', {name: '12시간'});
  expect(twelve.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(twelve);
  expect(edit).not.toHaveBeenCalled();
});

it('refuses malformed colors, cancels a draft with Escape, and deletes the selection', async () => {
  const {first, edit} = setup();
  const color = await screen.findByRole('textbox', {name: '글자색'});
  fireEvent.change(color, {target: {value: 'invalid'}});
  expect(color.getAttribute('aria-invalid')).toBe('true');
  fireEvent.blur(color);
  expect(edit).not.toHaveBeenCalled();
  expect(first()?.text?.color).toBe('#FFFFFF');
  const name = screen.getByRole('textbox', {name: '이름'});
  fireEvent.change(name, {target: {value: 'Discard'}});
  fireEvent.keyDown(name, {key: 'Escape'});
  fireEvent.blur(name);
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '요소 삭제'}));
  await waitFor(() =>
    expect(useScreensSelection.getState().stageElement).toBeNull(),
  );
  expect(first()?.id).toBe('second');
});

it('chooses colors, preserves other fields, and cancels a picker draft', async () => {
  const {first, edit} = setup();
  const user = userEvent.setup();
  const field = await screen.findByRole('textbox', {name: '글자색'});
  await user.clear(field);
  await user.type(field, '#123456');
  await user.click(screen.getByRole('button', {name: '글자색 선택'}));
  let dialog = screen.getByRole('dialog', {name: '글자색 선택'});
  expect(within(dialog).getByText('#123456')).toBeTruthy();
  fireEvent.change(within(dialog).getByRole('slider', {name: '빨강'}), {
    target: {value: '255'},
  });
  expect(within(dialog).getByText('#FF3456')).toBeTruthy();
  await user.click(within(dialog).getByRole('button', {name: '적용'}));
  await waitFor(() => expect(first()?.text?.color).toBe('#FF3456'));
  expect(first()?.text).toMatchObject({future: 'keep'});
  const saved = edit.mock.calls.length;
  await user.click(screen.getByRole('button', {name: '글자색 선택'}));
  dialog = screen.getByRole('dialog', {name: '글자색 선택'});
  fireEvent.change(within(dialog).getByRole('slider', {name: '파랑'}), {
    target: {value: '0'},
  });
  await user.click(within(dialog).getByRole('button', {name: '취소'}));
  expect(edit).toHaveBeenCalledTimes(saved);
  expect(first()?.text?.color).toBe('#FF3456');

  await user.click(screen.getByRole('tab', {name: '모양'}));
  await user.click(screen.getByRole('button', {name: '배경색 선택'}));
  dialog = screen.getByRole('dialog', {name: '배경색 선택'});
  await user.click(within(dialog).getByRole('button', {name: '없음'}));
  await waitFor(() => expect(first()?.box?.background).toBeUndefined());
  expect(first()?.box).toMatchObject({opacity: 0.375, future: 'keep'});
});

it('disables color selection for read-only layouts', async () => {
  setup('readOnly');
  expect(
    await screen.findByRole('button', {name: '글자색 선택'}),
  ).toHaveProperty('disabled', true);
});

it('applies the original color after a pending hex edit', async () => {
  let release = () => {};
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {first, edit} = setup('editable', saving);
  const user = userEvent.setup();
  const field = await screen.findByRole('textbox', {name: '글자색'});
  await user.clear(field);
  await user.type(field, '#123456');
  await user.click(screen.getByRole('button', {name: '글자색 선택'}));
  const dialog = screen.getByRole('dialog', {name: '글자색 선택'});
  for (const name of ['빨강', '초록', '파랑']) {
    fireEvent.change(within(dialog).getByRole('slider', {name}), {
      target: {value: '255'},
    });
  }
  await user.click(within(dialog).getByRole('button', {name: '적용'}));
  release();
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(first()?.text?.color).toBe('#FFFFFF'));
  await waitFor(() =>
    expect(screen.getByRole('textbox', {name: '글자색'})).toHaveProperty(
      'value',
      '#FFFFFF',
    ),
  );
});

it('displays and preserves the renderer fallback when editing an element without text', async () => {
  const {edit} = setup();
  act(() =>
    useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'second'),
  );
  const size = await screen.findByRole('spinbutton', {name: '크기'});
  expect(size.getAttribute('aria-valuenow')).toBe('84');
  expect(
    screen
      .getByRole('spinbutton', {name: '줄 간격'})
      .getAttribute('aria-valuenow'),
  ).toBe('1.4');
  const color = screen.getByRole('textbox', {name: '글자색'});
  fireEvent.change(color, {target: {value: '#00FF00'}});
  fireEvent.blur(color);
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const change = edit.mock.calls[0]?.[0];
  if (change?.name !== 'stage-layouts') {
    throw new Error('Expected stage edit');
  }
  expect(change.value.layouts[0]?.elements[1]?.text).toMatchObject({
    size: 84,
    lineHeight: 1.4,
    align: 'center',
    vAlign: 'middle',
    color: '#00FF00',
    autoFit: true,
  });
});

it('keeps a future-version settings document read-only', async () => {
  const {edit} = setup('readOnly');
  const name = await screen.findByRole('textbox', {name: '이름'});
  expect(name.hasAttribute('readonly')).toBe(true);
  fireEvent.click(screen.getByRole('switch', {name: '크기 자동 맞춤'}));
  fireEvent.click(screen.getByRole('button', {name: '요소 삭제'}));
  expect(edit).not.toHaveBeenCalled();
});

it('commits a directly entered font and leaves IME Enter and Escape unsaved', async () => {
  const {first, edit} = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', {name: '글꼴'}));
  await user.click(await screen.findByRole('menuitem', {name: '다른 글꼴'}));
  const input = await screen.findByRole('textbox', {name: '글꼴'});
  fireEvent.change(input, {target: {value: 'Custom font'}});
  fireEvent.keyDown(input, {key: 'Enter', isComposing: true});
  expect(edit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, {key: 'Escape'});
  expect(edit).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', {name: '글꼴'}));
  await user.click(await screen.findByRole('menuitem', {name: '다른 글꼴'}));
  const field = await screen.findByRole('textbox', {name: '글꼴'});
  fireEvent.change(field, {target: {value: 'Custom font'}});
  field.focus();
  fireEvent.keyDown(field, {key: 'Enter'});
  await waitFor(() => expect(first()?.text?.font).toBe('Custom font'));
});

it('does not clear a new selection when an earlier deletion completes', async () => {
  let release: () => void = () => undefined;
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {edit} = setup('editable', saving);
  fireEvent.click(await screen.findByRole('button', {name: '요소 삭제'}));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  act(() =>
    useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'second'),
  );
  release();
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', {name: '이름'}).getAttribute('value'),
    ).toBe('Second'),
  );
  expect(useScreensSelection.getState().stageElement?.elementId).toBe('second');
});

it('edits the box fill independently from text and preserves opacity when removing it', async () => {
  const {first, edit} = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', {name: '모양'}));
  const color = screen.getByRole('textbox', {name: '배경색'});
  const opacity = screen.getByRole('spinbutton', {name: '불투명도'});
  expect(opacity.getAttribute('aria-valuenow')).toBe('37.5');
  color.focus();
  fireEvent.blur(color);
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(color, {target: {value: 'invalid'}});
  fireEvent.blur(color);
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(color, {target: {value: '#00aa11'}});
  fireEvent.blur(color);
  await waitFor(() => expect(first()?.box?.background).toBe('#00AA11'));
  expect(first()?.box?.opacity).toBe(0.375);
  fireEvent.change(opacity, {target: {value: '50'}});
  fireEvent.keyDown(opacity, {key: 'Enter'});
  await waitFor(() => expect(first()?.box?.opacity).toBe(0.5));
  await user.clear(color);
  await user.tab();
  await waitFor(() => expect(first()?.box?.background).toBeUndefined());
  expect(first()?.box).toMatchObject({opacity: 0.5, future: 'keep'});
  expect(first()?.text).toEqual({...STAGE_DEFAULT_TEXT, future: 'keep'});
  expect(opacity.hasAttribute('readonly')).toBe(false);
  act(() =>
    useScreensSelection.getState().selectStageElement(LAYOUT_ID, 'second'),
  );
  expect(
    screen.getByRole('tab', {name: '모양'}).getAttribute('aria-selected'),
  ).toBe('true');
  const empty = screen.getByRole('textbox', {name: '배경색'});
  expect(empty.getAttribute('value')).toBe('');
  expect(empty.getAttribute('placeholder')).toBe('없음');
  expect(
    screen
      .getByRole('spinbutton', {name: '불투명도'})
      .getAttribute('aria-valuenow'),
  ).toBe('100');
  await user.type(empty, '#334455');
  await user.tab();
  await waitFor(() =>
    expect(edit.mock.calls.at(-1)?.[0]).toMatchObject({
      value: {layouts: [{elements: [{}, {box: {background: '#334455'}}]}]},
    }),
  );
});

it('commits a color draft before changing tabs and cancels opacity drafts', async () => {
  const {first} = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', {name: '모양'}));
  const color = screen.getByRole('textbox', {name: '배경색'});
  await user.clear(color);
  await user.type(color, '#22aa33');
  await user.click(screen.getByRole('tab', {name: '글자'}));
  await waitFor(() => expect(first()?.box?.background).toBe('#22AA33'));
  await user.click(screen.getByRole('tab', {name: '모양'}));
  const opacity = screen.getByRole('spinbutton', {name: '불투명도'});
  fireEvent.change(opacity, {target: {value: '12'}});
  fireEvent.keyDown(opacity, {key: 'Escape'});
  fireEvent.blur(opacity);
  expect(first()?.box?.opacity).toBe(0.375);
  fireEvent.change(opacity, {target: {value: '200'}});
  fireEvent.keyDown(opacity, {key: 'Enter'});
  await waitFor(() => expect(first()?.box?.opacity).toBe(1));
  fireEvent.change(opacity, {target: {value: '-1'}});
  fireEvent.keyDown(opacity, {key: 'Enter'});
  await waitFor(() => expect(first()?.box?.opacity).toBe(0));
});

it('keeps appearance available to read without allowing future-version writes', async () => {
  const {edit} = setup('readOnly');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', {name: '모양'}));
  expect(
    screen.getByRole('textbox', {name: '배경색'}).hasAttribute('readonly'),
  ).toBe(true);
  expect(
    screen.getByRole('spinbutton', {name: '불투명도'}).hasAttribute('readonly'),
  ).toBe(true);
  await user.type(screen.getByRole('textbox', {name: '배경색'}), '#001122');
  await user.tab();
  expect(edit).not.toHaveBeenCalled();
});
