import {useState} from 'react';
import type {MediaEntry} from './mediaEntries';

/**
 * The tiles chosen with Ctrl and Shift beside the selected one: Ctrl adds or
 * takes one, Shift takes the range from the selected tile.
 */
export function useMediaPicks({
  entries,
  selected,
  setSelected,
}: {
  readonly entries: readonly MediaEntry[];
  readonly selected: string | null;
  readonly setSelected: (id: string | null) => void;
}) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const index = entries.findIndex(({id}) => id === selected);
  const pick = (at: number, range: boolean): void => {
    const entry = entries[at];
    if (entry === undefined) return;
    if (range) {
      const from = index < 0 ? at : index;
      const ids = entries
        .slice(Math.min(from, at), Math.max(from, at) + 1)
        .map(({id}) => id);
      setPicked(new Set(ids));
      if (index < 0) setSelected(entry.id);
      return;
    }
    const base = new Set(
      picked.size === 0 && selected !== null ? [selected] : picked,
    );
    if (base.has(entry.id)) base.delete(entry.id);
    else base.add(entry.id);
    setPicked(base);
    setSelected(entry.id);
  };
  return {
    picked,
    index,
    /** Selects one tile alone. */
    select: (id: string | null): void => {
      setPicked(new Set());
      setSelected(id);
    },
    pick,
    clear: (): void => setPicked(new Set()),
    isChosen: (id: string): boolean =>
      picked.size === 0 ? selected === id : picked.has(id),
  };
}
