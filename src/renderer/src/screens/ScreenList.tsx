import {useMemo, type JSX} from 'react';
import {ListBox, ListGroup, ListRow, StatusDot} from '@renderer/ui';
import {useOutputs} from '@renderer/state/live';
import type {Notice} from '@renderer/ui/notices';
import {screenGroups, type ScreenGroups, type ScreenRow} from './screenRows';
import {selectedIdIn, useScreensSelection} from './selection';
import {useOutputStatuses} from './useOutputStatuses';
import {useSettingsDocument} from './useSettingsDocument';

const LIST_LABEL = '화면';
const AUDIENCE_LABEL = '청중';
const STAGE_LABEL = '무대';
const LOAD_TITLE = '화면';

function firstRowId(groups: ScreenGroups): string | undefined {
  return (groups.audience[0] ?? groups.stage[0])?.id;
}

function hasRow(groups: ScreenGroups, id: string): boolean {
  return [...groups.audience, ...groups.stage].some(row => row.id === id);
}

function RowView({row}: {readonly row: ScreenRow}): JSX.Element {
  return (
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
  const groups = useMemo(
    () => screenGroups(document?.value.screens ?? [], statuses, outputs),
    [document, statuses, outputs],
  );
  const picked = selectedIdIn(selection, 'screen');
  const selected =
    picked !== undefined && hasRow(groups, picked)
      ? picked
      : selection.kind === 'screen'
        ? firstRowId(groups)
        : undefined;
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
