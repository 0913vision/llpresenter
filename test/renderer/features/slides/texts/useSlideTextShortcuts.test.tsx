import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createSlideId} from '@core/schema/common/ids';
import type {SlideDeck} from '@renderer/features/slides/slideDeck';
import {useSlideTextShortcuts} from '@renderer/features/slides/texts/useSlideTextShortcuts';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import type {WindowShortcut} from '@renderer/ui/keys/commandDispatcher';
import {lyricsSlide} from '@fixtures/core/slides';

const mock = vi.hoisted(() => ({
  register: vi.fn<(commands: readonly WindowShortcut[]) => void>(),
  addSlide: vi.fn(),
  focusText: vi.fn(),
}));
vi.mock('@renderer/platform/shortcuts/windowShortcuts', () => ({
  useWindowShortcuts: mock.register,
}));
vi.mock('@renderer/features/slides/deckCommands', () => ({
  addSlide: mock.addSlide,
}));
vi.mock('@renderer/features/slides/deckSelection', () => ({
  focusText: mock.focusText,
}));

const FIRST = lyricsSlide(1, '만복의 근원 하나님');
const ADDED = {
  ...lyricsSlide(2, ''),
  id: createSlideId('00000000-0000-4000-8000-000000000402'),
};

function deck(more: Partial<SlideDeck> = {}): SlideDeck {
  return {
    id: 'deck',
    item: undefined,
    source: {kind: 'song', title: '만복의 근원 하나님'},
    slides: [FIRST],
    readOnly: false,
    canUndo: true,
    canRedo: false,
    edit: vi.fn(),
    replay: vi.fn(),
    ...more,
  };
}

/** A slide list of `slides` with the text field of its first slide. */
function Slides({
  slides,
  openLabel,
}: {
  readonly slides: SlideDeck;
  readonly openLabel: (anchor: HTMLElement, id: string) => void;
}) {
  useSlideTextShortcuts(slides, {firstBox: () => '가사', openLabel});
  return (
    <div data-slide-deck={slides.id}>
      <textarea aria-label="가사" data-slide-field={FIRST.id} />
      <input aria-label="검색" />
    </div>
  );
}

function setup(slides = deck()) {
  const openLabel = vi.fn();
  render(<Slides slides={slides} openLabel={openLabel} />);
  const commands = new Map(
    (mock.register.mock.lastCall?.[0] ?? []).map(command => [
      command.id,
      command,
    ]),
  );
  const field = screen.getByRole('textbox', {name: '가사'});
  const elsewhere = screen.getByRole('textbox', {name: '검색'});
  const keyIn = (target: HTMLElement, more: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', more);
    Object.defineProperty(event, 'target', {value: target});
    return event;
  };
  return {commands, field, elsewhere, keyIn, openLabel, slides};
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.addSlide.mockReturnValue(ADDED);
});
afterEach(cleanup);

it('takes undo, redo, a new slide and the 이름표 menu only in a slide field of this list', () => {
  const {commands, field, elsewhere, keyIn} = setup();
  expect([...commands.keys()]).toEqual([
    'edit.undo',
    'edit.redo',
    'editor.newSlide',
    'editor.labelMenu',
  ]);
  const undo = commands.get('edit.undo');
  expect(undo?.context).toBe('song');
  expect(undo?.when?.(keyIn(field))).toBe(true);
  expect(undo?.when?.(keyIn(elsewhere))).toBe(false);
  expect(undo?.when?.(keyIn(field, {isComposing: true}))).toBe(false);
});

it('leaves the keys to others in a list that can not be changed', () => {
  const {commands, field, keyIn} = setup(deck({readOnly: true}));
  expect(commands.get('edit.undo')?.when?.(keyIn(field))).toBe(false);
});

it('says why undo or redo has nothing to do', () => {
  const {commands, keyIn, field} = setup();
  expect(
    commands.get('edit.undo')?.unavailable?.(keyIn(field)),
  ).toBeUndefined();
  expect(commands.get('edit.redo')?.unavailable?.(keyIn(field))).toBe(
    NOTHING_TO_REDO,
  );
  cleanup();
  const none = setup(deck({canUndo: false}));
  expect(
    none.commands.get('edit.undo')?.unavailable?.(none.keyIn(none.field)),
  ).toBe(NOTHING_TO_UNDO);
});

it('replays the list, adds a slide typed in its first box, and opens the 이름표 menu of the slide of the field', () => {
  const {commands, field, keyIn, openLabel, slides} = setup();
  field.focus();
  commands.get('edit.undo')?.run(keyIn(field));
  commands.get('edit.redo')?.run(keyIn(field));
  expect(slides.replay).toHaveBeenNthCalledWith(1, 'undo');
  expect(slides.replay).toHaveBeenNthCalledWith(2, 'redo');

  commands.get('editor.newSlide')?.run(keyIn(field));
  expect(mock.addSlide).toHaveBeenCalledWith(slides);
  expect(mock.focusText).toHaveBeenCalledWith('deck', {
    id: ADDED.id,
    box: '가사',
    at: 0,
  });

  commands.get('editor.labelMenu')?.run(keyIn(field));
  expect(openLabel).toHaveBeenCalledWith(field, FIRST.id);
});

it('does nothing once the focus has left the slide field', () => {
  const {commands, elsewhere, keyIn, slides} = setup();
  elsewhere.focus();
  commands.get('edit.undo')?.run(keyIn(elsewhere));
  commands.get('editor.newSlide')?.run(keyIn(elsewhere));
  expect(slides.replay).not.toHaveBeenCalled();
  expect(mock.addSlide).not.toHaveBeenCalled();
});
