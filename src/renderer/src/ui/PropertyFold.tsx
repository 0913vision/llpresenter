import {useId, type JSX, type ReactNode} from 'react';
import {Icon} from './Icon';
import {useButtonPress} from './press';
import styles from './PropertyFold.module.css';

const CHEVRON_SIZE = 12;

/** Rows that are folded away behind their name until they are opened. */
export function PropertyFold({
  title,
  mark = false,
  action,
  open,
  onOpenChange,
  children,
}: {
  readonly title: string;
  /** Marks that a value in it is not the usual one. */
  readonly mark?: boolean;
  /** A button at the right end of the name. */
  readonly action?: ReactNode;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
}): JSX.Element {
  const titleId = useId();
  const rowsId = useId();
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: () => onOpenChange(!open),
  });
  return (
    <div role="group" aria-labelledby={titleId} className={styles.fold}>
      <div className={styles.head}>
        <button
          {...press}
          type="button"
          className={styles.name}
          aria-expanded={open}
          aria-controls={open ? rowsId : undefined}
        >
          <Icon name={open ? 'down' : 'right'} size={CHEVRON_SIZE} />
          <span id={titleId}>{title}</span>
          {mark ? (
            <span
              role="img"
              aria-label="바꾼 값 있음"
              className={styles.mark}
            />
          ) : null}
        </button>
        {action}
      </div>
      {open ? (
        <div id={rowsId} className={styles.rows}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
