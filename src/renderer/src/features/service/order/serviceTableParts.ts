import type {ReactNode} from 'react';
import type {ItemRow} from '@core/presentation/model';

/** What the 예배 순서 list adds to its rows to draw them as a table. */
export interface ServiceTableParts {
  /** The column names above the rows. */
  readonly header: ReactNode;
  /** The columns of one item row; `detail` is its 슬라이드 count or duration. */
  readonly cellsOf: (row: ItemRow, detail: string | undefined) => ReactNode;
  /** The buttons after the last row. */
  readonly footer: ReactNode;
}
