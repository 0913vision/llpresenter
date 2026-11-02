import {useEffect, useMemo, useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongDocument} from '@core/schema/contentDocuments';
import type {SongGroupId} from '@core/schema/ids';
import {arrangementFromOrder} from '@core/songs/itemOrder';
import {withArrangementPick, withOrderEdit} from '@core/songs/itemOrderEdit';
import {
  ItemEditQueue,
  type ItemProblem,
  type ItemTarget,
} from '@renderer/features/service/items/itemEditQueue';

const ORDER_FAILURE = '순서 변경 실패';
const ARRANGEMENT_FAILURE = '구성 변경 실패';
const SAVE_FAILURE = '구성 저장 실패';

export interface OrderEdits {
  readonly busy: boolean;
  /** Sets this 예배's order, and moves the 오버레이 ranges with it. */
  readonly setOrder: (ids: readonly SongGroupId[]) => Promise<boolean>;
  /** Picks a 구성, or 기본 with undefined, and drops the custom order. */
  readonly pickArrangement: (name: string | undefined) => Promise<boolean>;
  /** Saves the order as a new 구성 of the song and makes the item use it. */
  readonly saveAsArrangement: (
    name: string,
    ids: readonly SongGroupId[],
  ) => Promise<boolean>;
}

interface OrderEditsInput {
  readonly api: Pick<LlpApi, 'services' | 'content'>;
  readonly target: ItemTarget;
  readonly document: SongDocument;
  readonly onProblem: ItemProblem;
  /** Reads the song again, so a second try after a conflict can succeed. */
  readonly reloadSong: () => void;
}

/**
 * Every write of the window goes through one item queue, so edits keep their
 * order, share the close gate, and answer to the same conflict rule as 준비.
 */
export function useOrderEdits({
  api,
  target,
  document,
  onProblem,
  reloadSong,
}: OrderEditsInput): OrderEdits {
  const {queue, store} = useMemo(() => {
    const created = new ItemEditQueue(api, onProblem);
    return {
      queue: created,
      store: {
        subscribe: (listener: () => void) => created.subscribe(listener),
        busy: () => created.busy,
      },
    };
  }, [api, onProblem]);
  useEffect(() => () => queue.dispose(), [queue]);
  const busy = useSyncExternalStore(store.subscribe, store.busy);
  const {song, revision} = document;
  return {
    busy,
    setOrder: ids =>
      queue.submit({
        change: withOrderEdit(song, ids),
        failure: ORDER_FAILURE,
        target,
      }),
    pickArrangement: name =>
      queue.submit({
        change: withArrangementPick(song, name),
        failure: ARRANGEMENT_FAILURE,
        target,
      }),
    saveAsArrangement: (name, ids) =>
      queue.run(async () => {
        const saved = arrangementFromOrder(song, name, ids);
        if (!saved.ok) return false;
        const result = await api.content.edit({
          type: 'song.update',
          song: saved.value,
          baseRevision: revision,
        });
        if (!result.ok) {
          onProblem(SAVE_FAILURE);
          reloadSong();
          return false;
        }
        return queue.apply({
          change: withArrangementPick(saved.value, name),
          failure: ARRANGEMENT_FAILURE,
          target,
        });
      }),
  };
}
