import {useState, type JSX} from 'react';
import {Button} from '@renderer/ui/Button';
import {Menu} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {useQuickAdd} from '../items/useQuickAdd';
import styles from './ServiceTable.module.css';

/** The button under the rows that adds after the selected one. */
export function ServiceTableFooter({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const {reason, entries, dialogs} = useQuickAdd(onProblem);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.footer}>
      <Button
        ref={setButton}
        variant="ghost"
        icon="plus"
        disabled={reason !== undefined}
        title={reason}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        항목
      </Button>
      {open && reason === undefined && button !== null ? (
        <Menu
          label="항목 추가"
          anchor={{kind: 'element', element: button}}
          onClose={() => setOpen(false)}
          entries={entries}
        />
      ) : null}
      {dialogs}
    </div>
  );
}
