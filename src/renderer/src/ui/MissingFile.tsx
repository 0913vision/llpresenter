import type {JSX} from 'react';
import {Icon} from './Icon';
import styles from './MissingFile.module.css';

const MISSING_ICON_SIZE = 24;

/** The tooltip of a 장 or a media tile whose file can't be found. */
export function missingFileText(path: string): string {
  return `파일을 찾을 수 없습니다: ${path}`;
}

/** Covers a picture frame with hatching and the 24px missing file icon. */
export function MissingFileMark(): JSX.Element {
  return (
    <span className={styles.mark}>
      <Icon name="filex" size={MISSING_ICON_SIZE} />
    </span>
  );
}
