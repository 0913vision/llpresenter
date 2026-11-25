import {useEffect, useState, type JSX} from 'react';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {
  probeCommand,
  runCommandAt,
  subscribeHistoryCommands,
} from '@renderer/ui/keys/commandDispatcher';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import styles from './HistoryButtons.module.css';

/** Chromium exposes native text history availability through this editing API. */
function nativeHistoryAvailable(command: 'undo' | 'redo'): boolean {
  const query: unknown = Reflect.get(document, 'queryCommandEnabled');
  return (
    typeof query === 'function' &&
    Reflect.apply(query, document, [command]) === true
  );
}

/** Uses the same focus owner and command handlers as the edit menu. */
export function HistoryButtons(): JSX.Element {
  const [place, setPlace] = useState<Element | null>(null);
  const [, changed] = useState(0);
  useEffect(() => {
    const refresh = (): void => changed(n => n + 1);
    const focus = (event: FocusEvent): void => {
      if (
        event.target instanceof Element &&
        !event.target.closest(
          '[data-history-buttons], [role="menubar"], [role="menu"], [data-llp-layer]',
        )
      ) {
        setPlace(event.target);
      }
      refresh();
    };
    document.addEventListener('focusin', focus);
    document.addEventListener('input', refresh, true);
    document.addEventListener('keyup', refresh, true);
    const unsubscribe = subscribeHistoryCommands(refresh);
    return () => {
      document.removeEventListener('focusin', focus);
      document.removeEventListener('input', refresh, true);
      document.removeEventListener('keyup', refresh, true);
      unsubscribe();
    };
  }, []);
  const owner = place?.isConnected ? place : null;
  /** Why the command cannot run at the focus owner; nothing when it can. */
  const reasonOf = (kind: 'undo' | 'redo'): string | undefined => {
    const probe = probeCommand(`edit.${kind}`, owner);
    if (probe.found) return probe.reason;
    const native =
      owner !== null && isInTextEntry(owner) && nativeHistoryAvailable(kind);
    return native
      ? undefined
      : kind === 'undo'
        ? NOTHING_TO_UNDO
        : NOTHING_TO_REDO;
  };
  const undoReason = reasonOf('undo');
  const redoReason = reasonOf('redo');
  const run = (kind: 'undo' | 'redo'): void => {
    if (owner instanceof HTMLElement) owner.focus({preventScroll: true});
    if (
      !runCommandAt(`edit.${kind}`, owner) &&
      owner !== null &&
      isInTextEntry(owner)
    ) {
      window.llp?.window.editText(kind);
    }
  };
  return (
    <div className={styles.group} data-history-buttons>
      <IconButton
        icon="arrow-u-up-left"
        label="실행 취소"
        shortcut="Ctrl Z"
        disabled={undoReason !== undefined}
        title={undoReason}
        onMouseDown={event => event.preventDefault()}
        onClick={() => run('undo')}
      />
      <IconButton
        icon="arrow-u-up-right"
        label="다시 실행"
        shortcut="Ctrl Y"
        disabled={redoReason !== undefined}
        title={redoReason}
        onMouseDown={event => event.preventDefault()}
        onClick={() => run('redo')}
      />
    </div>
  );
}
