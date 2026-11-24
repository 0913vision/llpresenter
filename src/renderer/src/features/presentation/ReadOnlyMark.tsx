import type {JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {NEWER_FILE_REASON} from '../../platform/problemReasons';
import styles from './ReadOnlyMark.module.css';
import {useShow} from '@renderer/session/show/showStore';

/** The warning on the 예배 순서 panel while the service can't be edited. */
export function ReadOnlyMark(): JSX.Element | null {
  const readOnly = useShow(view => view.readOnly);
  if (!readOnly) return null;
  return (
    <span
      className={styles.mark}
      role="img"
      aria-label={NEWER_FILE_REASON}
      title={NEWER_FILE_REASON}
    >
      <Icon name="warning" size={16} />
    </span>
  );
}
