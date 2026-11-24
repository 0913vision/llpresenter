import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {type ScreenRow} from '@core/screens';
import {
  designRowHeight,
  optionKeyTarget,
  rowRange,
  scrollIntoBand,
  useFocusOption,
} from '@renderer/ui/lists/useRowRange';
import {SCREEN_KIND_ORDER} from '@core/schema/screens/screens';

const INITIAL_ROWS = 12;
const OVERSCAN = 4;
type SectionKind = (typeof SCREEN_KIND_ORDER)[number];
interface Section {
  readonly kind: SectionKind;
  readonly rows: readonly ScreenRow[];
}

/** The scroll of the panel and where each group's rows start in it. */
interface View {
  readonly top: number;
  readonly height: number;
  readonly row: number;
  readonly offsets: Readonly<Record<SectionKind, number>>;
}

const NO_OFFSETS = {audience: 0, broadcast: 0, stage: 0};

function sameView(a: View, b: View): boolean {
  return (
    a.top === b.top &&
    a.height === b.height &&
    a.row === b.row &&
    SCREEN_KIND_ORDER.every(kind => a.offsets[kind] === b.offsets[kind])
  );
}

/** Reads the panel's scroll and the top of each group's rows inside it. */
function readView(
  root: RefObject<HTMLElement | null>,
  anchors: RefObject<Readonly<Record<SectionKind, HTMLElement | null>>>,
): View | null {
  const list = root.current;
  const viewport = list?.parentElement;
  if (!list || !viewport) return null;
  const offset = (kind: SectionKind): number => {
    const anchor = anchors.current[kind];
    if (viewport.clientHeight === 0 || anchor === null) return 0;
    return (
      anchor.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop
    );
  };
  return {
    top: viewport.scrollTop,
    height: viewport.clientHeight,
    row: designRowHeight(list) || 30,
    offsets: {
      audience: offset('audience'),
      broadcast: offset('broadcast'),
      stage: offset('stage'),
    },
  };
}

/**
 * Windows the rows of each screen group against the scroll of the panel
 * around `root`, while the arrow keys move over every row of every group.
 */
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
  const focusLater = useFocusOption(root);
  const [view, setView] = useState<View>({
    top: 0,
    height: 0,
    row: 0,
    offsets: NO_OFFSETS,
  });
  const measure = useCallback(() => {
    const next = readView(root, anchors);
    if (next !== null) {
      setView(old => (sameView(old, next) ? old : next));
    }
  }, [root]);
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
  const range = (kind: SectionKind) =>
    rowRange(
      {...view, top: view.top - view.offsets[kind]},
      sections.find(section => section.kind === kind)?.rows.length ?? 0,
      {initialRows: INITIAL_ROWS, overscan: OVERSCAN},
    );
  const ranges = {
    audience: range('audience'),
    broadcast: range('broadcast'),
    stage: range('stage'),
  };
  const {row, offsets} = view;
  /** Scrolls the panel the least that shows screen `id`. */
  const show = (id: string): void => {
    const viewport = root.current?.parentElement;
    const section = sections.find(group =>
      group.rows.some(item => item.id === id),
    );
    if (!viewport || section === undefined || row === 0) return;
    const index = section.rows.findIndex(item => item.id === id);
    if (scrollIntoBand(viewport, offsets[section.kind] + index * row, row)) {
      measure();
    }
  };
  const showSelected = useEffectEvent(show);
  // NOTE(0913vision): Only a new selection or a moved group scrolls; scrolling
  // away from the selected screen stays.
  const {audience, broadcast, stage} = offsets;
  useLayoutEffect(() => {
    if (selected !== undefined) showSelected(selected);
  }, [selected, audience, broadcast, stage, row]);
  const navigate = (event: KeyboardEvent): void => {
    const option =
      event.target instanceof Element
        ? event.target.closest('[role="option"][data-value]')
        : null;
    if (option === null) return;
    const target = optionKeyTarget(
      event,
      sections.flatMap(section => section.rows.map(item => item.id)),
      selected,
    );
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    focusLater(target.id);
    show(target.id);
    select(target.id);
  };
  const setAnchor = (
    kind: SectionKind,
    element: HTMLDivElement | null,
  ): void => {
    anchors.current[kind] = element;
  };
  return {ranges, navigate, setAnchor};
}
