import type {JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {useShow} from '@renderer/state/show';
import styles from './ReadOnlyMark.module.css';

const READ_ONLY_TIP = '새 버전의 파일이라 읽기 전용으로 엽니다.';

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
