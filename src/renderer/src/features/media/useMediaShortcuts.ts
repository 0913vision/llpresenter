import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {MediaLibrary} from './mediaLibrary';

/** The media view, found from the place a key was pressed. */
const VIEW = 'section[aria-label="미디어 보기"]';

/**
 * The keys of the media view: 실행 취소 and 다시 실행 of a delete, and 삭제
 * and 복제 of the selected media.
 */
export function useMediaShortcuts({
  library,
  title,
  selected,
  reason,
  remove,
  duplicate,
}: {
  readonly library: Pick<
    MediaLibrary,
    'canUndoDelete' | 'canRedoDelete' | 'historyDelete'
  >;
  /** The name of the list on screen, which labels its grid. */
  readonly title: string;
  readonly selected: MediaItem | undefined;
  /** Why the selected media cannot be changed. */
  readonly reason: string | undefined;
  readonly remove: (item: MediaItem, target: HTMLElement | undefined) => void;
  readonly duplicate: (id: MediaId) => void;
}): void {
  const inside = (event: KeyboardEvent, selector: string): boolean =>
    event.target instanceof Element && event.target.closest(selector) !== null;
  useWindowShortcuts([
    ...(['undo', 'redo'] as const).map(kind => ({
      id: `edit.${kind}`,
      context: 'service' as const,
      when: (event: KeyboardEvent) => inside(event, VIEW),
      unavailable: () =>
        (kind === 'undo' ? library.canUndoDelete() : library.canRedoDelete())
          ? undefined
          : kind === 'undo'
            ? NOTHING_TO_UNDO
            : NOTHING_TO_REDO,
      run: () => library.historyDelete(kind),
    })),
    {
      id: 'edit.delete',
      when: event =>
        selected !== undefined && inside(event, `${VIEW} [role="listbox"]`),
      unavailable: () => reason,
      run: event => {
        if (selected && reason === undefined) {
          remove(
            selected,
            event.target instanceof HTMLElement ? event.target : undefined,
          );
        }
      },
    },
    {
      id: 'edit.duplicate',
      when: event =>
        selected !== undefined &&
        inside(event, `[aria-label="${CSS.escape(title)}"]`),
      unavailable: () => reason,
      run: () => {
        if (selected !== undefined && reason === undefined) {
          duplicate(selected.id);
        }
      },
    },
  ]);
}
