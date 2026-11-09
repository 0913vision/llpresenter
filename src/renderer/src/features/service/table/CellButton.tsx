import type {JSX, ReactNode, Ref} from 'react';
import {Button} from '@renderer/ui/Button';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import {titleTooltip, useTooltip, withTooltipProps} from '@renderer/ui/Tooltip';
import styles from './ServiceTable.module.css';

/** Marks a cell that the keyboard moves into from its row. */
export const TABLE_CELL = 'data-table-cell';

/**
 * The button of an editable table cell. It sits out of the tab order and the
 * list's arrow keys, and the table's cell keys move focus into it from its row.
 */
export function CellButton({
  label,
  presentation = 'cell',
  width,
  dim,
  reason,
  hint,
  expanded,
  popup,
  buttonRef,
  onOpen,
  children,
}: {
  readonly label: string;
  readonly presentation?: 'cell' | 'ribbon';
  readonly width: string | undefined;
  readonly dim: boolean;
  /** Why the cell can't change now; it becomes the tooltip. */
  readonly reason: string | undefined;
  /** Why the cell reads as it does, shown as the tooltip when it can change. */
  readonly hint?: string | undefined;
  readonly expanded: boolean;
  readonly popup: 'menu' | 'listbox' | 'dialog' | undefined;
  readonly buttonRef: Ref<HTMLButtonElement>;
  readonly onOpen: () => void;
  readonly children: ReactNode;
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(reason ?? hint));
  if (presentation === 'ribbon') {
    return (
      <Button
        ref={buttonRef}
        size="md"
        aria-label={label}
        aria-haspopup={popup}
        aria-expanded={expanded}
        disabled={reason !== undefined}
        title={reason ?? hint}
        onClick={onOpen}
      >
        {children}
        <Icon name="down" size={12} />
      </Button>
    );
  }
  return (
    <>
      <button
        {...withTooltipProps({}, targetProps)}
        {...{[TABLE_CELL]: ''}}
        ref={buttonRef}
        type="button"
        tabIndex={-1}
        aria-label={label}
        aria-haspopup={popup}
        aria-expanded={popup === undefined ? undefined : expanded}
        aria-disabled={reason !== undefined ? true : undefined}
        className={classNames(styles.cell, width, dim && styles.dim)}
        onClick={() => {
          if (reason === undefined) onOpen();
        }}
      >
        {children}
      </button>
      {tooltip}
    </>
  );
}
