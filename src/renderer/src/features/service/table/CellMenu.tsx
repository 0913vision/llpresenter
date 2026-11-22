import {useState, type JSX} from 'react';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {CellButton} from './CellButton';

/** A table cell that opens a list of choices in place. */
export function CellMenu({
  label,
  text,
  dim,
  entries,
  reason,
}: {
  readonly label: string;
  readonly text: string;
  readonly dim: boolean;
  readonly entries: readonly MenuEntry[];
  /** Why the cell can't change now; it becomes the tooltip. */
  readonly reason: string | undefined;
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <CellButton
        label={label}
        dim={dim}
        reason={reason}
        expanded={open}
        popup="menu"
        buttonRef={setButton}
        onOpen={() => setOpen(true)}
      >
        {text}
      </CellButton>
      {open && button !== null ? (
        <Menu
          label={label}
          anchor={{kind: 'element', element: button}}
          onClose={() => setOpen(false)}
          entries={entries}
        />
      ) : null}
    </>
  );
}
