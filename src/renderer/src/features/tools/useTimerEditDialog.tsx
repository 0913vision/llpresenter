import {useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {Timer} from '@core/schema/timers';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import type {Notice} from '@renderer/ui/notices';
import {TimerEditDialog} from './TimerEditDialog';

/**
 * The 수정… row of a 타이머 and its dialog, for a 타이머 row and for a 퀵 실행
 * row of a 타이머. The dialog opens once the menu has closed.
 *
 * @returns `open` for the row, `reason` when the 타이머 can't be edited (it
 * isn't known), and `dialog` to render beside the menu.
 */
export function useTimerEditDialog({
  api,
  timer,
  menuOpen,
  locked,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly timer: Timer | undefined;
  readonly menuOpen: boolean;
  readonly locked: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
}): {
  readonly open: () => void;
  readonly reason: string | undefined;
  readonly dialog: JSX.Element | null;
} {
  const [changing, setChanging] = useState(false);
  const openAfterMenu = useMenuHandoff(menuOpen, () => setChanging(true));
  return {
    open: () => openAfterMenu(true),
    reason: timer === undefined ? '타이머를 찾을 수 없습니다' : undefined,
    dialog:
      changing && timer ? (
        <TimerEditDialog
          api={api}
          timer={timer}
          locked={locked}
          onProblem={onProblem}
          onClose={() => setChanging(false)}
        />
      ) : null,
  };
}
