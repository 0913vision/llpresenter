import {useState, type JSX} from 'react';
import type {Label} from '@core/schema/labels';
import {LabelDeleteDialog} from './LabelDeleteDialog';
import {labelManagementEntries} from './labelMenuEntries';
import {Menu} from '@renderer/ui/Menu';
import {LabelDialog} from './LabelDialog';
import type {LabelContext} from './LabelChoices';
import type {SongEditorStore} from './songEditorStore';
import {LabelColorPopover} from './LabelColorPopover';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';

interface ManagementProps {
  readonly context: LabelContext;
  readonly store: SongEditorStore;
  readonly labels: readonly Label[];
  readonly disabledReason: string | undefined;
  readonly onClose: () => void;
}

/** One management flow keeps the parent label popup and its anchor alive. */
export function LabelManagement({
  context,
  store,
  labels,
  disabledReason,
  onClose,
}: ManagementProps): JSX.Element | null {
  const locked = disabledReason !== undefined;
  const [action, setAction] = useState<'rename' | 'delete' | 'color' | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(true);
  const renameAfterMenu = useMenuHandoff(menuOpen, () => setAction('rename'));
  if (action === 'color') {
    return (
      <LabelColorPopover
        label={
          labels.find(label => label.name === context.label.name) ??
          context.label
        }
        labels={labels}
        store={store}
        anchor={context.trigger}
        locked={locked}
        onClose={onClose}
      />
    );
  }
  if (action === 'delete') {
    return (
      <LabelDeleteDialog
        name={context.label.name}
        labels={labels}
        store={store}
        locked={locked}
        onClose={onClose}
      />
    );
  }
  if (action !== null) {
    return (
      <LabelDialog
        label={context.label}
        labels={labels}
        store={store}
        busy={locked}
        onClose={onClose}
      />
    );
  }
  if (!menuOpen) return null;
  return (
    <Menu
      label={`${context.label.name} 관리`}
      anchor={context.anchor}
      onClose={reason => {
        if (reason !== 'select') onClose();
      }}
      entries={labelManagementEntries({
        disabledReason,
        color: () => setAction('color'),
        rename: () => {
          renameAfterMenu(true);
          setMenuOpen(false);
        },
        remove: () => setAction('delete'),
      })}
    />
  );
}
