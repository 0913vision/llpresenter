import {
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type {Slide} from '@core/schema/slide';
import {changeSlides, withLabel} from '@core/slides';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {contextMenuAnchor, isContextMenuKey} from '@renderer/ui/contextMenu';
import {isComposing} from '@renderer/ui/ime';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useReflow} from '@renderer/ui/useReflow';
import {
  addReason,
  copySelected,
  deleteSelected,
  pasteInto,
  selectionReason,
} from './deckCommands';
import {
  focusedSlide,
  selectInDeck,
  selectionOf,
  useDeckSelection,
} from './deckSelection';
import {emptySlideGap} from './gridInsertionPosition';
import type {SlideDeck} from './slideDeck';
import {slideIdAt, slideMove, slideRow} from './slideKeys';
import {slideMenuEntries} from './slideMenu';
import {useSlideCommands} from './useSlideCommands';
import {useSlideDrag} from './useSlideDrag';
import styles from './SlideEditor.module.css';

function plainKey(event: {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
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
  const [menu, setMenu] = useState<{
    readonly anchor: MenuAnchor;
    readonly addAt: number;
  } | null>(null);
  const count = selection.ids.size;
  const focused = focusedSlide(deck, selection);
  const slideOf = (id: string | undefined): Slide | undefined =>
    id === undefined ? undefined : deck.slides.find(slide => slide.id === id);
  const rowOf = (id: string | undefined): HTMLElement | null =>
    slideRow(surface.current, id);
  const focusedRow = (): HTMLElement | null =>
    rowOf(focused?.id) ?? surface.current;
  const [labelAnchor, setLabelAnchor] = useState<HTMLElement | null>(null);
  /** Opens the 이름표 menu on the focused slide once the slide menu closed. */
  const labelsAfterMenu = useMenuHandoff<true>(menu !== null, () =>
    setLabelAnchor(focusedRow()),
  );
  const dragClick = useDragClickGuard();
  useReflow(surface, {
    ids: deck.slides.map(slide => slide.id),
    selector: '[data-song-slide]',
    attribute: 'data-song-slide',
    scope: deck.id,
  });
  const commands = useSlideCommands({
    deck,
    surface: () => surface.current,
    count,
    openLabels: () => setLabelAnchor(focusedRow()),
  });
  const {focusSurface} = commands;
  const drag = useSlideDrag({
    deck,
    surface,
    onDragged: dragClick.markDragged,
  });

  const openMenu = (anchor: MenuAnchor, id: string | undefined): void => {
    const slide = slideOf(id);
    if (slide !== undefined && !selection.ids.has(slide.id)) {
      selectInDeck(deck, {type: 'click', id: slide.id});
    }
    const ids = selectionOf(deck).ids;
    setMenu({
      anchor: {
        ...anchor,
        targets:
          slide === undefined
            ? []
            : [
                ...(surface.current?.querySelectorAll<HTMLElement>(
                  '[data-song-slide]',
                ) ?? []),
              ].filter(row => {
                const rowId = row.dataset['songSlide'];
                return (
                  rowId !== undefined && [...ids].some(own => own === rowId)
                );
              }),
      },
      addAt:
        slide === undefined
          ? deck.slides.length
          : deck.slides.indexOf(slide) + 1,
    });
  };

  /** A click on the ground between slides puts the caret there. */
  const clickGround = (event: MouseEvent<HTMLDivElement>): boolean => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    ) {
      return false;
    }
    const viewport = event.target.closest<HTMLElement>('[data-view]');
    if (
      viewport === null ||
      !event.currentTarget.contains(viewport) ||
      event.target.closest(
        '[data-song-slide], [data-slide-gap], button, input, textarea, select',
      ) !== null
    ) {
      return false;
    }
    selectInDeck(deck, {
      type: 'gap',
      index: emptySlideGap(viewport, {
        x: event.clientX,
        y: event.clientY,
        count: deck.slides.length,
      }),
    });
    focusSurface();
    return true;
  };

  const keyDownCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented || isComposing(event)) return;
    const inText = isInTextEntry(event.target);
    if (event.key === ' ' && plainKey(event) && !inText) {
      const own =
        event.target === event.currentTarget ||
        (event.target instanceof Element &&
          event.target.matches('[data-song-slide]'));
      if (!own) return;
      event.preventDefault();
      event.stopPropagation();
      const slide = slideOf(slideIdAt(event.target)) ?? focused;
      if (!event.repeat && slide !== undefined && selection.caret === null) {
        selectInDeck(deck, {type: 'click', id: slide.id, ctrl: true});
      }
      return;
    }
    if (event.key === 'Escape' && plainKey(event) && inText) {
      const slide = slideOf(slideIdAt(event.target));
      if (slide === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      focusSurface();
      selectInDeck(deck, {type: 'click', id: slide.id});
      return;
    }
    if (!isContextMenuKey(event) || inText) return;
    const target =
      event.target instanceof HTMLElement ? event.target : event.currentTarget;
    event.preventDefault();
    event.stopPropagation();
    const id = slideIdAt(target) ?? focused?.id;
    openMenu({kind: 'element', element: rowOf(id) ?? target}, id);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.defaultPrevented ||
      isComposing(event) ||
      isInTextEntry(event.target) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    const move = slideMove(event.key, event.shiftKey, {
      slides: deck.slides,
      selection,
      focused,
      columns: Number(
        surface.current?.querySelector<HTMLElement>('[data-slide-columns]')
          ?.dataset['slideColumns'] ?? 1,
      ),
    });
    if (move === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    focusSurface();
    if (move.kind === 'back') onBack?.();
    else selectInDeck(deck, move.action);
  };

  return (
    <div
      {...dragClick.props}
      ref={surface}
      className={styles.surface}
      tabIndex={0}
      role="group"
      aria-label="슬라이드 편집 명령"
      data-slide-surface
      onCopy={event => {
        if (isInTextEntry(event.target)) return;
        const text = copySelected(deck);
        if (text === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.setData('text/plain', text);
      }}
      onCut={event => {
        if (isInTextEntry(event.target)) return;
        const text = copySelected(deck);
        if (text === null || selectionReason(deck) !== undefined) return;
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.setData('text/plain', text);
        focusSurface();
        deleteSelected(deck);
      }}
      onPaste={event => {
        if (isInTextEntry(event.target) || addReason(deck) !== undefined) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        focusSurface();
        pasteInto(deck, event.clipboardData.getData('text/plain'));
      }}
      onPointerDownCapture={event => {
        dragClick.props.onPointerDownCapture();
        if (
          event.button === 0 &&
          slideIdAt(event.target) !== undefined &&
          event.target instanceof Element &&
          !isInTextEntry(event.target) &&
          event.target.closest('button') === null
        ) {
          focusSurface();
        }
      }}
      onClickCapture={event => {
        dragClick.props.onClickCapture(event);
        if (event.defaultPrevented || !clickGround(event)) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDownCapture={keyDownCapture}
      onKeyDown={keyDown}
      onContextMenu={event => {
        if (isInTextEntry(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        focusSurface();
        openMenu(contextMenuAnchor(event), slideIdAt(event.target));
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
          onChoose={label => {
            const {ids} = selectionOf(deck);
            deck.edit(slides =>
              changeSlides(slides, ids, slide => withLabel(slide, label)),
            );
          }}
          onClose={() => setLabelAnchor(null)}
        />
      )}
      {menu === null ? null : (
        <Menu
          context
          label="슬라이드"
          anchor={menu.anchor}
          entries={slideMenuEntries({
            deck,
            count,
            addAt: menu.addAt,
            extra:
              extraMenu?.(
                deck.slides.findIndex(slide => slide.id === focused?.id),
              ) ?? [],
            hotKey:
              onHotKey === undefined || count !== 1 || focused === undefined
                ? undefined
                : () => onHotKey(focused),
            label: catalog === null ? undefined : () => labelsAfterMenu(true),
            commands,
          })}
          onClose={() => {
            setMenu(null);
            focusSurface();
          }}
        />
      )}
    </div>
  );
}
