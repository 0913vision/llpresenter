import {
  useRef,
  useState,
  type JSX,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type {Slide} from '@core/schema/slide';
import {changeSlides, withLabel} from '@core/slides';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {contextMenuAnchor} from '@renderer/ui/contextMenu';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useReflow} from '@renderer/ui/useReflow';
import {
  focusedSlide,
  selectInDeck,
  selectionOf,
  useDeckSelection,
} from './deckSelection';
import {emptySlideGap} from './gridInsertionPosition';
import type {SlideDeck} from './slideDeck';
import {slideIdAt, slideRow} from './slideKeys';
import {slideMenuEntries} from './slideMenu';
import {useDeckClipboard} from './useDeckClipboard';
import {useSlideCommands} from './useSlideCommands';
import {useSlideDrag} from './useSlideDrag';
import {useSlideMenu} from './useSlideMenu';
import {useSlideSurfaceKeys} from './useSlideSurfaceKeys';
import styles from './SlideEditor.module.css';

/**
 * The gap that a plain click on the ground between slides points at, or null
 * for a click on a slide, a control, or outside the slides.
 */
function clickedGap(
  event: MouseEvent<HTMLDivElement>,
  count: number,
): number | null {
  const modified =
    event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  if (event.button !== 0 || modified || !(event.target instanceof Element)) {
    return null;
  }
  const viewport = event.target.closest<HTMLElement>('[data-view]');
  const onSomething =
    event.target.closest(
      '[data-song-slide], [data-slide-gap], button, input, textarea, select',
    ) !== null;
  if (
    viewport === null ||
    !event.currentTarget.contains(viewport) ||
    onSomething
  ) {
    return null;
  }
  return emptySlideGap(viewport, {
    x: event.clientX,
    y: event.clientY,
    count,
  });
}

/** Whether a press lands on a slide itself, not on its text or a button. */
function pressesSlide(event: PointerEvent<HTMLDivElement>): boolean {
  return (
    event.button === 0 &&
    slideIdAt(event.target) !== undefined &&
    event.target instanceof Element &&
    !isInTextEntry(event.target) &&
    event.target.closest('button') === null
  );
}

/** Every command of a list of slides, whichever way the list is laid out. */
export function SlideSurface({
  deck,
  children,
  onBack,
  onHotKey,
  extraMenu,
}: {
  readonly deck: SlideDeck;
  readonly children: ReactNode;
  readonly onBack?: (() => void) | undefined;
  readonly onHotKey?: ((slide: Slide) => void) | undefined;
  /** Entries of the kind of item, above the ones every list has. */
  readonly extraMenu?: ((index: number) => readonly MenuEntry[]) | undefined;
}): JSX.Element {
  const selection = useDeckSelection(deck);
  const catalog = useLabelCatalog();
  const surface = useRef<HTMLDivElement>(null);
  const count = selection.ids.size;
  const focused = focusedSlide(deck, selection);
  const focusedRow = (): HTMLElement | null =>
    slideRow(surface.current, focused?.id) ?? surface.current;
  useReflow(surface, {
    ids: deck.slides.map(slide => slide.id),
    selector: '[data-song-slide]',
    attribute: 'data-song-slide',
    scope: deck.id,
  });

  const menu = useSlideMenu(deck, surface);
  const [labelAnchor, setLabelAnchor] = useState<HTMLElement | null>(null);
  /** Opens the 이름표 menu on the focused slide once the slide menu closed. */
  const labelsAfterMenu = useMenuHandoff<true>(menu.menu !== null, () =>
    setLabelAnchor(focusedRow()),
  );
  const commands = useSlideCommands({
    deck,
    surface: () => surface.current,
    count,
    openLabels: () => setLabelAnchor(focusedRow()),
  });
  const {focusSurface} = commands;
  const keys = useSlideSurfaceKeys({
    deck,
    selection,
    focused,
    surface,
    focusSurface,
    openMenu: menu.open,
    onBack,
  });
  const dragClick = useDragClickGuard();
  const drag = useSlideDrag({
    deck,
    surface,
    onDragged: dragClick.markDragged,
  });
  const clipboard = useDeckClipboard(deck, focusSurface);

  const labelChosen = (label: string | undefined): void => {
    const {ids} = selectionOf(deck);
    deck.edit(slides =>
      changeSlides(slides, ids, slide => withLabel(slide, label)),
    );
  };
  const focusedIndex = deck.slides.findIndex(slide => slide.id === focused?.id);
  return (
    <div
      {...dragClick.props}
      ref={surface}
      className={styles.surface}
      tabIndex={0}
      role="group"
      aria-label="슬라이드 편집 명령"
      data-slide-surface
      {...clipboard}
      onPointerDownCapture={event => {
        dragClick.props.onPointerDownCapture();
        if (pressesSlide(event)) focusSurface();
      }}
      onClickCapture={event => {
        dragClick.props.onClickCapture(event);
        if (event.defaultPrevented) return;
        // NOTE(0913vision): A click on the ground between slides puts the
        // caret there.
        const gap = clickedGap(event, deck.slides.length);
        if (gap === null) return;
        selectInDeck(deck, {type: 'gap', index: gap});
        focusSurface();
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDownCapture={keys.onKeyDownCapture}
      onKeyDown={keys.onKeyDown}
      onContextMenu={event => {
        if (isInTextEntry(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        focusSurface();
        menu.open(contextMenuAnchor(event), slideIdAt(event.target));
      }}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
      onDragEnd={drag.onDragEnd}
    >
      {children}
      {catalog === null || labelAnchor === null ? null : (
        <LabelMenu
          store={catalog}
          anchor={labelAnchor}
          selected={focused?.label}
          onChoose={labelChosen}
          onClose={() => setLabelAnchor(null)}
        />
      )}
      {menu.menu === null ? null : (
        <Menu
          context
          label="슬라이드"
          anchor={menu.menu.anchor}
          entries={slideMenuEntries({
            deck,
            count,
            addAt: menu.menu.addAt,
            extra: extraMenu?.(focusedIndex) ?? [],
            hotKey:
              onHotKey === undefined || count !== 1 || focused === undefined
                ? undefined
                : () => onHotKey(focused),
            label: catalog === null ? undefined : () => labelsAfterMenu(true),
            commands,
          })}
          onClose={() => {
            menu.close();
            focusSurface();
          }}
        />
      )}
    </div>
  );
}
