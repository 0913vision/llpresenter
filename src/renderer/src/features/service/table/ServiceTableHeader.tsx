import type {JSX} from 'react';
import {classNames} from '@renderer/ui/classNames';
import styles from './ServiceTable.module.css';

const COLUMNS = [
  ['슬라이드', styles.slides],
  ['테마', styles.theme],
  ['배경', styles.background],
  ['시작할 때', styles.start],
  ['메모', styles.memo],
] as const;

/** The column names above the rows of the 예배 순서 table. */
export function ServiceTableHeader(): JSX.Element {
  return (
    <div className={styles.header} aria-hidden="true">
      <span className={styles.headerName}>이름</span>
      <span className={styles.grid}>
        {COLUMNS.map(([label, width]) => (
          <span key={label} className={classNames(styles.cell, width)}>
            {label}
          </span>
        ))}
      </span>
    </div>
  );
}
