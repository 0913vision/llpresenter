import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {DocumentCollection, StoredDocument} from './documents';
import {withArrangementPicks, type ArrangementPick} from './contentEdits';

/** An order rewrite tied to its stored document, without a file operation. */
export interface PickRewrite<T> {
  readonly document: StoredDocument<T>;
  readonly order: readonly ServiceItem[];
}

/**
 * Plans editable service/template repairs after an import, ordered by document
 * id. It does not mutate the collections.
 */
export function importPicks<
  T extends {readonly id: string; readonly order: readonly ServiceItem[]},
>(
  documents: DocumentCollection<T>,
  song: GroupedSong,
): ReadonlyArray<PickRewrite<T>> {
  const names = new Set(
    song.arrangements?.map(arrangement => arrangement.name),
  );
  return documents
    .all()
    .filter(document => document.access === 'editable')
    .flatMap(document => {
      const order = document.data.order.map(item => {
        if (
          !isItemOfKind(item, 'song') ||
          item.song !== song.id ||
          item.arrangement === undefined ||
          names.has(item.arrangement)
        ) {
          return item;
        }
        const {arrangement: _arrangement, ...kept} = item;
        return kept;
      });
      return order.some((item, index) => item !== document.data.order[index])
        ? [{document, order}]
        : [];
    })
    .sort((a, b) => a.document.data.id.localeCompare(b.document.data.id));
}

/**
 * Plans editable service/template arrangement-reference repairs in id order,
 * without installing or saving them.
 */
export function picksToRewrite<
  T extends {readonly id: string; readonly order: readonly ServiceItem[]},
>(
  documents: DocumentCollection<T>,
  pick: ArrangementPick,
): ReadonlyArray<PickRewrite<T>> {
  return documents
    .all()
    .filter(({access}) => access === 'editable')
    .flatMap(document => {
      const order = withArrangementPicks(document.data.order, pick);
      return order === null ? [] : [{document, order}];
    })
    .sort((a, b) => a.document.data.id.localeCompare(b.document.data.id));
}

/**
 * Installs the supplied order repairs in their collections without writing
 * files or announcing changes.
 */
export function rewritePicks<
  T extends {readonly id: string; readonly order: readonly ServiceItem[]},
>(
  documents: DocumentCollection<T>,
  rewrites: ReadonlyArray<PickRewrite<T>>,
): ReadonlyArray<StoredDocument<T>> {
  return rewrites.map(({document, order}) =>
    documents.replace(document, {...document.data, order}),
  );
}
