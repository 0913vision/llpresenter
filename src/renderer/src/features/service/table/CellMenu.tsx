import {useState, type JSX} from 'react';
import {classNames} from '@renderer/ui/classNames';
import {Menu} from '@renderer/ui/Menu';
import {titleTooltip, useTooltip, withTooltipProps} from '@renderer/ui/Tooltip';
import type {MenuEntry} from '@renderer/ui/menuModel';
import styles from './ServiceTable.module.css';

// TODO(0913vision): The cell is out of the tab order, so it opens only with
// the mouse. Add keyboard access with the table's cell navigation.
/** A table cell that opens a list of choices in place. */
export function CellMenu({
  label,
  text,
  dim,
  width,
  entries,
  reason,
  hint,
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
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const {targetProps, tooltip} = useTooltip(titleTooltip(reason ?? hint));
  return (
    <>
      <button
        {...withTooltipProps({}, targetProps)}
        ref={setButton}
        type="button"
        tabIndex={-1}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-disabled={reason !== undefined ? true : undefined}
        className={classNames(styles.cell, width, dim && styles.dim)}
        onClick={() => {
          if (reason === undefined) setOpen(true);
        }}
      >
        {text}
      </button>
      {tooltip}
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
