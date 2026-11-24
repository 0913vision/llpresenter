import {useEffect, useRef, type DragEvent, type RefObject} from 'react';
import {isUnchangedSelectionMove} from '@core/common/selectionOrder';
import {selectionDragImage} from '@renderer/ui/lists/selectionDrag';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {moveSelected} from '../deckCommands';
import {selectInDeck, selectionOf} from '../deckSelection';
import {slideDropPosition} from '../gridInsertionPosition';
import type {SlideDeck} from '../slideDeck';
import {slideIdAt, slideRow} from './slideKeys';

/** The drag type of slides being moved within a song. */
export const SLIDE_DRAG = 'application/x-llp-song-slide-move';

type Handler = (event: DragEvent<HTMLDivElement>) => void;

/**
 * Moving the chosen slides by dragging them to a gap between slides, with
 * the gap marked while the drag is over it.
 */
export function useSlideDrag({
  deck,
  surface,
  onDragged,
}: {
  readonly deck: SlideDeck;
  readonly surface: RefObject<HTMLElement | null>;
  /** Tells the click guard that the press became a drag. */
  readonly onDragged: () => void;
}): {
  readonly onDragStart: Handler;
  readonly onDragOver: Handler;
  readonly onDrop: Handler;
  readonly onDragEnd: () => void;
} {
  const releaseImage = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => releaseImage.current?.(), []);

  const dropIndex = (event: DragEvent<HTMLDivElement>): number | null => {
    const node =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            '[data-slide-gap], [data-slide-index]',
          )
        : null;
    return node === null
      ? null
      : slideDropPosition(node, event.clientX, event.clientY);
  };
  const clearDrop = (): void => {
    surface.current
      ?.querySelectorAll('[data-slide-drop]')
      .forEach(node => node.removeAttribute('data-slide-drop'));
  };
  const staysInPlace = (index: number): boolean =>
    isUnchangedSelectionMove(
      deck.slides.map(slide => slide.id),
      selectionOf(deck).ids,
      index,
    );

  return {
    onDragStart: event => {
      const id = slideIdAt(event.target);
      const slide = deck.slides.find(entry => entry.id === id);
      if (deck.readOnly || isInTextEntry(event.target) || slide === undefined) {
        event.preventDefault();
        return;
      }
      if (!selectionOf(deck).ids.has(slide.id)) {
        selectInDeck(deck, {type: 'click', id: slide.id});
      }
      event.dataTransfer.setData(SLIDE_DRAG, deck.id);
      event.dataTransfer.effectAllowed = 'move';
      releaseImage.current?.();
      releaseImage.current = selectionDragImage(
        event.dataTransfer,
        slideRow(surface.current, id) ?? event.currentTarget,
        selectionOf(deck).ids.size,
      );
      onDragged();
    },
    onDragOver: event => {
      if (deck.readOnly || !event.dataTransfer.types.includes(SLIDE_DRAG)) {
        return;
      }
      event.preventDefault();
      clearDrop();
      const index = dropIndex(event);
      if (index === null || staysInPlace(index)) return;
      surface.current
        ?.querySelector(`[data-slide-gap="${index}"]`)
        ?.setAttribute('data-slide-drop', '');
    },
    onDrop: event => {
      if (deck.readOnly || event.dataTransfer.getData(SLIDE_DRAG) !== deck.id) {
        return;
      }
      const index = dropIndex(event);
      clearDrop();
      if (index === null || staysInPlace(index)) return;
      event.preventDefault();
      event.stopPropagation();
      moveSelected(deck, index);
    },
    onDragEnd: () => {
      clearDrop();
      releaseImage.current?.();
    },
  };
}
