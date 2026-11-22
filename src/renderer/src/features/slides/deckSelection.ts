import {useMemo} from 'react';
import {create} from 'zustand';
import type {SlideId} from '@core/schema/ids';
import type {Slide} from '@core/schema/slide';
import {
  emptySlideSelection,
  selectSlideList,
  type SlideListSelection,
  type SlideSelectionAction,
} from '@core/slides/selection';

export type DeckSelection = SlideListSelection<SlideId>;

/** Where the caret goes once the field of a slide is there. */
export interface TextFocus {
  readonly id: SlideId;
  readonly box: string;
  readonly at: number;
}

interface View {
  readonly deckId: string | null;
  readonly selection: DeckSelection;
  readonly focus: TextFocus | null;
  /** Grows with every edit whose new slides should come into view. */
  readonly reveal: number;
}

/** The selected slides, shared by the list of slides and their panel. */
const useView = create<View>(() => ({
  deckId: null,
  selection: emptySlideSelection(),
  focus: null,
  reveal: 0,
}));

interface Deck {
  readonly id: string;
  readonly slides: readonly Slide[];
}

const idsOf = (deck: Deck): readonly SlideId[] =>
  deck.slides.map(slide => slide.id);

/** The selection of a deck: its first slide until something is selected. */
function selectionIn(deck: Deck, view: View): DeckSelection {
  const ids = idsOf(deck);
  const first = ids[0];
  const start =
    first === undefined
      ? emptySlideSelection<SlideId>()
      : selectSlideList(ids, emptySlideSelection<SlideId>(), {
          type: 'click',
          id: first,
        });
  if (view.deckId !== deck.id) return start;
  const {selection} = view;
  const known = new Set(ids);
  const kept = [...selection.ids].filter(id => known.has(id));
  if (kept.length === selection.ids.size) {
    return selection.caret !== null && selection.caret > ids.length
      ? {...selection, caret: ids.length}
      : selection;
  }
  return kept.length === 0 ? start : {...selection, ids: new Set(kept)};
}

export function selectionOf(deck: Deck): DeckSelection {
  return selectionIn(deck, useView.getState());
}

export function useDeckSelection(deck: Deck): DeckSelection {
  const view = useView();
  return useMemo(() => selectionIn(deck, view), [deck, view]);
}

export function useTextFocus(): TextFocus | null {
  return useView(view => view.focus);
}

export function useReveal(): number {
  return useView(view => view.reveal);
}

export function selectInDeck(
  deck: Deck,
  action: SlideSelectionAction<SlideId>,
): void {
  useView.setState({
    deckId: deck.id,
    selection: selectSlideList(idsOf(deck), selectionOf(deck), action),
    focus: null,
  });
}

/** Selects slides that an edit makes, once they are there. */
export function selectAdded(deckId: string, ids: readonly SlideId[]): void {
  const last = ids.at(-1);
  if (last === undefined) return;
  useView.setState(view => ({
    deckId,
    selection: {
      ids: new Set(ids),
      anchor: {kind: 'slide', id: ids[0] ?? last},
      focus: {kind: 'slide', id: last},
      caret: null,
    },
    focus: null,
    reveal: view.reveal + 1,
  }));
}

/** Puts the caret in the text of a slide. */
export function focusText(deckId: string, focus: TextFocus): void {
  selectAdded(deckId, [focus.id]);
  useView.setState({focus});
}

export function clearTextFocus(): void {
  useView.setState({focus: null});
}

/** Selects one slide of a deck by its place before the deck is shown. */
export function openDeckAt(deckId: string, id: SlideId | undefined): void {
  if (id !== undefined) selectAdded(deckId, [id]);
}

/** The slides that are selected, in their order. */
export function selectedSlides(
  deck: Deck,
  selection: DeckSelection,
): readonly Slide[] {
  return deck.slides.filter(slide => selection.ids.has(slide.id));
}

/** The slide that single edits go to. */
export function focusedSlide(
  deck: Deck,
  selection: DeckSelection,
): Slide | undefined {
  const focus = selection.focus;
  const own =
    focus?.kind === 'slide'
      ? deck.slides.find(slide => slide.id === focus.id)
      : undefined;
  return own ?? selectedSlides(deck, selection)[0];
}
