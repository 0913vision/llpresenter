import type {JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {useShow} from '@renderer/features/presentation/state/show';
import {READ_ONLY_TIP} from './problemReasons';
import styles from './ReadOnlyMark.module.css';

/** The warning on the 예배 순서 panel while the service can't be edited. */
export function ReadOnlyMark(): JSX.Element | null {
  const readOnly = useShow(view => view.readOnly);
  if (!readOnly) return null;
  return (
    <span
      className={styles.mark}
      role="img"
      aria-label={READ_ONLY_TIP}
      title={READ_ONLY_TIP}
    >
      <Icon name="warning" size={16} />
    </span>
  );
}
