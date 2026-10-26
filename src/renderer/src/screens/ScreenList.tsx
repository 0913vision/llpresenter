import {useMemo, useRef, type JSX} from 'react';
import {
  ListBox,
  ListDragGhost,
  ListGroup,
  ListRow,
  StatusDot,
} from '@renderer/ui';
import type {Screen} from '@shared/schema/screens';
import {useOutputs} from '@renderer/state/live';
import type {Notice} from '@renderer/ui/notices';
import {screenGroups, type ScreenRow} from './screenRows';
import {selectedScreenIn, useScreensSelection} from './selection';
import {useOutputStatuses} from './useOutputStatuses';
import {useSettingsDocument} from './useSettingsDocument';
import {SCREEN_DRAG_MIME} from './screenDrag';
import styles from './ScreenList.module.css';

const LIST_LABEL = '화면';
const AUDIENCE_LABEL = '청중';
const STAGE_LABEL = '무대';
const LOAD_TITLE = '화면';
const noScreens: readonly Screen[] = [];

function RowView({row}: {readonly row: ScreenRow}): JSX.Element {
  const ghost = useRef<HTMLDivElement>(null);
  return (
    <div
      draggable
      onDragStart={event => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(SCREEN_DRAG_MIME, row.id);
        if (ghost.current !== null) {
          event.dataTransfer.setDragImage(ghost.current, 0, 0);
        }
      }}
    >
      <div ref={ghost} className={styles.ghost} aria-hidden="true">
        <ListDragGhost icon={row.icon} title={row.name} />
      </div>
      <ListRow
        value={row.id}
        title={row.name}
        icon={row.icon}
        meta={row.target}
        reason={row.problem}
        end={
          row.health === 'none' ? undefined : (
            <StatusDot tone={row.health === 'ok' ? 'ok' : 'warning'} />
          )
        }
      />
    </div>
  );
}

/**
 * The 화면 list: the 청중 and 무대 groups, each row with its target and a
 * health dot. Selecting a row selects that screen for the editors beside it.
 */
export function ScreenList({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('screens', LOAD_TITLE, onProblem);
  const statuses = useOutputStatuses();
  const outputs = useOutputs();
  const selection = useScreensSelection(view => view.selection);
  const select = useScreensSelection(view => view.select);
  const screens = document?.value.screens ?? noScreens;
  const groups = useMemo(
    () => screenGroups(screens, statuses, outputs),
    [screens, statuses, outputs],
  );
  const selected = selectedScreenIn(selection, screens)?.id;
  const sections = [
    {label: AUDIENCE_LABEL, rows: groups.audience},
    {label: STAGE_LABEL, rows: groups.stage},
  ];
  return (
    <ListBox
      label={LIST_LABEL}
      selected={selected}
      onSelect={id => select('screen', id)}
    >
      {sections
        .filter(section => section.rows.length > 0)
        .map(section => (
          <ListGroup key={section.label} label={section.label}>
            {section.rows.map(row => (
              <RowView key={row.id} row={row} />
            ))}
          </ListGroup>
        ))}
    </ListBox>
  );
}
