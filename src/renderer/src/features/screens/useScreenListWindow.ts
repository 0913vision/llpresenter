import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type {ScreenRow} from '@core/screens/screenRows';
import {SCREEN_KIND_ORDER} from '@core/screens/screens';

const INITIAL_ROWS = 12;
const OVERSCAN = 4;
type SectionKind = (typeof SCREEN_KIND_ORDER)[number];
interface Section {
  readonly kind: SectionKind;
  readonly rows: readonly ScreenRow[];
}

function scrollTo(viewport: HTMLElement, top: number): void {
  viewport.scrollTop = top;
}

/** Window both groups against the containing panel while retaining full keyboard navigation. */
interface View {
  readonly top: number;
  readonly height: number;
  readonly row: number;
  readonly offsets: Readonly<Record<SectionKind, number>>;
}

function measureView(
  root: RefObject<HTMLDivElement | null>,
  anchors: RefObject<Record<SectionKind, HTMLDivElement | null>>,
  setView: Dispatch<SetStateAction<View>>,
): void {
  const viewport = root.current?.parentElement;
  if (viewport === null || viewport === undefined || root.current === null) {
    return;
  }
  const row =
    Number.parseFloat(
      getComputedStyle(root.current).getPropertyValue('--size-row'),
    ) || 30;
  const offset = (kind: SectionKind): number => {
    const anchor = anchors.current[kind];
    if (viewport.clientHeight === 0 || anchor === null) {
      return 0;
    }
    return (
      anchor.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop
    );
  };
  const next: View = {
    top: viewport.scrollTop,
    height: viewport.clientHeight,
    row,
    offsets: {
      audience: offset('audience'),
      broadcast: offset('broadcast'),
      stage: offset('stage'),
    },
  };
  setView(previous =>
    previous.top === next.top &&
    previous.height === next.height &&
    previous.row === next.row &&
    SCREEN_KIND_ORDER.every(
      kind => previous.offsets[kind] === next.offsets[kind],
    )
      ? previous
      : next,
  );
}

function revealScreen({
  root,
  sections,
  offsets,
  row,
  measure,
  id,
}: {
  readonly root: RefObject<HTMLDivElement | null>;
  readonly sections: readonly Section[];
  readonly offsets: Readonly<Record<SectionKind, number>>;
  readonly row: number;
  readonly measure: () => void;
  readonly id: string;
}): void {
  const viewport = root.current?.parentElement;
  const section = sections.find(group =>
    group.rows.some(item => item.id === id),
  );
  if (viewport === null || viewport === undefined || section === undefined) {
    return;
  }
  const index = section.rows.findIndex(item => item.id === id);
  const top = offsets[section.kind] + index * (row || 30);
  if (
    top < viewport.scrollTop ||
    top + (row || 30) >
      viewport.scrollTop + Math.max(viewport.clientHeight, row || 30)
  ) {
    scrollTo(viewport, Math.max(0, top - viewport.clientHeight / 2));
    measure();
  }
}

export function useScreenListWindow({
  root,
  sections,
  selected,
  select,
}: {
  readonly root: RefObject<HTMLDivElement | null>;
  readonly sections: readonly Section[];
  readonly selected: string | undefined;
  readonly select: (id: string) => void;
}) {
  const anchors = useRef<Record<SectionKind, HTMLDivElement | null>>({
    audience: null,
    broadcast: null,
    stage: null,
  });
  const focusNext = useRef<string | null>(null);
  const [view, setView] = useState<View>({
    top: 0,
    height: 0,
    row: 0,
    offsets: {audience: 0, broadcast: 0, stage: 0},
  });
  const measure = useCallback(
    () => measureView(root, anchors, setView),
    [root],
  );
  useLayoutEffect(() => {
    const viewport = root.current?.parentElement;
    if (viewport === undefined || viewport === null) {
      return undefined;
    }
    const onScroll = (): void => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        root.current?.contains(active)
      ) {
        active.blur();
      }
      measure();
    };
    viewport.addEventListener('scroll', onScroll);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(viewport);
    measure();
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [measure, root]);
  const lengths = sections.map(section => section.rows.length).join(',');
  useLayoutEffect(() => {
    measure();
  }, [measure, lengths]);
  const count =
    view.height > 0 && view.row > 0
      ? Math.ceil(view.height / view.row)
      : INITIAL_ROWS;
  const range = (kind: SectionKind) => {
    const length =
      sections.find(section => section.kind === kind)?.rows.length ?? 0;
    const start = Math.max(
      0,
      Math.min(
        Math.floor((view.top - view.offsets[kind]) / (view.row || 30)) -
          OVERSCAN,
        length - count,
      ),
    );
    return {start, end: Math.min(length, start + count + OVERSCAN * 2)};
  };
  const ranges = {
    audience: range('audience'),
    broadcast: range('broadcast'),
    stage: range('stage'),
  };
  const {row} = view;
  const {audience, broadcast, stage} = view.offsets;
  const reveal = useCallback(
    (id: string): void =>
      revealScreen({
        root,
        sections,
        offsets: {audience, broadcast, stage},
        row,
        measure,
        id,
      }),
    [root, sections, audience, broadcast, stage, row, measure],
  );
  const revealSelected = useEffectEvent(reveal);
  useLayoutEffect(() => {
    if (selected !== undefined) {
      revealSelected(selected);
    }
  }, [selected, audience, broadcast, stage, row]);
  useLayoutEffect(() => {
    if (focusNext.current === null) return;
    const row = root.current?.querySelector<HTMLElement>(
      `[role="option"][data-value="${focusNext.current}"]`,
    );
    if (row !== undefined && row !== null) {
      row.focus();
      focusNext.current = null;
    }
  });
  const navigate = (event: KeyboardEvent): void => {
    if (
      event.target instanceof HTMLInputElement ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const option =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[role="option"][data-value]')
        : null;
    if (option === null) return;
    const rows = sections.flatMap(section => section.rows);
    const index = rows.findIndex(row => row.id === option.dataset['value']);
    if (index < 0) return;
    const targets: Readonly<Record<string, number>> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: rows.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    const next = rows[Math.max(0, Math.min(target, rows.length - 1))];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    focusNext.current = next.id;
    reveal(next.id);
    select(next.id);
  };
  const setAnchor = (
    kind: SectionKind,
    element: HTMLDivElement | null,
  ): void => {
    anchors.current[kind] = element;
  };
  return {ranges, navigate, setAnchor};
}
