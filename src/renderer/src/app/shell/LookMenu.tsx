import {useState, type JSX} from 'react';
import type {LookId} from '@core/schema/ids';
import {Menu, ToolbarButton} from '@renderer/ui';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import type {Notice} from '@renderer/ui/notices';
import {sendLookChange} from '../../features/screens/looks/lookActions';
import {useLookChoices} from './useLookChoices';
import {useLive} from '@renderer/platform/live';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {lookMenuEntries} from './lookMenuEntries';

function logProblem(notice: Notice): void {
  console.error('Toolbar Look failed:', notice.key);
}

/** Picks the effective live Look and opens its editor in 화면 설정. */
export function LookMenu({
  compact,
  onProblem = logProblem,
  onEdit,
}: {
  readonly compact: boolean;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onEdit?: (() => void) | undefined;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const open = anchor !== null;
  const {document, loading} = useLookChoices({open, onProblem});
  const liveLook = useLive(view =>
    view.state === null ? undefined : (view.state.lookId ?? null),
  );
  const looks = document?.value.looks ?? [];
  const current =
    liveLook === undefined
      ? null
      : (looks.find(look => look.id === liveLook)?.id ??
        document?.value.current);
  const disabled = window.llp === undefined;
  const setExpanded = (next: boolean, button: HTMLButtonElement): void => {
    setAnchor(next ? button : null);
  };
  const choose = (lookId: LookId): void => {
    setAnchor(null);
    sendLookChange(lookId, onProblem);
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
          entries={lookMenuEntries({
            looks,
            current,
            choose,
            edit: () => {
              const id = current ?? looks[0]?.id;
              if (id) {
                useScreensSelection.getState().select('look', id);
              } else {
                useScreensSelection.setState({
                  selection: {kind: 'look', id: null},
                });
              }
              onEdit?.();
            },
          })}
        />
      ) : null}
    </>
  );
}
