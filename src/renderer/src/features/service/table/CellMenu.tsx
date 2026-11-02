import {useState, type JSX} from 'react';
import {ModifiedMark} from '@renderer/ui/ListRow';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {CellButton} from './CellButton';

/** A table cell that opens a list of choices in place. */
export function CellMenu({
  label,
  text,
  dim,
  width,
  entries,
  reason,
  hint,
  mark,
}: {
  readonly label: string;
  readonly text: string;
  readonly dim: boolean;
  readonly width: string | undefined;
  readonly entries: readonly MenuEntry[];
  /** Why the cell can't change now; it becomes the tooltip. */
  readonly reason: string | undefined;
  /** Why the cell reads as it does, shown as the tooltip when it can change. */
  readonly hint?: string | undefined;
  /** The tooltip of a changed mark after the text; no mark without it. */
  readonly mark?: string | undefined;
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <CellButton
        label={label}
        width={width}
        dim={dim}
        reason={reason}
        hint={hint}
        expanded={open}
        popup="menu"
        buttonRef={setButton}
        onOpen={() => setOpen(true)}
      >
        {text}
        {mark === undefined ? null : (
          <ModifiedMark label={mark} spacer={false} />
        )}
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
