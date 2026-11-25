import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {SlideDeck} from '@renderer/features/slides/slideDeck';
import {useDeckClipboard} from '@renderer/features/slides/surface/useDeckClipboard';

const commands = vi.hoisted(() => ({
  copySelected: vi.fn<() => string | null>(),
  deleteSelected: vi.fn(),
  pasteInto: vi.fn(),
  selectionReason: vi.fn<() => string | undefined>(),
  addReason: vi.fn<() => string | undefined>(),
}));
vi.mock('@renderer/features/slides/deckCommands', () => commands);

const DECK: SlideDeck = {
  id: 'deck',
  item: undefined,
  source: {kind: 'song', title: '만복의 근원 하나님'},
  slides: [],
  readOnly: false,
  canUndo: false,
  canRedo: false,
  edit: () => undefined,
  replay: () => undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  commands.copySelected.mockReturnValue('1절\n주 하나님');
  commands.selectionReason.mockReturnValue(undefined);
  commands.addReason.mockReturnValue(undefined);
});
afterEach(cleanup);

/** A list of slides with a text field in it. */
function Slides({focusSurface}: {readonly focusSurface: () => void}) {
  return (
    <div data-testid="slides" {...useDeckClipboard(DECK, focusSurface)}>
      <textarea aria-label="가사" />
    </div>
  );
}

function setup() {
  const focusSurface = vi.fn();
  render(<Slides focusSurface={focusSurface} />);
  return {
    focusSurface,
    slides: screen.getByTestId('slides'),
    field: screen.getByRole('textbox', {name: '가사'}),
  };
}

/** Clipboard data that holds `text` and records what is set. */
function clipboard(text = '') {
  const data = new Map<string, string>([['text/plain', text]]);
  return {
    data,
    clipboardData: {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    },
  };
}

it('copies the selected slides as text, and leaves a text field its own copy', () => {
  const {slides, field} = setup();
  const copied = clipboard();
  fireEvent.copy(slides, {clipboardData: copied.clipboardData});
  expect(copied.data.get('text/plain')).toBe('1절\n주 하나님');

  const own = clipboard('kept');
  fireEvent.copy(field, {clipboardData: own.clipboardData});
  expect(own.data.get('text/plain')).toBe('kept');
});

it('cuts the selected slides only when they may be deleted', () => {
  const {slides, focusSurface} = setup();
  const cut = clipboard();
  fireEvent.cut(slides, {clipboardData: cut.clipboardData});
  expect(cut.data.get('text/plain')).toBe('1절\n주 하나님');
  expect(focusSurface).toHaveBeenCalled();
  expect(commands.deleteSelected).toHaveBeenCalledWith(DECK);

  commands.deleteSelected.mockClear();
  commands.selectionReason.mockReturnValue('읽기 전용입니다.');
  const refused = clipboard('kept');
  fireEvent.cut(slides, {clipboardData: refused.clipboardData});
  expect(refused.data.get('text/plain')).toBe('kept');
  expect(commands.deleteSelected).not.toHaveBeenCalled();
});

it('pastes text as slides, but not in a text field or where slides can not be added', () => {
  const {slides, field} = setup();
  fireEvent.paste(slides, {clipboardData: clipboard('2절').clipboardData});
  expect(commands.pasteInto).toHaveBeenCalledExactlyOnceWith(DECK, '2절');

  fireEvent.paste(field, {clipboardData: clipboard('x').clipboardData});
  commands.addReason.mockReturnValue('슬라이드가 너무 많습니다.');
  fireEvent.paste(slides, {clipboardData: clipboard('y').clipboardData});
  expect(commands.pasteInto).toHaveBeenCalledOnce();
});
