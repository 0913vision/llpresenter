import type {MediaId} from '@core/schema/common/ids';
import type {MediaItem} from '@core/schema/media/mediaList';
import {useUndoKeys} from '@renderer/platform/undo/useUndoKeys';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';

/** The media view, found from the place a key was pressed. */
const VIEW = 'section[aria-label="미디어 보기"]';

/**
 * The keys of the media view: 삭제 and 복제 of the selected media, and the
 * window's 실행 취소 and 다시 실행.
 */
export function useMediaShortcuts({
  title,
  selected,
  reason,
  remove,
  duplicate,
}: {
  /** The name of the list on screen, which labels its grid. */
  readonly title: string;
  readonly selected: MediaItem | undefined;
  /** Why the selected media cannot be changed. */
  readonly reason: string | undefined;
  readonly remove: (item: MediaItem, target: HTMLElement | undefined) => void;
  readonly duplicate: (id: MediaId) => void;
}): void {
  useUndoKeys(VIEW);
  const inside = (event: KeyboardEvent, selector: string): boolean =>
    event.target instanceof Element && event.target.closest(selector) !== null;
  useWindowShortcuts([
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
