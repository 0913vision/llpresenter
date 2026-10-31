import {useState} from 'react';
import type {Label} from '@core/schema/labels';

interface LabelRow {
  readonly key: number;
  readonly label: Label;
  readonly renamingTo?: string | undefined;
}

/** Keeps a field's draft identity when a rename replaces its catalog name. */
export function useLabelRows(labels: readonly Label[]) {
  const [state, setState] = useState(() => ({
    catalog: labels,
    rows: labels.map((label, key): LabelRow => ({key, label})),
    nextKey: labels.length,
  }));
  if (state.catalog !== labels) {
    let nextKey = state.nextKey;
    const rows = labels.map(label => {
      const previous =
        state.rows.find(row => row.label.name === label.name) ??
        state.rows.find(
          row =>
            row.renamingTo === label.name &&
            !labels.some(item => item.name === row.label.name),
        );
      return {
        key: previous?.key ?? nextKey++,
        label,
        renamingTo:
          previous?.renamingTo === label.name
            ? undefined
            : previous?.renamingTo,
      };
    });
    setState({catalog: labels, rows, nextKey});
  }
  return {
    rows: state.rows,
    prepareRename: (key: number, to: string): void => {
      setState(current => ({
        ...current,
        rows: current.rows.map(row =>
          row.key === key ? {...row, renamingTo: to} : row,
        ),
      }));
    },
  };
}
