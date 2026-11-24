import type {SlideId} from '@core/schema/common/ids';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {addSlide} from '../deckCommands';
import {focusText} from '../deckSelection';
import {splitAtCaret} from './deckTexts';
import type {SlideDeck} from '../slideDeck';

/** The field of a slide that a key goes to, in one list of slides. */
function fieldOf(
  target: EventTarget | null,
  deck: string,
): HTMLTextAreaElement | null {
  return target instanceof HTMLTextAreaElement &&
    target.dataset['slideField'] !== undefined &&
    target.closest<HTMLElement>('[data-slide-deck]')?.dataset['slideDeck'] ===
      deck
    ? target
    : null;
}

/**
 * The keys of a slide's text field in a list of slides: undo and redo of the
 * list, a new slide after this one, splitting the slide at the caret, and the
 * 이름표 menu of the slide.
 */
export function useSlideTextShortcuts(
  deck: SlideDeck,
  {
    firstBox,
    openLabel,
  }: {
    /** The first text box of a theme, where a new slide is typed. */
    readonly firstBox: (theme: string) => string | undefined;
    readonly openLabel: (anchor: HTMLElement, id: SlideId) => void;
  },
): void {
  useWindowShortcuts(
    (
      [
        'edit.undo',
        'edit.redo',
        'editor.newSlide',
        'editor.splitSlide',
        'editor.labelMenu',
      ] as const
    ).map(id => ({
      id,
      context: 'song' as const,
      when: (event: KeyboardEvent) =>
        !deck.readOnly &&
        !event.isComposing &&
        fieldOf(event.target, deck.id) !== null,
      unavailable: () => {
        if (id === 'edit.undo') {
          return deck.canUndo ? undefined : NOTHING_TO_UNDO;
        }
        if (id === 'edit.redo') {
          return deck.canRedo ? undefined : NOTHING_TO_REDO;
        }
        return undefined;
      },
      run: () => {
        const field = fieldOf(document.activeElement, deck.id);
        if (field === null) return;
        switch (id) {
          case 'edit.undo':
            deck.replay('undo');
            break;
          case 'edit.redo':
            deck.replay('redo');
            break;
          case 'editor.splitSlide':
            splitAtCaret(deck, field);
            break;
          case 'editor.newSlide': {
            const added = addSlide(deck);
            const box = firstBox(added.theme);
            if (box !== undefined) {
              focusText(deck.id, {id: added.id, box, at: 0});
            }
            break;
          }
          case 'editor.labelMenu': {
            const slide = deck.slides.find(
              entry => entry.id === field.dataset['slideField'],
            );
            if (slide !== undefined) openLabel(field, slide.id);
            break;
          }
        }
      },
    })),
  );
}
