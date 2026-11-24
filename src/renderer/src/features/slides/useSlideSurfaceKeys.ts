import type {KeyboardEvent, RefObject} from 'react';
import type {Slide} from '@core/schema/slide';
import {takeMenuKey} from '@renderer/ui/menus/contextMenu';
import {isComposing} from '@renderer/ui/fields/ime';
import type {MenuAnchor} from '@renderer/ui/menus/Menu';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {selectInDeck, type useDeckSelection} from './deckSelection';
import type {SlideDeck} from './slideDeck';
import {slideIdAt, slideMove, slideRow} from './slideKeys';

type SurfaceKey = KeyboardEvent<HTMLDivElement>;

function plainKey(event: SurfaceKey): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

function consume(event: SurfaceKey): void {
  event.preventDefault();
  event.stopPropagation();
}

/** How many slides a row of the grid has; a list has one. */
function gridColumns(surface: HTMLElement | null): number {
  const grid = surface?.querySelector<HTMLElement>('[data-slide-columns]');
  return Number(grid?.dataset['slideColumns'] ?? 1);
}

/**
 * The keys of a list of slides: Space adds a slide to the selection, Esc
 * leaves a text for its slide, the menu key opens the slide menu, and the
 * arrows, Home and End move the selection.
 */
export function useSlideSurfaceKeys({
  deck,
  selection,
  focused,
  surface,
  focusSurface,
  openMenu,
  onBack,
}: {
  readonly deck: SlideDeck;
  readonly selection: ReturnType<typeof useDeckSelection>;
  readonly focused: Slide | undefined;
  readonly surface: RefObject<HTMLDivElement | null>;
  readonly focusSurface: () => void;
  readonly openMenu: (anchor: MenuAnchor, id: string | undefined) => void;
  readonly onBack: (() => void) | undefined;
}): {
  readonly onKeyDownCapture: (event: SurfaceKey) => void;
  readonly onKeyDown: (event: SurfaceKey) => void;
} {
  const slideOf = (id: string | undefined): Slide | undefined =>
    deck.slides.find(slide => slide.id === id);

  const toggleWithSpace = (event: SurfaceKey): void => {
    const onSlide =
      event.target === event.currentTarget ||
      (event.target instanceof Element &&
        event.target.matches('[data-song-slide]'));
    if (!onSlide) return;
    consume(event);
    const slide = slideOf(slideIdAt(event.target)) ?? focused;
    if (!event.repeat && slide !== undefined && selection.caret === null) {
      selectInDeck(deck, {type: 'click', id: slide.id, ctrl: true});
    }
  };

  const leaveText = (event: SurfaceKey): void => {
    const slide = slideOf(slideIdAt(event.target));
    if (slide === undefined) return;
    consume(event);
    focusSurface();
    selectInDeck(deck, {type: 'click', id: slide.id});
  };

  const openMenuOnFocused = (event: SurfaceKey): void => {
    const target =
      event.target instanceof HTMLElement ? event.target : event.currentTarget;
    const id = slideIdAt(target) ?? focused?.id;
    const row = slideRow(surface.current, id);
    openMenu({kind: 'element', element: row ?? target}, id);
  };

  return {
    onKeyDownCapture: event => {
      if (event.defaultPrevented || isComposing(event)) return;
      const inText = isInTextEntry(event.target);
      if (event.key === ' ' && plainKey(event) && !inText) {
        toggleWithSpace(event);
      } else if (event.key === 'Escape' && plainKey(event) && inText) {
        leaveText(event);
      } else if (!inText && takeMenuKey(event)) {
        openMenuOnFocused(event);
      }
    },
    onKeyDown: event => {
      if (
        event.defaultPrevented ||
        isComposing(event) ||
        isInTextEntry(event.target) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      const move = slideMove(event.key, event.shiftKey, {
        slides: deck.slides,
        selection,
        focused,
        columns: gridColumns(surface.current),
      });
      if (move === undefined) return;
      consume(event);
      focusSurface();
      if (move.kind === 'back') onBack?.();
      else selectInDeck(deck, move.action);
    },
  };
}
