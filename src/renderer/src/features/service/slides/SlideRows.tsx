import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
  type RefObject,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type {Slide, SlidesDraft} from '@core/services/slidesEdits';
import type {SlideSelectionAction} from '@core/songs/slideListSelection';
import type {SlideId} from '@core/schema/ids';
import type {SlideListCommand} from '@core/songs/slideListEdits';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability} from '@renderer/ui/menuModel';
import {isComposing} from '@renderer/ui/ime';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {useSlideRowClipboard} from './useSlideRowClipboard';
import styles from './SlidesEditor.module.css';

export function SlideRows({
  draft,
  blocked,
  update,
  report,
  list,
  renderRow,
  children,
}: {
  readonly draft: SlidesDraft;
  readonly blocked: boolean;
  readonly update: () => void;
  readonly report: (message: string) => void;
  readonly list: RefObject<HTMLDivElement | null>;
  readonly renderRow: (slide: Slide, index: number) => ReactNode;
  readonly children: ReactNode;
}): JSX.Element {
  const {item, selection, selected} = draft.snapshot;
  const rows = item.slides.slides;
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const dragging = useRef(false);
  const pointerSelecting = useRef(false);
  const pendingFocus = useRef(false);
  const movingFocus = useRef(false);
  const lastFocused = useRef<HTMLElement | null>(null);
  const clipboard = useSlideRowClipboard({
    draft,
    blocked,
    update: () => {
      pendingFocus.current = true;
      update();
    },
    report,
  });
  useLayoutEffect(() => {
    if (
      lastFocused.current !== null &&
      !lastFocused.current.isConnected &&
      document.activeElement === document.body
    ) {
      pendingFocus.current = true;
    }
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const focus = selection.focus;
    const target =
      selection.caret !== null
        ? list.current?.querySelector<HTMLElement>(
            `[data-gap-index="${selection.caret}"]`,
          )
        : focus?.kind === 'slide'
          ? list.current?.querySelector<HTMLElement>(
              `[data-slide-id="${focus.id}"]`,
            )
          : list.current?.querySelectorAll<HTMLElement>('[data-slide-id]')[
              selected
            ];
    movingFocus.current = true;
    (target ?? list.current)?.focus();
    movingFocus.current = false;
  });
  const select = (
    action: SlideSelectionAction<SlideId>,
    focus = false,
  ): void => {
    if (blocked) return;
    draft.selectRows(action);
    pendingFocus.current = focus;
    update();
  };
  const command = (command: SlideListCommand<Slide>): void => {
    if (blocked) return;
    if (!draft.commandRows(command)) report('슬라이드를 변경할 수 없습니다');
    pendingFocus.current = true;
    update();
  };
  const click = (event: MouseEvent, slide: Slide): void => {
    if (
      event.button !== 0 ||
      isInTextEntry(event.target) ||
      (event.target instanceof Element &&
        event.target.closest('button') !== null)
    ) {
      return;
    }
    select(
      {type: 'click', id: slide.id, shift: event.shiftKey, ctrl: event.ctrlKey},
      true,
    );
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (
      blocked ||
      event.defaultPrevented ||
      isComposing(event) ||
      isInTextEntry(event.target) ||
      event.altKey ||
      event.metaKey ||
      menu !== null
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (event.ctrlKey && key === 'a') select({type: 'all'}, true);
    else if (event.ctrlKey && (key === 'z' || key === 'y')) {
      if (key === 'y' || event.shiftKey) draft.redo();
      else draft.undo();
      pendingFocus.current = true;
      update();
    } else if (event.ctrlKey && key === 'd') command({type: 'duplicate'});
    else if (!event.ctrlKey && key === 'delete') command({type: 'delete'});
    else if (!event.ctrlKey && key === 'escape') select({type: 'clear'});
    else if (
      !event.ctrlKey &&
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
    ) {
      select(
        {
          type: 'arrow',
          delta: key === 'arrowup' || key === 'arrowleft' ? -1 : 1,
          shift: event.shiftKey,
        },
        true,
      );
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };
  const gap = (index: number): ReactNode => (
    <button
      type="button"
      className={styles.gap}
      aria-label={`${index + 1}번째 위치에 삽입`}
      data-gap-index={index}
      data-caret={selection.caret === index || undefined}
      tabIndex={selection.caret === index || rows.length === 0 ? 0 : -1}
      onClick={() => select({type: 'gap', index}, true)}
      onDragOver={event => {
        if (dragging.current && !blocked) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={event => {
        if (!dragging.current) return;
        event.preventDefault();
        dragging.current = false;
        command({type: 'move', index});
      }}
      onContextMenu={event => {
        if (blocked) return;
        event.preventDefault();
        select({type: 'gap', index});
        list.current?.focus();
        setMenu({
          kind: 'point',
          point: {x: event.clientX, y: event.clientY},
          target: event.currentTarget,
        });
      }}
    />
  );
  const hasSelection = selection.ids.size > 0;
  return (
    <div
      ref={list}
      className={styles.rows}
      aria-label="슬라이드 편집 목록"
      tabIndex={-1}
      onFocusCapture={event => {
        if (list.current?.contains(event.target)) {
          lastFocused.current = event.target;
        }
      }}
      onKeyDown={keyDown}
      {...clipboard.events}
    >
      {rows.map((slide, index) => (
        <Fragment key={slide.id}>
          {gap(index)}
          <div
            className={styles.row}
            data-selected={selection.ids.has(slide.id) || undefined}
            tabIndex={selection.caret === null && index === selected ? 0 : -1}
            data-slide-id={slide.id}
            draggable={!blocked}
            onMouseDown={event => {
              pointerSelecting.current =
                event.button === 0 && !isInTextEntry(event.target);
            }}
            onMouseUp={() => {
              pointerSelecting.current = false;
            }}
            onClick={event => click(event, slide)}
            onFocus={() => {
              if (
                !movingFocus.current &&
                !pointerSelecting.current &&
                !draft.snapshot.selection.ids.has(slide.id)
              ) {
                select({type: 'click', id: slide.id});
              }
            }}
            onDragStart={event => {
              if (blocked || isInTextEntry(event.target)) {
                event.preventDefault();
                return;
              }
              if (!draft.snapshot.selection.ids.has(slide.id)) {
                select({type: 'click', id: slide.id});
              }
              dragging.current = true;
              event.dataTransfer.setData('text/plain', slide.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              dragging.current = false;
              pointerSelecting.current = false;
            }}
            onDragOver={event => {
              if (dragging.current && !blocked) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={event => {
              if (!dragging.current) return;
              event.preventDefault();
              dragging.current = false;
              const bounds = event.currentTarget.getBoundingClientRect();
              command({
                type: 'move',
                index:
                  index +
                  (bounds.height > 0 &&
                  event.clientY > bounds.top + bounds.height / 2
                    ? 1
                    : 0),
              });
            }}
            onContextMenu={event => {
              if (blocked || isInTextEntry(event.target)) return;
              event.preventDefault();
              if (!draft.snapshot.selection.ids.has(slide.id)) {
                select({type: 'click', id: slide.id});
              }
              list.current?.focus();
              setMenu({
                kind: 'point',
                point: {x: event.clientX, y: event.clientY},
                target: event.currentTarget,
              });
            }}
          >
            {renderRow(slide, index)}
          </div>
        </Fragment>
      ))}
      {gap(rows.length)}
      {children}
      {menu === null ? null : (
        <Menu
          label="슬라이드 메뉴"
          anchor={menu}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'undo',
              label: '실행 취소',
              meta: 'Ctrl Z',
              ...menuAvailability(
                !draft.canUndo ? '실행 취소할 변경 없음' : undefined,
              ),
              onSelect: () => {
                if (blocked) return;
                draft.undo();
                pendingFocus.current = true;
                update();
              },
            },
            {
              kind: 'item',
              id: 'redo',
              label: '다시 실행',
              meta: 'Ctrl Y',
              ...menuAvailability(
                !draft.canRedo ? '다시 실행할 변경 없음' : undefined,
              ),
              onSelect: () => {
                if (blocked) return;
                draft.redo();
                pendingFocus.current = true;
                update();
              },
            },
            {kind: 'separator', id: 'clipboard'},
            {
              kind: 'item',
              id: 'cut',
              label: '잘라내기',
              meta: 'Ctrl X',
              ...menuAvailability(
                !hasSelection ? '선택한 슬라이드 없음' : undefined,
              ),
              onSelect: () => {
                editorTask(clipboard.copy(true));
              },
            },
            {
              kind: 'item',
              id: 'copy',
              label: '복사',
              meta: 'Ctrl C',
              ...menuAvailability(
                !hasSelection ? '선택한 슬라이드 없음' : undefined,
              ),
              onSelect: () => {
                editorTask(clipboard.copy());
              },
            },
            {
              kind: 'item',
              id: 'paste',
              label: '붙여넣기',
              meta: 'Ctrl V',
              onSelect: () => {
                editorTask(clipboard.paste());
              },
            },
            {
              kind: 'item',
              id: 'duplicate',
              label: '복제',
              meta: 'Ctrl D',
              ...menuAvailability(
                !hasSelection ? '선택한 슬라이드 없음' : undefined,
              ),
              onSelect: () => command({type: 'duplicate'}),
            },
            {kind: 'separator', id: 'delete'},
            {
              kind: 'item',
              id: 'remove',
              label: '삭제',
              meta: 'Delete',
              ...menuAvailability(
                !hasSelection ? '선택한 슬라이드 없음' : undefined,
              ),
              onSelect: () => command({type: 'delete'}),
            },
          ]}
        />
      )}
    </div>
  );
}
