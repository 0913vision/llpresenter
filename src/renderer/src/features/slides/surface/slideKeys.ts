import type {SlideId} from '@core/schema/common/ids';
import type {Slide} from '@core/schema/slides/slide';
import type {SlideSelectionAction} from '@core/slides';
import type {DeckSelection} from '../deckSelection';

/** What a move key does in a list of slides. */
export type SlideMove =
  | {readonly kind: 'select'; readonly action: SlideSelectionAction<SlideId>}
  /** Esc with one slide chosen: leave the editor. */
  | {readonly kind: 'back'};

/**
 * Decides what an arrow, Home, End or Esc does in a list of slides laid out
 * in `columns` columns, or undefined for any other key.
 */
export function slideMove(
  key: string,
  shift: boolean,
  {
    slides,
    selection,
    focused,
    columns,
  }: {
    readonly slides: readonly Slide[];
    readonly selection: DeckSelection;
    readonly focused: Slide | undefined;
    readonly columns: number;
  },
): SlideMove | undefined {
  const select = (action: SlideSelectionAction<SlideId>): SlideMove => ({
    kind: 'select',
    action,
  });
  if (key.startsWith('Arrow')) {
    const delta =
      key === 'ArrowUp'
        ? -columns
        : key === 'ArrowDown'
          ? columns
          : key === 'ArrowLeft'
            ? -1
            : 1;
    return select({type: 'arrow', delta, shift});
  }
  if (key === 'Home' || key === 'End') {
    const slide = key === 'Home' ? slides[0] : slides.at(-1);
    return select(
      selection.caret !== null ||
        slide === undefined ||
        selection.ids.size === 0
        ? {type: 'gap', index: key === 'Home' ? 0 : slides.length}
        : {type: 'click', id: slide.id, shift},
    );
  }
  if (key === 'Escape') {
    if (selection.ids.size <= 1 && selection.caret === null) {
      return {kind: 'back'};
    }
    return select(
      focused === undefined ? {type: 'clear'} : {type: 'click', id: focused.id},
    );
  }
  return undefined;
}

/** The slide a node of the list belongs to. */
export function slideIdAt(target: EventTarget | null): string | undefined {
  return target instanceof Element
    ? target.closest<HTMLElement>('[data-song-slide]')?.dataset['songSlide']
    : undefined;
}

/** The row of a slide in the list. */
export function slideRow(
  surface: HTMLElement | null,
  id: string | undefined,
): HTMLElement | null {
  return id === undefined
    ? null
    : (surface?.querySelector<HTMLElement>(
        `[data-song-slide="${CSS.escape(id)}"]`,
      ) ?? null);
}
