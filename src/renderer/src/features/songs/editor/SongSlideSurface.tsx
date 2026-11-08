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

import {isInTextEntry} from '@renderer/ui/textEntry';
import {isComposing} from '@renderer/ui/ime';
import {contextMenuAnchor, isContextMenuKey} from '@renderer/ui/contextMenu';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import type {SlideListSession} from './slideListSession';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';
import {LabelMenu} from './LabelMenu';
import type {SongEditorStore} from './songEditorStore';
import {readSlideText, writeSlideText} from './systemSlideClipboard';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';

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
  blocked = false,
  editLabel = windowCommandLabels.editSong,
}: {
  readonly session: SlideListSession<T>;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly store?: SongEditorStore | undefined;
  readonly onEdit?: ((index: number) => void) | undefined;
  readonly onHotKey?: ((index: number) => void) | undefined;
  readonly extraMenu?: (index: number) => readonly MenuEntry[];
  readonly blocked?: boolean;
  readonly editLabel?: string;
}): JSX.Element {
  const readOnly = blocked || session.readOnly;
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [labelAnchor, setLabelAnchor] = useState<HTMLElement | null>(null);
  const labelAfterMenu = useMenuHandoff(menu !== null, setLabelAnchor);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragClick = useDragClickGuard();
  const mounted = useRef(true);
  const sessionRef = useRef(session);
  const pasteQueueRef = useRef<Promise<void> | undefined>(undefined);
  useLayoutEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const copy = (cut = false): void => {
    if (cut) surfaceRef.current?.focus({preventScroll: true});
    const text = cut ? session.cutSlides() : session.copySlides();
    if (text !== null) {
      writeSlideText(session.clipboardOwner, text);
    }
  };
  const paste = (): void => {
    if (readOnly) return;
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
          if (current()) session.pasteSlides(text);
        } catch (error) {
          console.error('Could not read slide text', error);
          if (current()) session.pasteSlides();
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
    if (node.dataset.slideGap !== undefined) {
      return Number(node.dataset.slideGap);
    }
    const rect = node.getBoundingClientRect();
    const after = node.hasAttribute('data-editor-block')
      ? event.clientY > (rect.top + rect.bottom) / 2
      : event.clientX > (rect.left + rect.right) / 2;
    return Number(node.dataset.slideIndex) + (after ? 1 : 0);
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
  const editReason = readOnly ? NEWER_FILE_REASON : undefined;
  const selectionReason = selected ? undefined : '선택한 슬라이드가 없습니다';
  const deleteReason =
    editReason ??
    selectionReason ??
    (view.slides.length - view.selection.ids.size <
    session.slideModel.limits.minSlides
      ? '곡에는 슬라이드가 하나 이상 있어야 합니다'
      : undefined);
  const duplicateReason =
    editReason ??
    selectionReason ??
    (view.slides.some(
      slide =>
        view.selection.ids.has(slide.id) &&
        'titleSlide' in slide &&
        slide.titleSlide === true,
    )
      ? '제목 슬라이드는 복제할 수 없습니다'
      : undefined) ??
    (view.slides.length + view.selection.ids.size >
    session.slideModel.limits.maxSlides
      ? '슬라이드가 너무 많습니다'
      : undefined);
  const pasteReason =
    editReason ??
    (view.slides.length >= session.slideModel.limits.maxSlides
      ? '슬라이드가 너무 많습니다'
      : undefined);
  useWindowShortcuts([
    {
      id: 'editor.labelMenu',
      context: 'song',
      when: owns,
      unavailable: () =>
        store === undefined
          ? '여기서는 쓸 수 없습니다'
          : (editReason ?? selectionReason),
      run: () => setLabelAnchor(surfaceRef.current),
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
      unavailable: () => deleteReason,
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
      run: () => session.selectSlides({type: 'all'}),
    },
    {
      id: 'edit.duplicate',
      context: 'song',
      when: owns,
      unavailable: () => duplicateReason,
      run: () => session.commandSlides({type: 'duplicate'}),
    },
    {
      id: 'edit.delete',
      context: 'song',
      when: owns,
      unavailable: () => deleteReason,
      run: () => {
        surfaceRef.current?.focus();
        session.commandSlides({type: 'delete'});
      },
    },
    {
      id: 'edit.undo',
      context: 'song',
      when: owns,
      unavailable: () =>
        editReason ??
        (view.canUndo ? undefined : '실행 취소할 변경이 없습니다'),
      run: () => {
        surfaceRef.current?.focus();
        session.edit('undo');
      },
    },
    {
      id: 'edit.redo',
      context: 'song',
      when: owns,
      unavailable: () =>
        editReason ??
        (view.canRedo ? undefined : '다시 실행할 변경이 없습니다'),
      run: () => {
        surfaceRef.current?.focus();
        session.edit('redo');
      },
    },
  ]);
  const entries: readonly MenuEntry[] = [
    ...(extraMenu?.(menuIndex) ?? []),
    ...(onHotKey === undefined
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
    ...(onEdit === undefined
      ? []
      : [
          {
            kind: 'item' as const,
            id: 'edit',
            label: editLabel,
            onSelect: () => onEdit(menuIndex),
          },
        ]),
    ...(store === undefined
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
      label: '복사',
      meta: 'Ctrl C',
      ...menuAvailability(selected ? undefined : '선택한 슬라이드가 없습니다'),
      onSelect: () => copy(),
    },
    {
      kind: 'item',
      id: 'cut',
      label: '잘라내기',
      meta: 'Ctrl X',
      ...menuAvailability(deleteReason),
      onSelect: () => copy(true),
    },
    {
      kind: 'item',
      id: 'paste',
      label: '붙여넣기',
      meta: 'Ctrl V',
      ...menuAvailability(pasteReason),
      onSelect: paste,
    },
    {
      kind: 'item',
      id: 'duplicate',
      label: '복제',
      meta: 'Ctrl D',
      ...menuAvailability(duplicateReason),
      onSelect: () => session.commandSlides({type: 'duplicate'}),
    },
    {
      kind: 'item',
      id: 'delete',
      label: '삭제',
      meta: 'Delete',
      ...menuAvailability(deleteReason),
      onSelect: () => session.commandSlides({type: 'delete'}),
    },
    {kind: 'separator', id: 'history'},
    {
      kind: 'item',
      id: 'undo',
      label: '실행 취소',
      meta: 'Ctrl Z',
      ...menuAvailability(
        !view.canUndo
          ? '실행 취소할 변경이 없습니다'
          : readOnly
            ? NEWER_FILE_REASON
            : undefined,
      ),
      onSelect: () => session.edit('undo'),
    },
    {
      kind: 'item',
      id: 'redo',
      label: '다시 실행',
      meta: 'Ctrl Y',
      ...menuAvailability(
        !view.canRedo
          ? '다시 실행할 변경이 없습니다'
          : readOnly
            ? NEWER_FILE_REASON
            : undefined,
      ),
      onSelect: () => session.edit('redo'),
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
        if (isInTextEntry(event.target)) return;
        const text = session.copySlides();
        if (text === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.setData('text/plain', text);
      }}
      onCut={event => {
        if (readOnly || isInTextEntry(event.target)) return;
        surfaceRef.current?.focus({preventScroll: true});
        const text = session.cutSlides();
        if (text === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.setData('text/plain', text);
      }}
      onPaste={event => {
        if (readOnly || isInTextEntry(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        surfaceRef.current?.focus({preventScroll: true});
        session.pasteSlides(event.clipboardData.getData('text/plain'));
      }}
      onPointerDownCapture={event => {
        dragClick.props.onPointerDownCapture();
        if (event.button === 0) focusList(event.target);
      }}
      onClickCapture={event => {
        dragClick.props.onClickCapture(event);
        if (!event.defaultPrevented) focusList(event.target);
      }}
      data-slide-surface
      onKeyDownCapture={event => {
        const keyTarget = event.target;
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
            session.selectSlides({type: 'click', id: slide.id, ctrl: true});
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
            session.selectSlides({type: 'click', id: slide.id});
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
        setMenu({kind: 'element', element: target, target});
        setMenuIndex(
          Number(
            target.closest<HTMLElement>('[data-slide-index]')?.dataset
              .slideIndex ?? session.selectedOccurrence,
          ),
        );
      }}
      onKeyDown={event => {
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
        const key = event.key.toLowerCase();
        let run: (() => void) | undefined;
        if (key.startsWith('arrow')) {
          const columns = Number(
            surfaceRef.current?.querySelector<HTMLElement>(
              '[data-slide-columns]',
            )?.dataset.slideColumns ?? 1,
          );
          run = () =>
            session.selectSlides({
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
              session.selectSlides({
                type: 'gap',
                index: key === 'home' ? 0 : view.slides.length,
              });
            } else {
              session.selectSlides({
                type: 'click',
                id: slide.id,
                shift: event.shiftKey,
              });
            }
          };
        } else if (key === 'escape') {
          run = () => {
            if (selected || view.selection.caret !== null) {
              session.selectSlides({type: 'clear'});
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
        if (isInTextEntry(event.target)) return;
        const row =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-song-slide]')
            : null;
        const id = row?.dataset.songSlide;
        const slide = view.slides.find(slide => slide.id === id);
        setMenuIndex(
          Number(row?.dataset.slideIndex ?? session.selectedOccurrence),
        );
        if (slide !== undefined && !view.selection.ids.has(slide.id)) {
          session.selectSlides({type: 'click', id: slide.id});
        }
        event.preventDefault();
        event.stopPropagation();
        surfaceRef.current?.focus({preventScroll: true});
        setMenu(contextMenuAnchor(event));
      }}
      onDragStart={event => {
        if (readOnly || isInTextEntry(event.target)) {
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
          session.selectSlides({type: 'click', id: slide.id});
        }
        event.dataTransfer.setData(
          'application/x-llp-song-slide-move',
          session.slideDocumentId,
        );
        event.dataTransfer.effectAllowed = 'move';
        dragClick.markDragged();
      }}
      onDragOver={event => {
        if (
          !readOnly &&
          event.dataTransfer.types.includes('application/x-llp-song-slide-move')
        ) {
          event.preventDefault();
          clearDrop();
          const index = insertionIndex(event);
          if (index !== null) {
            surfaceRef.current
              ?.querySelector(`[data-slide-gap="${index}"]`)
              ?.setAttribute('data-slide-drop', '');
          }
        }
      }}
      onDrop={event => {
        if (
          readOnly ||
          event.dataTransfer.getData('application/x-llp-song-slide-move') !==
            session.slideDocumentId
        ) {
          return;
        }
        const index = insertionIndex(event);
        clearDrop();
        if (index === null || !Number.isInteger(index)) return;
        event.preventDefault();
        event.stopPropagation();
        session.commandSlides({type: 'move', index});
      }}
      onDragEnd={clearDrop}
    >
      {children}
      {store === undefined || labelAnchor === null ? null : (
        <LabelMenu
          store={store}
          anchor={labelAnchor}
          selected={
            view.slides.find(slide => view.selection.ids.has(slide.id))?.label
          }
          onChoose={label => session.commandSlides({type: 'label', label})}
          onClose={() => {
            setLabelAnchor(null);
            labelAnchor.focus();
          }}
        />
      )}
      {menu === null ? null : (
        <Menu
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
