import {useState, type JSX} from 'react';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Menu} from '@renderer/ui/menus/Menu';
import {menuButtonProps} from '@renderer/ui/menus/menuButton';
import type {Notice} from '@renderer/ui/popups/notices';
import {useQuickAdd} from './useQuickAdd';

/** Adds items after the selected row of the 예배 순서. */
export function ServiceQuickAdd({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const {reason, entries, dialogs} = useQuickAdd(onProblem);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const disabled = reason !== undefined;
  return (
    <>
      <IconButton
        ref={setButton}
        icon="plus"
        label="항목 추가"
        menu
        expanded={open}
        disabled={disabled}
        title={reason}
        {...menuButtonProps({
          expanded: open,
          disabled,
          onExpandedChange: setOpen,
        })}
      />
      {open && !disabled && button !== null ? (
        <Menu
          label="항목 추가"
          anchor={{kind: 'element', element: button}}
          onClose={() => setOpen(false)}
          entries={entries}
        />
      ) : null}
      {dialogs}
    </>
  );
}
