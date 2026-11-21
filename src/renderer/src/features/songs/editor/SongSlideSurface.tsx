import {isUnchangedSelectionMove} from '@core/common/selectionOrder';
import {useSelectionDelete} from '@renderer/ui/useSelectionDelete';
import {useReflow} from '@renderer/ui/useReflow';
import {selectionLabel, selectionDragImage} from '@renderer/ui/selectionDrag';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
  type DragEvent,
} from 'react';
import type {SlideListItem} from '@core/songs/slideListEdits';
import type {LeadingSlideCard} from './SlideCardRenderer';
import {emptySlideGap, slideDropPosition} from './gridInsertionPosition';
import {selectedSlideAnchor} from './selectedSlideAnchor';

import {isInTextEntry} from '@renderer/ui/textEntry';
import {isComposing} from '@renderer/ui/ime';
import {contextMenuAnchor, isContextMenuKey} from '@renderer/ui/contextMenu';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import type {SlideListSession} from './slideListSession';
import {
  adaptItemEditor,
  type ItemEditorKind,
} from '@renderer/platform/itemEditorAdapter';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';
import {LabelMenu} from './LabelMenu';
import type {SongEditorStore} from './songEditorStore';
import {readSlideText, writeSlideText} from './systemSlideClipboard';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import type {Notice} from '@renderer/ui/notices';

