import type {JSX} from 'react';
import {classNames} from '@renderer/ui/classNames';
import styles from './ServiceTable.module.css';

/** The column names above the rows of the 예배 순서 table. */
export function ServiceTableHeader(): JSX.Element {
  return (
    <div className={styles.header} aria-hidden="true">
      <span className={styles.headerName}>이름</span>
      <span className={styles.grid}>
        <span className={classNames(styles.cell, styles.slides)}>슬라이드</span>
      </span>
    </div>
  );
}
