import {useMemo} from 'react';
import type {LabelColor} from '@core/labels';
import {hasSlides, type SlidesItem} from '@core/schema/service';
import type {ShowTile} from '@core/schema/showService';
import type {Slide} from '@core/schema/slide';
import {slideSourceOf, slideTiles, type SlideSource} from '@core/slides';
import {
  editItemSlides,
  redoService,
  undoService,
  useOpenService,
  useServiceItem,
} from '@renderer/session/openService';
import {runEdit, type Report} from '@renderer/session/serviceEdit';

export type SlidesChange = (slides: readonly Slide[]) => readonly Slide[];

/** A list of slides that can be edited: of an item, or of a library song. */
export interface SlideDeck {
  readonly id: string;
  /** The service item it belongs to; none for a song of the library. */
  readonly item: SlidesItem | undefined;
  readonly source: SlideSource;
  readonly slides: readonly Slide[];
  readonly readOnly: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Edits with the same key right after another are undone as one. */
  readonly edit: (change: SlidesChange, key?: string) => void;
  readonly replay: (kind: 'undo' | 'redo') => void;
}

/** The slides of an item of the open 예배 순서. */
export function useItemDeck(
  itemId: string | null,
  report: Report,
): SlideDeck | null {
  const item = useServiceItem(itemId);
  const readOnly = useOpenService(view => view.readOnly);
  const canUndo = useOpenService(view => view.past.length > 0);
  const canRedo = useOpenService(view => view.future.length > 0);
  return useMemo(() => {
    if (item === undefined || !hasSlides(item)) return null;
    return {
      id: item.id,
      item,
      source: slideSourceOf(item),
      slides: item.slides,
      readOnly,
      canUndo,
      canRedo,
      edit: (change, key) =>
        runEdit(
          editItemSlides(
            item.id,
            change,
            key === undefined ? {} : {key: `${item.id}:${key}`},
          ),
          report,
        ),
      replay: kind =>
        runEdit(kind === 'undo' ? undoService() : redoService(), report),
    };
  }, [item, readOnly, canUndo, canRedo, report]);
}

/** The slides of a deck with everything that is worked out for them. */
export function useDeckTiles(
  deck: Pick<SlideDeck, 'slides' | 'source'>,
  colors: ReadonlyMap<string, LabelColor>,
): readonly ShowTile[] {
  const {slides, source} = deck;
  return useMemo(
    () => slideTiles(slides, source, colors),
    [slides, source, colors],
  );
}
