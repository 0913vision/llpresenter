import {useState, type JSX} from 'react';
import type {LookId} from '@shared/schema/ids';
import {sendLive} from '@renderer/state/live';
import {Menu, ToolbarButton} from '@renderer/ui';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import type {Notice} from '@renderer/ui/notices';
import {useLookChoices} from './useLookChoices';

const CONFIRMATION_UNAVAILABLE = '현재 버전에서는 Look 적용을 확인할 수 없음';

function logProblem(notice: Notice): void {
  console.error('Toolbar Look failed:', notice.key);
}

/** Sends Look commands without claiming a settings value confirms live output. */
export function LookMenu({
  compact,
  onProblem = logProblem,
}: {
  readonly compact: boolean;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const open = anchor !== null;
  const {document, loading, prepare} = useLookChoices({open, onProblem});
  const disabled = window.llp === undefined;
  const setExpanded = (next: boolean, button: HTMLButtonElement): void => {
    if (next) prepare();
    setAnchor(next ? button : null);
  };
  const choose = (lookId: LookId): void => {
    setAnchor(null);
    try {
      sendLive({type: 'look.set', lookId});
    } catch (cause) {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not send the Look change command',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      onProblem({
        key: 'toolbar-look:send',
        kind: 'warning',
        icon: 'warning',
        title: 'Look 변경 실패',
        time: new Date().toTimeString().slice(0, 5),
      });
    }
  };
  return (
    <>
      <ToolbarButton
        icon="layers"
        label="Look"
        compact={compact}
        menu
        expanded={open}
        disabled={disabled}
        aria-busy={open && loading}
        title={CONFIRMATION_UNAVAILABLE}
        onClick={event => setExpanded(!open, event.currentTarget)}
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded: open,
            disabled,
            onExpandedChange: next => setExpanded(next, event.currentTarget),
          })
        }
      />
      {anchor ? (
        <Menu
          label="Look 선택"
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          entries={(document?.value.looks ?? []).map(look => ({
            kind: 'item',
            id: look.id,
            label: look.name || '이름 없는 Look',
            check: 'radio',
            // TODO(0913vision): Bind the name and check to O4's live confirmation.
            checked: false,
            onSelect: () => choose(look.id),
          }))}
        />
      ) : null}
    </>
  );
}
