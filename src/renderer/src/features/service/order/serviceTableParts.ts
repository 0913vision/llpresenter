import type {ReactNode} from 'react';
import type {ItemRow, ServiceRow} from '@core/presentation/model';
import type {MenuEntry} from '@renderer/ui/menuModel';

/** What the 예배 순서 list adds to its rows to draw them as a table. */
export interface ServiceTableParts {
  readonly menuFor?: (row: ServiceRow) => readonly MenuEntry[];
  /** The column names above the rows. */
  readonly header: ReactNode;
  /** The columns of one item row; `detail` is its 슬라이드 count or duration. */
  readonly cellsOf: (row: ItemRow, detail: string | undefined) => ReactNode;
  /** The class of an item row, which sets its height. */
  readonly rowClass: string | undefined;
  /** The class of a section's box, which sets its header and the line above it. */
  readonly sectionClass: string | undefined;
  /** The buttons after the last row. */
  readonly footer: ReactNode;
}
