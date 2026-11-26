import type {JSX, ReactNode} from 'react';
import {Icon} from '../Icon';
import {Tooltip} from '../popups/Tooltip';
import styles from './MissingReference.module.css';

const WARNING_ICON_SIZE = 14;

/**
 * A select whose saved choice is missing, with the 14px warning beside it that
 * gives `reason` (Select README, "Missing saved reference"). Without a reason
 * the select shows alone.
 */
export function MissingReference({
  reason,
  children,
}: {
  readonly reason: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  if (reason === undefined) return <>{children}</>;
  return (
    <span className={styles.reference}>
      <span className={styles.field}>{children}</span>
      <Tooltip text={reason}>
        <span role="img" aria-label={reason} className={styles.warning}>
          <Icon name="warning" size={WARNING_ICON_SIZE} />
        </span>
      </Tooltip>
    </span>
  );
}
