import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {isUnchangedSelectionMove} from '@core/common/selectionOrder';
import type {Slide} from '@core/schema/slide';
import {changeSlides, withLabel} from '@core/slides/edits';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {contextMenuAnchor, isContextMenuKey} from '@renderer/ui/contextMenu';
import {isComposing} from '@renderer/ui/ime';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {selectionDragImage, selectionLabel} from '@renderer/ui/selectionDrag';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useReflow} from '@renderer/ui/useReflow';
import {useSelectionDelete} from '@renderer/ui/useSelectionDelete';
import {
  addReason,
  addSlide,
  copyReason,
  copySelected,
  deleteSelected,
  duplicateSelected,
  moveSelected,
  pasteInto,
  selectionReason,
} from './deckCommands';
import {
  focusedSlide,
  selectInDeck,
  selectionOf,
  useDeckSelection,
} from './deckSelection';
import {emptySlideGap, slideDropPosition} from './gridInsertionPosition';
import {clipboardText} from './slideClipboard';
import type {SlideDeck} from './slideDeck';
import styles from './SlideEditor.module.css';

export const SLIDE_DRAG = 'application/x-llp-song-slide-move';
const NOTHING_TO_UNDO = '실행 취소할 변경이 없습니다';
const NOTHING_TO_REDO = '다시 실행할 변경이 없습니다';

function slideIdAt(target: EventTarget | null): string | undefined {
  return target instanceof Element
    ? target.closest<HTMLElement>('[data-song-slide]')?.dataset['songSlide']
    : undefined;
}

