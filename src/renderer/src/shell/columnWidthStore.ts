import type {ColumnWidths, SizeClass} from './sizeClass';

/** Remembers the column widths that the operator set, per size class. */
export interface ColumnWidthStore {
  load(sizeClass: SizeClass): ColumnWidths | undefined;
  save(sizeClass: SizeClass, widths: ColumnWidths): void;
}

// TODO(0913vision): Replace this with a store that keeps the widths in
// `app.json` through the main process (`layout.narrow`, `layout.normal`,
// `layout.wide`).
export function createMemoryColumnWidthStore(): ColumnWidthStore {
  const saved = new Map<SizeClass, ColumnWidths>();
  return {
    load: sizeClass => saved.get(sizeClass),
    save: (sizeClass, widths) => {
      saved.set(sizeClass, widths);
    },
  };
}
