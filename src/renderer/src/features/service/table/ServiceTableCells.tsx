import type {JSX} from 'react';
import type {ItemRow} from '@core/presentation';
import {hasSlides, type ServiceItem} from '@core/schema/service';
import {classNames} from '@renderer/ui/classNames';
import styles from './ServiceTable.module.css';

/** The 슬라이드 cell of an item row: how many slides it has. */
export function ServiceTableCells({
  item,
}: {
  readonly row: ItemRow;
  readonly item: ServiceItem | undefined;
}): JSX.Element {
  const own = item !== undefined && hasSlides(item) ? item : undefined;
  return (
    <span className={styles.grid}>
      <span className={classNames(styles.cell, styles.slides)}>
        {own === undefined || own.kind === 'media' ? '' : own.slides.length}
      </span>
    </span>
  );
}
