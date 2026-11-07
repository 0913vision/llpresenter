import {useRef, useState, type KeyboardEvent, type MouseEvent} from 'react';

interface Selection {
  readonly serviceId: string | null;
  readonly cursor: string | null;
  readonly anchor: string | null;
  readonly ids: readonly string[];
}
interface Modifiers {
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
}
const SINGLE: Modifiers = {ctrlKey: false, shiftKey: false};

/** Keeps the open item as the cursor while selecting rows for item commands. */
export function useServiceItemSelection({
  serviceId,
  cursor,
  ids,
  onSelect,
}: {
  readonly serviceId: string | null;
  readonly cursor: string | null;
  readonly ids: readonly string[];
  readonly onSelect: (id: string) => void;
}) {
  const [choice, setChoice] = useState<Selection | null>(null);
  const modifiers = useRef<Modifiers>(SINGLE);
  const current =
    choice?.serviceId === serviceId && choice.cursor === cursor ? choice : null;
  const selected = new Set(
    (current?.ids ?? (cursor === null ? [] : [cursor])).filter(id =>
      ids.includes(id),
    ),
  );
  const replace = (values: readonly string[], next: string): void => {
    setChoice({
      serviceId,
      cursor: next,
      anchor: values[0] ?? next,
      ids: values,
    });
    onSelect(next);
  };
  const choose = (id: string, keys: Modifiers): void => {
    const anchor = current?.anchor ?? cursor ?? id;
    const start = ids.indexOf(anchor);
    const end = ids.indexOf(id);
    if (keys.shiftKey && start >= 0 && end >= 0) {
      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      setChoice({
        serviceId,
        cursor: id,
        anchor,
        ids: keys.ctrlKey ? [...new Set([...selected, ...range])] : range,
      });
    } else if (keys.ctrlKey) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      setChoice({serviceId, cursor: id, anchor: id, ids: [...selected]});
    } else {
      setChoice({serviceId, cursor: id, anchor: id, ids: [id]});
    }
    onSelect(id);
  };
  return {
    selected,
    replace,
    select: (id: string): void => {
      const keys = modifiers.current;
      modifiers.current = SINGLE;
      choose(id, keys);
    },
    captureClick: (event: MouseEvent): void => {
      modifiers.current = {ctrlKey: event.ctrlKey, shiftKey: event.shiftKey};
    },
    captureKey: (event: KeyboardEvent): void => {
      modifiers.current = SINGLE;
      if (
        !event.shiftKey ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        !(event.target instanceof HTMLElement) ||
        !event.target.matches('[role="option"]')
      ) {
        return;
      }
      const index = ids.indexOf(event.target.dataset['value'] ?? '');
      const next =
        event.key === 'ArrowDown'
          ? ids[Math.min(ids.length - 1, index + 1)]
          : event.key === 'ArrowUp'
            ? ids[Math.max(0, index - 1)]
            : event.key === 'Home'
              ? ids[0]
              : event.key === 'End'
                ? ids.at(-1)
                : undefined;
      if (next === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      choose(next, event);
      [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')]
        .find(row => row.dataset['value'] === next)
        ?.focus();
    },
  };
}
