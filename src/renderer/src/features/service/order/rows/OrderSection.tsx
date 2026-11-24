import type {JSX} from 'react';
import {ListGroup, ListInsertLine} from '@renderer/ui/lists/ListRow';
import type {ListWorkspace} from '@renderer/ui/lists/workspace';
import {ItemRows, type RowContext} from './ItemRows';
import type {RowGroup} from '../orderRows';
import type {RenameContract} from '@renderer/ui/fields/renameContract';

/**
 * A 구역 of the 예배 순서 and its items. In 준비 it is picked, dragged and
 * renamed like an item (a double click on its own row renames it); in 진행
 * it is a plain label.
 */
export function OrderSection({
  group,
  label,
  context,
  workspace,
  editable,
  className,
  insertLine,
  done,
  selected,
  renaming,
  onRename,
  onCommitName,
  onCloseRename,
}: {
  readonly group: RowGroup;
  readonly label: string;
  readonly context: RowContext;
  readonly workspace: ListWorkspace;
  readonly editable: boolean;
  readonly className: string | undefined;
  /** The drop line shows above this 구역. */
  readonly insertLine: boolean;
  readonly done: boolean;
  readonly selected: boolean;
  readonly renaming: boolean;
  readonly onRename: () => void;
  readonly onCommitName: RenameContract['onCommit'];
  readonly onCloseRename: () => void;
}): JSX.Element {
  const prep = workspace === 'prep';
  return (
    <div
      data-order-id={group.id}
      className={className}
      draggable={editable && prep}
      onDoubleClick={event => {
        const row =
          event.target instanceof Element
            ? event.target.closest('[data-order-id]')
            : null;
        if (prep && editable && row === event.currentTarget) onRename();
      }}
    >
      {insertLine ? <ListInsertLine /> : null}
      <ListGroup
        done={done}
        selected={selected}
        // NOTE(0913vision): In 진행 a section is a plain label: no
        // click, hover, selection, or arrow stop (spec 04).
        value={prep ? group.id : undefined}
        label={label}
        rename={
          renaming
            ? {onCommit: onCommitName, onClose: onCloseRename}
            : undefined
        }
      >
        <ItemRows items={group.items} context={context} />
      </ListGroup>
    </div>
  );
}
