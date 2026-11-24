import {useState, type RefObject} from 'react';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {selectInDeck, selectionOf} from './deckSelection';
import type {SlideDeck} from './slideDeck';

interface OpenSlideMenu {
  readonly anchor: MenuAnchor;
  /** Where 슬라이드 추가 of this menu puts a new slide. */
  readonly addAt: number;
}

/** The rows of the chosen slides, which the menu marks while it is open. */
function chosenRows(
  surface: HTMLElement | null,
  ids: ReadonlySet<string>,
): readonly HTMLElement[] {
  const rows = surface?.querySelectorAll<HTMLElement>('[data-song-slide]');
  return [...(rows ?? [])].filter(row => {
    const id = row.dataset['songSlide'];
    return id !== undefined && ids.has(id);
  });
}

/**
 * The slide menu of a list: open on a slide, which it chooses first when it
 * isn't chosen, or on the ground after the last slide.
 */
export function useSlideMenu(
  deck: SlideDeck,
  surface: RefObject<HTMLDivElement | null>,
) {
  const [menu, setMenu] = useState<OpenSlideMenu | null>(null);
  const open = (anchor: MenuAnchor, id: string | undefined): void => {
    const slide = deck.slides.find(entry => entry.id === id);
    if (slide !== undefined && !selectionOf(deck).ids.has(slide.id)) {
      selectInDeck(deck, {type: 'click', id: slide.id});
    }
    setMenu({
      anchor: {
        ...anchor,
        targets:
          slide === undefined
            ? []
            : chosenRows(surface.current, selectionOf(deck).ids),
      },
      addAt:
        slide === undefined
          ? deck.slides.length
          : deck.slides.indexOf(slide) + 1,
    });
  };
  return {menu, open, close: () => setMenu(null)};
}