function plainKey(event: KeyboardEvent): boolean {
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
  const [labelAnchor, setLabelAnchor] = useState<HTMLElement | null>(null);
  const labelAfterMenu = useMenuHandoff(menu !== null, setLabelAnchor);
  const deletion = useSelectionDelete();
  const dragClick = useDragClickGuard();
  const releaseDrag = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => releaseDrag.current?.(), []);
  useReflow(surface, {
    ids: deck.slides.map(slide => slide.id),
    selector: '[data-song-slide]',
    attribute: 'data-song-slide',
    scope: deck.id,
  });
  const count = selection.ids.size;
  const focused = focusedSlide(deck, selection);

  const focusSurface = (): void =>
    surface.current?.focus({preventScroll: true});
  const slideOf = (id: string | undefined): Slide | undefined =>
    id === undefined ? undefined : deck.slides.find(slide => slide.id === id);
  const rowOf = (id: string | undefined): HTMLElement | null =>
    id === undefined
      ? null
      : (surface.current?.querySelector<HTMLElement>(
          `[data-song-slide="${CSS.escape(id)}"]`,
        ) ?? null);
  const columns = (): number =>
    Number(
      surface.current?.querySelector<HTMLElement>('[data-slide-columns]')
        ?.dataset['slideColumns'] ?? 1,
    );

  const paste = (): void => {
    if (addReason(deck) !== undefined) return;
    focusSurface();
    clipboardText().then(
      text => {
        if (
          surface.current?.contains(document.activeElement) === true &&
          !isInTextEntry(document.activeElement)
        ) {
          pasteInto(deck, text);
        }
      },
      (error: unknown) => console.error('Could not read the clipboard', error),
    );
  };
  const cut = (): void => {
    if (selectionReason(deck) !== undefined) return;
    focusSurface();
    copySelected(deck);
    deleteSelected(deck);
  };
  const remove = (): void => {
    if (selectionReason(deck) !== undefined) return;
    const {slides} = deck;
    deletion.ask(
      count,
      () => deck.slides === slides && !deck.readOnly,
      () => {
        focusSurface();
        deleteSelected(deck);
      },
    );
  };
  const replay = (kind: 'undo' | 'redo'): void => {
    focusSurface();
    deck.replay(kind);
  };
  const replayReason = (kind: 'undo' | 'redo'): string | undefined => {
    if (deck.readOnly) return NEWER_FILE_REASON;
    if (kind === 'undo') return deck.canUndo ? undefined : NOTHING_TO_UNDO;
    return deck.canRedo ? undefined : NOTHING_TO_REDO;
  };
  const owns = (event: globalThis.KeyboardEvent): boolean =>
    event.target instanceof Node &&
    surface.current?.contains(event.target) === true &&
    !isInTextEntry(event.target);
  useWindowShortcuts([
    {
      id: 'editor.labelMenu',
      context: 'song',
      when: owns,
      unavailable: () => selectionReason(deck),
      run: () => setLabelAnchor(rowOf(focused?.id) ?? surface.current),
    },
    {
      id: 'edit.copy',
      fixedBindings: [{code: 'KeyC', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      unavailable: () => copyReason(deck),
      run: () => copySelected(deck),
    },
    {
      id: 'edit.cut',
      fixedBindings: [{code: 'KeyX', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      unavailable: () => selectionReason(deck),
      run: cut,
    },
    {
      id: 'edit.paste',
      fixedBindings: [{code: 'KeyV', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      unavailable: () => addReason(deck),
      run: paste,
    },
    {
      id: 'edit.selectAll',
      fixedBindings: [{code: 'KeyA', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      run: () => selectInDeck(deck, {type: 'all'}),
    },
    {
      id: 'edit.duplicate',
      context: 'song',
      when: owns,
      unavailable: () => selectionReason(deck) ?? addReason(deck, count),
      run: () => duplicateSelected(deck),
    },
    {
      id: 'edit.delete',
      context: 'song',
      when: owns,
      unavailable: () => selectionReason(deck),
      run: remove,
    },
    {
      id: 'edit.undo',
      context: 'song',
      when: owns,
      unavailable: () => replayReason('undo'),
      run: () => replay('undo'),
    },
    {
      id: 'edit.redo',
      context: 'song',
      when: owns,
      unavailable: () => replayReason('redo'),
      run: () => replay('redo'),
    },
  ]);

  const entries: readonly MenuEntry[] = [
    {
      kind: 'item',
      id: 'add-slide',
      label: '슬라이드 추가',
      ...menuAvailability(addReason(deck)),
      onSelect: () => addSlide(deck, menu?.addAt),
    },
    ...(extraMenu?.(deck.slides.findIndex(slide => slide.id === focused?.id)) ??
      []),
    ...(onHotKey === undefined || count !== 1 || focused === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'hot-key',
            label: '단축키…',
            ...menuAvailability(selectionReason(deck)),
            onSelect: () => onHotKey(focused),
          },
        ]),
    ...(catalog === null
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'label',
            label: '이름표',
            command: 'editor.labelMenu' as const,
            ...menuAvailability(selectionReason(deck)),
            onSelect: () =>
              labelAfterMenu(rowOf(focused?.id) ?? surface.current),
          },
        ]),
    {
      kind: 'item',
      id: 'copy',
      contextGroup: 'clipboard',
      label: selectionLabel('복사', count),
      meta: 'Ctrl C',
      ...menuAvailability(copyReason(deck)),
      onSelect: () => copySelected(deck),
    },
    {
      kind: 'item',
      id: 'cut',
      contextGroup: 'clipboard',
      label: selectionLabel('잘라내기', count),
      meta: 'Ctrl X',
      ...menuAvailability(selectionReason(deck)),
      onSelect: cut,
    },
    {
      kind: 'item',
      id: 'paste',
      contextGroup: 'clipboard',
      label: '붙여넣기',
      meta: 'Ctrl V',
      ...menuAvailability(addReason(deck)),
      onSelect: paste,
    },
    {
      kind: 'item',
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: selectionLabel('복제', count),
      meta: 'Ctrl D',
      ...menuAvailability(selectionReason(deck) ?? addReason(deck, count)),
      onSelect: () => duplicateSelected(deck),
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: selectionLabel('삭제', count),
      meta: 'Delete',
      ...menuAvailability(selectionReason(deck)),
      onSelect: remove,
    },
    {kind: 'separator', id: 'history'},
    {
      kind: 'item',
      id: 'undo',
      contextGroup: 'clipboard',
      label: '실행 취소',
      meta: 'Ctrl Z',
      ...menuAvailability(replayReason('undo')),
      onSelect: () => replay('undo'),
    },
    {
      kind: 'item',
      id: 'redo',
      contextGroup: 'clipboard',
      label: '다시 실행',
      meta: 'Ctrl Y',
      ...menuAvailability(replayReason('redo')),
      onSelect: () => replay('redo'),
    },
  ];
  const openMenu = (anchor: MenuAnchor, id: string | undefined): void => {
    const slide = slideOf(id);
    if (slide !== undefined && !selection.ids.has(slide.id)) {
      selectInDeck(deck, {type: 'click', id: slide.id});
    }
    const ids = selectionOf(deck).ids;
    setMenu({
      anchor: {
        ...anchor,
        targets: [
          ...(surface.current?.querySelectorAll<HTMLElement>(
            '[data-song-slide]',
          ) ?? []),
        ].filter(
          row =>
            slide !== undefined &&
            row.dataset['songSlide'] !== undefined &&
            [...ids].some(own => own === row.dataset['songSlide']),
        ),
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

  const move = (event: KeyboardEvent): (() => void) | undefined => {
    const {key, shiftKey: shift} = event;
    if (key.startsWith('Arrow')) {
      const row = columns();
      const delta =
        key === 'ArrowUp'
          ? -row
          : key === 'ArrowDown'
            ? row
            : key === 'ArrowLeft'
              ? -1
              : 1;
      return () => selectInDeck(deck, {type: 'arrow', delta, shift});
    }
    if (key === 'Home' || key === 'End') {
      const index = key === 'Home' ? 0 : deck.slides.length - 1;
      const slide = deck.slides[index];
      return () =>
        selectInDeck(
          deck,
          selection.caret !== null || slide === undefined || count === 0
            ? {type: 'gap', index: key === 'Home' ? 0 : deck.slides.length}
            : {type: 'click', id: slide.id, shift},
        );
    }
    if (key === 'Escape') {
      return () => {
        if (count > 1 || selection.caret !== null) {
          if (focused === undefined) selectInDeck(deck, {type: 'clear'});
          else selectInDeck(deck, {type: 'click', id: focused.id});
        } else onBack?.();
      };
    }
    return undefined;
  };

  const dropIndex = (event: DragEvent<HTMLDivElement>): number | null => {
    const node =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            '[data-slide-gap], [data-slide-index]',
          )
        : null;
    return node === null
      ? null
      : slideDropPosition(node, event.clientX, event.clientY);
  };
  const clearDrop = (): void => {
    surface.current
      ?.querySelectorAll('[data-slide-drop]')
      .forEach(node => node.removeAttribute('data-slide-drop'));
  };
  const staysInPlace = (index: number): boolean =>
    isUnchangedSelectionMove(
      deck.slides.map(slide => slide.id),
      selectionOf(deck).ids,
      index,
    );

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
      onKeyDown={event => {
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
        const run = move(event);
        if (run === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        focusSurface();
        run();
      }}
      onContextMenu={event => {
        if (isInTextEntry(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        focusSurface();
        openMenu(contextMenuAnchor(event), slideIdAt(event.target));
      }}
      onDragStart={event => {
        const id = slideIdAt(event.target);
        const slide = slideOf(id);
        if (
          deck.readOnly ||
          isInTextEntry(event.target) ||
          slide === undefined
        ) {
          event.preventDefault();
          return;
        }
        if (!selection.ids.has(slide.id)) {
          selectInDeck(deck, {type: 'click', id: slide.id});
        }
        event.dataTransfer.setData(SLIDE_DRAG, deck.id);
        event.dataTransfer.effectAllowed = 'move';
        releaseDrag.current?.();
        releaseDrag.current = selectionDragImage(
          event.dataTransfer,
          rowOf(id) ?? event.currentTarget,
          selectionOf(deck).ids.size,
        );
        dragClick.markDragged();
      }}
      onDragOver={event => {
        if (deck.readOnly || !event.dataTransfer.types.includes(SLIDE_DRAG)) {
          return;
        }
        event.preventDefault();
        clearDrop();
        const index = dropIndex(event);
        if (index === null || staysInPlace(index)) return;
        surface.current
          ?.querySelector(`[data-slide-gap="${index}"]`)
          ?.setAttribute('data-slide-drop', '');
      }}
      onDrop={event => {
        if (
          deck.readOnly ||
          event.dataTransfer.getData(SLIDE_DRAG) !== deck.id
        ) {
          return;
        }
        const index = dropIndex(event);
        clearDrop();
        if (index === null || staysInPlace(index)) return;
        event.preventDefault();
        event.stopPropagation();
        moveSelected(deck, index);
      }}
      onDragEnd={() => {
        clearDrop();
        releaseDrag.current?.();
      }}
    >
      {children}
      {deletion.dialog}
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
          entries={entries}
          onClose={() => {
            setMenu(null);
            focusSurface();
          }}
        />
      )}
    </div>
  );
}
