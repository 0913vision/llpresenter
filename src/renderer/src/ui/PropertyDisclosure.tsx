import {useId, type JSX, type ReactNode} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useButtonPress} from './press';
import styles from './PropertyRow.module.css';

const CHEVRON_SIZE = 12;

/** A named group of rows that is folded away until it is opened. */
export function PropertyDisclosure({
  title,
  mark = false,
  open,
  onOpenChange,
  children,
}: {
  readonly title: string;
  /** Marks that a value in it is not the usual one. */
  readonly mark?: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
}): JSX.Element {
  const rowsId = useId();
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: () => onOpenChange(!open),
  });
  return (
    <div className={styles.group}>
      <button
        {...press}
        type="button"
        className={classNames(styles.groupTitle, styles.fold)}
        aria-expanded={open}
        aria-controls={open ? rowsId : undefined}
      >
        <Icon name={open ? 'down' : 'right'} size={CHEVRON_SIZE} />
        {title}
        {mark ? (
          <span role="img" aria-label="바꾼 값 있음" className={styles.mark} />
        ) : null}
      </button>
      {open ? <div id={rowsId}>{children}</div> : null}
    </div>
  );
}