/** Rows and thumbnails dispatch to the same session, including its insertion caret. */
export function SongSlideSurface<T extends SlideListItem>({
  session,
  children,
  className,
  onBack,
  store,
  onEdit,
  onHotKey,
  extraMenu,
  onAdd,
  blocked = false,
  editLabel = windowCommandLabels.editSong,
  leadingCard,
  contentReadOnly = false,
  deleteSelection,
  mixedLeadingSelection = leadingCard?.mixedSelection ?? false,
  itemKind,
  initialLeadingSelected = false,
}: {
  readonly session: SlideListSession<T>;
  readonly itemKind: ItemEditorKind;
  readonly initialLeadingSelected?: boolean;
  readonly children: ReactNode;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly contentReadOnly?: boolean | undefined;
  readonly deleteSelection?:
    ((includeLeadingCard: boolean) => void) | undefined;
  readonly mixedLeadingSelection?: boolean;
  readonly className?: string | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly store?: SongEditorStore | undefined;
  readonly report?: ((notice: Notice) => void) | undefined;
  readonly onEdit?: ((index: number) => void) | undefined;
  readonly onHotKey?: ((index: number) => void) | undefined;
  readonly extraMenu?: (index: number) => readonly MenuEntry[];
  readonly onAdd?: ((index: number) => void) | undefined;
  readonly blocked?: boolean;
  readonly editLabel?: string;
}): JSX.Element {
  const readOnly = blocked || session.readOnly;
  const contentLocked = readOnly || contentReadOnly;
  const editReason = readOnly ? NEWER_FILE_REASON : undefined;
  const contentEditReason =
    editReason ??
    (contentReadOnly ? '성경 구절은 편집할 수 없습니다' : undefined);
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const [cardSelection, setCardSelection] = useState({
    documentId: session.slideDocumentId,
    selected: initialLeadingSelected,
  });
  if (cardSelection.documentId !== session.slideDocumentId) {
    setCardSelection({
      documentId: session.slideDocumentId,
      selected: initialLeadingSelected,
    });
  }
  const leadingSelected =
    leadingCard !== undefined &&
    cardSelection.documentId === session.slideDocumentId &&
    cardSelection.selected;
  const adapter = adaptItemEditor({
    kind: itemKind,
    session,
    view,
    hasCard: leadingCard !== undefined,
    cardSelected: leadingSelected,
    blocked,
  });
  const selectCard = (preserve = false): void => {
    if (leadingCard === undefined) return;
    if (leadingSelected) {
      if (!preserve) adapter.select({type: 'clear'});
      return;
    }
    if (!preserve) adapter.select({type: 'clear'});
    setCardSelection({documentId: session.slideDocumentId, selected: true});
    leadingCard.onSelectChange?.(true);
  };
  const clearCard = (): void => {
    if (!leadingSelected) return;
    setCardSelection({documentId: session.slideDocumentId, selected: false});
    leadingCard.onSelectChange?.(false);
  };
  const extendLeadingRange = (shift: boolean): void => {
    if (
      !mixedLeadingSelection ||
      !leadingSelected ||
      !shift ||
      view.selection.ids.size > 0
    ) {
      return;
    }
    const first = view.slides[0];
    if (first !== undefined) {
      leadingCard.onSelectChange?.(true);
      adapter.select({type: 'click', id: first.id});
    }
  };
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const menuTargets = (
    surface: HTMLElement,
    id: string | undefined,
  ): HTMLElement[] => {
    if (id === undefined) return [];
    const ids = adapter.selectedSlideIds.has(id)
      ? adapter.selectedSlideIds
      : new Set([id]);
    return [
      ...surface.querySelectorAll<HTMLElement>('[data-song-slide]'),
    ].filter(
      row =>
        row.dataset.songSlide !== undefined && ids.has(row.dataset.songSlide),
    );
  };
  const [menuIndex, setMenuIndex] = useState(0);
  const [addIndex, setAddIndex] = useState(0);
  const [labelAnchor, setLabelAnchor] = useState<HTMLElement | null>(null);
  const labelAfterMenu = useMenuHandoff(menu !== null, setLabelAnchor);
  const surfaceRef = useRef<HTMLDivElement>(null);
  useReflow(surfaceRef, {
    ids: view.slides.map(slide => slide.id),
    selector: '[data-song-slide]',
    attribute: 'data-song-slide',
    scope: session.slideDocumentId,
  });
  const deletion = useSelectionDelete();
  const releaseDrag = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => releaseDrag.current?.(), []);
  const dragClick = useDragClickGuard();
  const mounted = useRef(true);
  const sessionRef = useRef(session);
  const blockedRef = useRef(blocked);
  const pasteQueueRef = useRef<Promise<void> | undefined>(undefined);
  useLayoutEffect(() => {
    sessionRef.current = session;
    blockedRef.current = blocked;
  }, [session, blocked]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const copy = (cut = false): void => {
    if (cut) surfaceRef.current?.focus({preventScroll: true});
    const text = cut ? adapter.cut() : adapter.copy();
    if (text !== null) {
      writeSlideText(session.clipboardOwner, text);
    }
  };
  const paste = (): void => {
    if (contentLocked) return;
    surfaceRef.current?.focus({preventScroll: true});
    const model = session.slideModel;
    const intent = session.slideIntent;
    const current = (): boolean =>
      mounted.current &&
      sessionRef.current === session &&
      model === session.slideModel &&
      intent === session.slideIntent &&
      !isInTextEntry(document.activeElement) &&
      surfaceRef.current?.contains(document.activeElement) === true;
    pasteQueueRef.current = (pasteQueueRef.current ?? Promise.resolve()).then(
      async () => {
        if (!current()) return;
        try {
          const text = await readSlideText(session.clipboardOwner);
          if (current()) adapter.paste(text);
        } catch (error) {
          console.error('Could not read slide text', error);
          if (current()) adapter.paste();
        }
      },
    );
  };
  const selected = view.selection.ids.size > 0;
  const owns = (event: globalThis.KeyboardEvent): boolean =>
    event.target instanceof Node &&
    surfaceRef.current?.contains(event.target) === true &&
    !isInTextEntry(event.target) &&
    !(
      event.target instanceof Element &&
      event.target.closest('[data-overlay-clip]')
    );
  const insertionIndex = (event: DragEvent<HTMLDivElement>): number | null => {
    const node =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            '[data-slide-gap], [data-slide-index]',
          )
        : null;
    if (node === null) return null;
    return slideDropPosition(node, event.clientX, event.clientY);
  };
  const clearDrop = (): void => {
    surfaceRef.current
      ?.querySelectorAll('[data-slide-drop]')
      .forEach(node => node.removeAttribute('data-slide-drop'));
  };
  const focusList = (target: EventTarget): void => {
    if (
      target instanceof Element &&
      target.closest('[data-song-slide]') !== null &&
      !isInTextEntry(target) &&
      target.closest('button, [data-overlay-clip]') === null
    ) {
      surfaceRef.current?.focus({preventScroll: true});
    }
  };
  const selectionReason = selected ? undefined : '선택한 슬라이드가 없습니다';
  const deleteReason =
    deleteSelection !== undefined
      ? (editReason ?? (leadingSelected ? undefined : selectionReason))
      : leadingSelected
        ? editReason
        : (contentEditReason ??
          selectionReason ??
          (view.slides.length - view.selection.ids.size <
          session.slideModel.limits.minSlides
            ? '곡에는 슬라이드가 하나 이상 있어야 합니다'
            : undefined));
  const askDelete = (): void => {
    if (deleteReason !== undefined) return;
    if (deleteSelection !== undefined) {
      deleteSelection(leadingSelected);
      if (leadingSelected) clearCard();
      return;
    }
    if (leadingSelected) {
      clearCard();
      leadingCard.onDelete();
      return;
    }
    const snapshot = session.slideModel.getSnapshot();
    deletion.ask(
      snapshot.selection.ids.size,
      () =>
        mounted.current &&
        sessionRef.current === session &&
        !session.readOnly &&
        !blockedRef.current &&
        session.slideModel.getSnapshot() === snapshot,
      () => {
        surfaceRef.current?.focus();
        adapter.command({type: 'delete'});
      },
    );
  };
  const duplicateReason =
    contentEditReason ??
    selectionReason ??
    (view.slides.length + view.selection.ids.size >
    session.slideModel.limits.maxSlides
      ? '슬라이드가 너무 많습니다'
      : undefined);
  const pasteReason =
    contentEditReason ??
    (view.slides.length >= session.slideModel.limits.maxSlides
      ? '슬라이드가 너무 많습니다'
      : undefined);
  useWindowShortcuts([
    {
      id: 'editor.labelMenu',
      context: 'song',
      when: event => itemKind !== 'ad' && owns(event),
      unavailable: () =>
        store === undefined
          ? '여기서는 쓸 수 없습니다'
          : (editReason ?? selectionReason),
      run: () =>
        setLabelAnchor(
          selectedSlideAnchor(surfaceRef.current, view.selection.focus),
        ),
    },
    {
      id: 'edit.copy',
      fixedBindings: [{code: 'KeyC', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      unavailable: () => selectionReason,
      run: () => copy(),
    },
    {
      id: 'edit.cut',
      fixedBindings: [{code: 'KeyX', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      unavailable: () => contentEditReason ?? deleteReason,
      run: () => copy(true),
    },
    {
      id: 'edit.paste',
      fixedBindings: [{code: 'KeyV', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      unavailable: () => pasteReason,
      run: paste,
    },
    {
      id: 'edit.selectAll',
      fixedBindings: [{code: 'KeyA', mods: ['ctrl']}],
      context: 'song',
      when: owns,
      run: () => adapter.select({type: 'all'}),
    },
    {
      id: 'edit.duplicate',
      context: 'song',
      when: owns,
      unavailable: () => duplicateReason,
      run: () => adapter.command({type: 'duplicate'}),
    },
    {
      id: 'edit.delete',
      context: 'song',
      when: owns,
      unavailable: () => deleteReason,
      run: askDelete,
    },
    {
      id: 'edit.undo',
      context: 'song',
      when: owns,
      unavailable: () =>
        editReason ??
        (adapter.canUndo ? undefined : '실행 취소할 변경이 없습니다'),
      run: () => {
        surfaceRef.current?.focus();
        adapter.edit('undo');
      },
    },
    {
      id: 'edit.redo',
      context: 'song',
      when: owns,
      unavailable: () =>
        editReason ??
        (adapter.canRedo ? undefined : '다시 실행할 변경이 없습니다'),
      run: () => {
        surfaceRef.current?.focus();
        adapter.edit('redo');
      },
    },
  ]);
  const entries: readonly MenuEntry[] = [
    ...(onAdd === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'add-slide',
            label: '슬라이드 추가',
            ...menuAvailability(pasteReason),
            onSelect: () => onAdd(addIndex),
          },
        ]),
    ...(view.selection.ids.size <= 1 ? (extraMenu?.(menuIndex) ?? []) : []),
    ...(onHotKey === undefined || view.selection.ids.size !== 1
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'hot-key',
            label: '단축키…',
            ...menuAvailability(editReason),
            onSelect: () => onHotKey(menuIndex),
          },
        ]),
    ...(onEdit === undefined || view.selection.ids.size !== 1
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'edit',
            contextGroup: 'default' as const,
            label: editLabel,
            onSelect: () => onEdit(menuIndex),
          },
        ]),
    ...(store === undefined || itemKind === 'ad'
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'label',
            label: '이름표',
            command: 'editor.labelMenu',
            ...menuAvailability(editReason ?? selectionReason),
            onSelect: () => labelAfterMenu(menu?.target ?? surfaceRef.current),
          },
        ]),
    {
      kind: 'item',
      id: 'copy',
      contextGroup: 'clipboard',
      label: selectionLabel('복사', view.selection.ids.size),
      meta: 'Ctrl C',
      ...menuAvailability(selected ? undefined : '선택한 슬라이드가 없습니다'),
      onSelect: () => copy(),
    },
    {
      kind: 'item',
      id: 'cut',
      contextGroup: 'clipboard',
      label: selectionLabel('잘라내기', view.selection.ids.size),
      meta: 'Ctrl X',
      ...menuAvailability(contentEditReason ?? deleteReason),
      onSelect: () => copy(true),
    },
    {
      kind: 'item',
      id: 'paste',
      contextGroup: 'clipboard',
      label: '붙여넣기',
      meta: 'Ctrl V',
      ...menuAvailability(pasteReason),
      onSelect: paste,
    },
    {
      kind: 'item',
      id: 'duplicate',
      contextGroup: 'clipboard',
      label: selectionLabel('복제', view.selection.ids.size),
      meta: 'Ctrl D',
      ...menuAvailability(duplicateReason),
      onSelect: () => adapter.command({type: 'duplicate'}),
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: selectionLabel(
        '삭제',
        view.selection.ids.size +
          Number(deleteSelection !== undefined && leadingSelected),
      ),
      meta: 'Delete',
      ...menuAvailability(deleteReason),
      onSelect: askDelete,
    },
    {kind: 'separator', id: 'history'},
    {
      kind: 'item',
      id: 'undo',
      contextGroup: 'clipboard',
      label: '실행 취소',
      meta: 'Ctrl Z',
      ...menuAvailability(
        !adapter.canUndo
          ? '실행 취소할 변경이 없습니다'
          : readOnly
            ? NEWER_FILE_REASON
            : undefined,
      ),
      onSelect: () => adapter.edit('undo'),
    },
    {
      kind: 'item',
      id: 'redo',
      contextGroup: 'clipboard',
      label: '다시 실행',
      meta: 'Ctrl Y',
      ...menuAvailability(
        !adapter.canRedo
          ? '다시 실행할 변경이 없습니다'
          : readOnly
            ? NEWER_FILE_REASON
            : undefined,
      ),
      onSelect: () => adapter.edit('redo'),
    },
  ];
  return (
    <div
      {...dragClick.props}
      ref={surfaceRef}
      className={className}
      tabIndex={0}
      role="group"
      aria-label="슬라이드 편집 명령"
      onCopy={event => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        if (isInTextEntry(event.target)) return;
        const text = adapter.copy();
        if (text === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.setData('text/plain', text);
      }}
      onCut={event => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        if (contentLocked || isInTextEntry(event.target)) return;
        surfaceRef.current?.focus({preventScroll: true});
        const text = adapter.cut();
        if (text === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.setData('text/plain', text);
      }}
      onPaste={event => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        if (contentLocked || isInTextEntry(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        surfaceRef.current?.focus({preventScroll: true});
        adapter.paste(event.clipboardData.getData('text/plain'));
      }}
      onPointerDownCapture={event => {
        dragClick.props.onPointerDownCapture();
        if (event.button === 0) {
          if (
            event.target instanceof Element &&
            event.target.closest('[data-leading-card]') !== null
          ) {
            if (!mixedLeadingSelection) selectCard();
          } else if (
            event.target instanceof Element &&
            event.target.closest('[data-song-slide], [data-slide-gap]') !== null
          ) {
            extendLeadingRange(event.shiftKey);
            if (
              !mixedLeadingSelection ||
              !(event.ctrlKey || event.metaKey || event.shiftKey)
            ) {
              clearCard();
            }
          }
          focusList(event.target);
        }
      }}
      onClickCapture={event => {
        dragClick.props.onClickCapture(event);
        if (event.defaultPrevented) return;
        if (
          event.button === 0 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.target instanceof Element
        ) {
          const viewport = event.target.closest<HTMLElement>(
            '[data-view], [data-editor="true"]',
          );
          const slide = event.target.closest('[data-song-slide]');
          const occupied = event.target.closest(
            '[data-slide-gap], [data-leading-card], button, input, textarea, select, [contenteditable="true"]',
          );
          const emptyPlate =
            slide !== null &&
            slide === event.target &&
            !slide.hasAttribute('data-fixed-slide') &&
            slide.getBoundingClientRect().width > 0 &&
            slide.getBoundingClientRect().height > 0;
          if (
            viewport !== null &&
            occupied === null &&
            (slide === null || emptyPlate) &&
            event.currentTarget.contains(viewport)
          ) {
            clearCard();
            adapter.select({
              type: 'gap',
              index: emptySlideGap(viewport, {
                x: event.clientX,
                y: event.clientY,
                count: view.slides.length,
              }),
            });
            surfaceRef.current?.focus({preventScroll: true});
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
        if (
          event.target instanceof Element &&
          event.target.closest('[data-leading-card]') !== null
        ) {
          const toggle =
            mixedLeadingSelection && (event.ctrlKey || event.metaKey);
          if (toggle && leadingSelected) {
            clearCard();
          } else {
            if (
              mixedLeadingSelection &&
              event.shiftKey &&
              view.slides[0] !== undefined &&
              view.selection.ids.size > 0
            ) {
              adapter.select({
                type: 'click',
                id: view.slides[0].id,
                shift: true,
              });
            }
            selectCard(mixedLeadingSelection && (toggle || event.shiftKey));
          }
          if (
            !isInTextEntry(event.target) &&
            event.target.closest('button') === null
          ) {
            surfaceRef.current?.focus({preventScroll: true});
          }
        } else if (
          event.target instanceof Element &&
          event.target.closest('[data-song-slide], [data-slide-gap]') !== null
        ) {
          if (
            !mixedLeadingSelection ||
            !(event.ctrlKey || event.metaKey || event.shiftKey)
          ) {
            clearCard();
          }
        }
        focusList(event.target);
      }}
      data-slide-surface
      data-leading-active={leadingSelected || undefined}
      onKeyDownCapture={event => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        const keyTarget = event.target;
        if (leadingSelected && !isInTextEntry(event.target)) {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
        if (
          event.key === ' ' &&
          !event.defaultPrevented &&
          !isComposing(event) &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.shiftKey &&
          keyTarget instanceof HTMLElement &&
          (keyTarget === event.currentTarget ||
            keyTarget.matches('[data-song-slide], [role="option"]'))
        ) {
          const index = Number(
            keyTarget.closest<HTMLElement>('[data-slide-index]')?.dataset
              .slideIndex ?? session.selectedOccurrence,
          );
          const slide = view.slides[index];
          event.preventDefault();
          event.stopPropagation();
          if (
            !event.repeat &&
            slide !== undefined &&
            view.selection.caret === null
          ) {
            adapter.select({type: 'click', id: slide.id, ctrl: true});
          }
          return;
        }
        if (
          !event.defaultPrevented &&
          event.key === 'Escape' &&
          !isComposing(event) &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.shiftKey &&
          isInTextEntry(event.target) &&
          event.target instanceof Element
        ) {
          const id =
            event.target.closest<HTMLElement>('[data-song-slide]')?.dataset
              .songSlide;
          const slide = view.slides.find(slide => slide.id === id);
          if (slide !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            surfaceRef.current?.focus({preventScroll: true});
            adapter.select({type: 'click', id: slide.id});
            return;
          }
        }
        if (!isContextMenuKey(event) || isInTextEntry(event.target)) return;
        const target =
          event.target instanceof HTMLElement
            ? event.target
            : event.currentTarget;
        event.preventDefault();
        event.stopPropagation();
        const targetId =
          target.closest<HTMLElement>('[data-song-slide]')?.dataset.songSlide;
        const targetSlide = view.slides.find(slide => slide.id === targetId);
        if (
          targetSlide !== undefined &&
          !view.selection.ids.has(targetSlide.id)
        ) {
          adapter.select({type: 'click', id: targetSlide.id});
        }
        setMenu({
          kind: 'element',
          element: target,
          targets: menuTargets(event.currentTarget, targetId),
        });
        setMenuIndex(
          Number(
            target.closest<HTMLElement>('[data-slide-index]')?.dataset
              .slideIndex ?? session.selectedOccurrence,
          ),
        );
        setAddIndex(
          targetSlide === undefined
            ? view.slides.length
            : view.slides.indexOf(targetSlide) + 1,
        );
      }}
      onKeyDown={event => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        if (
          event.defaultPrevented ||
          isComposing(event) ||
          isInTextEntry(event.target) ||
          (event.target instanceof Element &&
            event.target.closest('[data-overlay-clip]')) ||
          event.altKey
        ) {
          return;
        }
        const control = event.ctrlKey || event.metaKey;
        if (control) return;
        if (leadingCard !== undefined && !event.shiftKey) {
          const columns = Number(
            surfaceRef.current?.querySelector<HTMLElement>(
              '[data-slide-columns]',
            )?.dataset.slideColumns ?? 1,
          );
          if (
            leadingSelected &&
            ['ArrowUp', 'ArrowLeft', 'Home'].includes(event.key)
          ) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (
            leadingSelected &&
            (event.key === 'ArrowDown' || event.key === 'ArrowRight')
          ) {
            const first =
              view.slides[
                event.key === 'ArrowDown'
                  ? Math.min(columns - 1, view.slides.length - 1)
                  : 0
              ];
            if (first !== undefined) {
              clearCard();
              adapter.select({type: 'click', id: first.id});
              event.preventDefault();
              event.stopPropagation();
              surfaceRef.current?.focus();
            }
            return;
          }
          if (
            !leadingSelected &&
            (event.key === 'Home' ||
              (event.key === 'ArrowUp' &&
                session.selectedOccurrence === columns - 1) ||
              (event.key === 'ArrowLeft' && session.selectedOccurrence === 0))
          ) {
            selectCard();
            event.preventDefault();
            event.stopPropagation();
            surfaceRef.current?.focus();
            return;
          }
        }
        const key = event.key.toLowerCase();
        let run: (() => void) | undefined;
        if (key.startsWith('arrow')) {
          const columns = Number(
            surfaceRef.current?.querySelector<HTMLElement>(
              '[data-slide-columns]',
            )?.dataset.slideColumns ?? 1,
          );
          run = () =>
            adapter.select({
              type: 'arrow',
              delta:
                key === 'arrowup'
                  ? -columns
                  : key === 'arrowdown'
                    ? columns
                    : key === 'arrowleft'
                      ? -1
                      : 1,
              shift: event.shiftKey,
            });
        } else if (key === 'home' || key === 'end') {
          run = () => {
            const index = key === 'home' ? 0 : view.slides.length - 1;
            const slide = view.slides[index];
            if (
              view.selection.caret !== null ||
              slide === undefined ||
              !selected
            ) {
              adapter.select({
                type: 'gap',
                index: key === 'home' ? 0 : view.slides.length,
              });
            } else {
              adapter.select({
                type: 'click',
                id: slide.id,
                shift: event.shiftKey,
              });
            }
          };
        } else if (key === 'escape') {
          run = () => {
            if (selected || view.selection.caret !== null) {
              adapter.select({type: 'clear'});
            } else onBack?.();
          };
        }
        if (run === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        surfaceRef.current?.focus({preventScroll: true});
        run();
      }}
      onContextMenu={event => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        if (isInTextEntry(event.target)) return;
        const card =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-leading-card]')
            : null;
        if (card !== null && deleteSelection === undefined) return;
        const row =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-song-slide]')
            : null;
        const id = row?.dataset.songSlide;
        const slide = view.slides.find(slide => slide.id === id);
        setAddIndex(
          slide === undefined
            ? view.slides.length
            : view.slides.indexOf(slide) + 1,
        );
        setMenuIndex(
          Number(row?.dataset.slideIndex ?? session.selectedOccurrence),
        );
        if (card !== null) {
          selectCard(leadingSelected);
        } else if (slide !== undefined && !view.selection.ids.has(slide.id)) {
          if (deleteSelection !== undefined) clearCard();
          adapter.select({type: 'click', id: slide.id});
        }
        event.preventDefault();
        event.stopPropagation();
        surfaceRef.current?.focus({preventScroll: true});
        setMenu({
          ...contextMenuAnchor(event),
          targets:
            card === null ? menuTargets(event.currentTarget, id) : [card],
        });
      }}
      onDragStart={event => {
        if (contentLocked || isInTextEntry(event.target)) {
          event.preventDefault();
          return;
        }
        const row =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-song-slide]')
            : null;
        const id = row?.dataset.songSlide;
        const slide = view.slides.find(slide => slide.id === id);
        if (slide === undefined) {
          event.preventDefault();
          return;
        }
        if (!view.selection.ids.has(slide.id)) {
          adapter.select({type: 'click', id: slide.id});
        }
        event.dataTransfer.setData(
          'application/x-llp-song-slide-move',
          session.slideDocumentId,
        );
        event.dataTransfer.effectAllowed = 'move';
        releaseDrag.current?.();
        releaseDrag.current = selectionDragImage(
          event.dataTransfer,
          row ?? event.currentTarget,
          session.slideModel.getSnapshot().selection.ids.size,
        );
        dragClick.markDragged();
      }}
      onDragOver={event => {
        if (
          !contentLocked &&
          event.dataTransfer.types.includes('application/x-llp-song-slide-move')
        ) {
          event.preventDefault();
          clearDrop();
          const index = insertionIndex(event);
          if (
            index !== null &&
            !isUnchangedSelectionMove(
              view.slides.map(slide => slide.id),
              view.selection.ids,
              index,
            )
          ) {
            surfaceRef.current
              ?.querySelector(`[data-slide-gap="${index}"]`)
              ?.setAttribute('data-slide-drop', '');
          }
        }
      }}
      onDrop={event => {
        if (
          contentLocked ||
          event.dataTransfer.getData('application/x-llp-song-slide-move') !==
            session.slideDocumentId
        ) {
          return;
        }
        const index = insertionIndex(event);
        clearDrop();
        if (
          index === null ||
          !Number.isInteger(index) ||
          isUnchangedSelectionMove(
            view.slides.map(slide => slide.id),
            view.selection.ids,
            index,
          )
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        adapter.command({type: 'move', index});
      }}
      onDragEnd={() => {
        clearDrop();
        releaseDrag.current?.();
      }}
    >
      {children}
      {deletion.dialog}
      {store === undefined || labelAnchor === null ? null : (
        <LabelMenu
          store={store}
          anchor={labelAnchor}
          selected={
            view.slides.find(slide => view.selection.ids.has(slide.id))?.label
          }
          onChoose={label => adapter.command({type: 'label', label})}
          onClose={() => {
            setLabelAnchor(null);
          }}
        />
      )}
      {menu === null ? null : (
        <Menu
          context
          label="슬라이드"
          anchor={menu}
          entries={entries}
          onClose={() => {
            setMenu(null);
            surfaceRef.current?.focus({preventScroll: true});
          }}
        />
      )}
    </div>
  );
}
