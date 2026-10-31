import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {createItemOverlayId} from '@core/schema/ids';
import type {ItemOverlay} from '@core/schema/itemOverlays';
import {isItemOfKind} from '@core/schema/service';
import {THEME_LIMITS} from '@core/themes/elementRules';
import type {SongEditorStore} from '@renderer/features/songs/editor';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {slideMenuEntries} from '@renderer/features/songs/editor/slideMenuEntries';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {useElementSize} from '@renderer/ui/useElementSize';
import type {ServiceItemStore} from './serviceItemStore';
import {NEWER_FILE_REASON} from './ItemArrangement';
import {useItemTheme, OverlayWarning} from './ItemThemeRow';
import {useItemSlides} from './useItemSlides';
import {openItemSong} from './openItemSong';
import styles from './ItemOverlays.module.css';
import {ItemSlideRow, type ItemSlideActions} from './ItemSlideRow';

const INITIAL_ROWS = 12;
const OVERSCAN = 2;

export function ItemOverlayTable({
  items,
  editor,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
}): JSX.Element {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const slides = useItemSlides(items, editor);
  if (state.item === null) return <></>;
  return (
    <SlideTable
      key={`${state.service?.service.id}:${state.item.id}`}
      items={items}
      editor={editor}
      state={state}
      slides={slides}
    />
  );
}

function SlideTable({
  items,
  editor,
  state,
  slides,
}: {
  readonly items: ServiceItemStore;
  readonly editor: SongEditorStore;
  readonly state: ReturnType<ServiceItemStore['getSnapshot']>;
  readonly slides: ReturnType<typeof useItemSlides>;
}): JSX.Element {
  const item = state.item;
  const {targets, missing} = useItemTheme(editor.api.settings, item);
  const viewport = useRef<HTMLDivElement>(null);
  const focusNext = useRef(false);
  const [watchView, viewSize] = useElementSize();
  const watchViewport = useCallback(
    (node: HTMLDivElement | null) => {
      viewport.current = node;
      watchView(node);
    },
    [watchView],
  );
  const [watchRow, rowSize] = useElementSize();
  const [top, setTop] = useState(0);
  const [menu, setMenu] = useState<{index: number; anchor: MenuAnchor} | null>(
    null,
  );
  const height = rowSize?.height ?? 0;
  const selected = Math.min(
    Math.max(0, state.position),
    Math.max(0, slides.length - 1),
  );
  const start = Math.min(
    Math.max(0, slides.length - 1),
    height > 0
      ? Math.max(0, Math.floor(top / height) - OVERSCAN)
      : Math.max(0, selected - INITIAL_ROWS + 1),
  );
  const end = Math.min(
    slides.length,
    start +
      (height > 0
        ? Math.ceil((viewSize?.height ?? 0) / height) + OVERSCAN * 2
        : INITIAL_ROWS),
  );
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null) return;
    if (height > 0) {
      const y = selected * height;
      if (y < node.scrollTop) node.scrollTop = y;
      else if (y + height > node.scrollTop + node.clientHeight) {
        node.scrollTop = y + height - node.clientHeight;
      }
      setTop(node.scrollTop);
    }
  }, [selected, height]);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null) return;
    if (focusNext.current) {
      const button = node.querySelector<HTMLButtonElement>(
        `[data-slide-position="${selected}"]`,
      );
      if (button !== null) {
        button.focus({preventScroll: true});
        focusNext.current = false;
      }
    }
  }, [selected, start, end]);
  const rows = item?.overlays ?? [];
  const reason =
    state.service?.access === 'readOnly'
      ? NEWER_FILE_REASON
      : state.busy
        ? '저장 중'
        : undefined;
  const addReason =
    reason ??
    (slides.length === 0
      ? '슬라이드 없음'
      : rows.length >= THEME_LIMITS.overlays
        ? `오버레이는 ${THEME_LIMITS.overlays}개까지 추가할 수 있습니다`
        : rows.some(row => row.from <= selected + 1 && row.to >= selected + 1)
          ? '선택한 슬라이드에 오버레이가 있습니다'
          : undefined);
  const add = (): void => {
    if (addReason !== undefined) return;
    const overlay: ItemOverlay = {
      id: createItemOverlayId(crypto.randomUUID()),
      name: `오버레이 ${rows.length + 1}`,
      from: selected + 1,
      to: selected + 1,
      screens: targets[0] === undefined ? [] : [targets[0].id],
      content: {text: ''},
    };
    editorTask(
      items
        .changeOverlays(current => [...current, overlay])
        .then(saved => {
          if (saved) items.selectOverlay(overlay.id);
        }),
    );
  };
  const openMenu = (index: number, anchor: MenuAnchor): void => {
    items.selectPosition(index);
    setMenu({index, anchor});
  };
  const song = item !== null && isItemOfKind(item, 'song');
  const actions: ItemSlideActions = {
    select: index => items.selectPosition(index),
    overlay: (id, index) => {
      items.selectPosition(index);
      items.selectOverlay(id);
    },
    edit: song
      ? index => openItemSong({items, editor, position: index})
      : undefined,
    menu: openMenu,
    move: index => {
      focusNext.current = true;
      items.selectPosition(index);
    },
  };
  return (
    <div
      className={styles.table}
      role="table"
      aria-label="슬라이드와 오버레이"
      aria-rowcount={slides.length + 1}
      aria-colcount={3}
    >
      <span ref={watchRow} className={styles.measure} aria-hidden="true" />
      <div role="row" className={styles.heading}>
        <span role="columnheader" aria-label="번호" />
        <span role="columnheader">슬라이드</span>
        <span role="columnheader" className={styles.controls}>
          오버레이
          <OverlayWarning missing={missing} />
          <IconButton
            icon="plus"
            label="오버레이 추가"
            disabled={addReason !== undefined}
            title={addReason}
            onClick={add}
          />
        </span>
      </div>
      <div
        className={styles.viewport}
        role="rowgroup"
        ref={watchViewport}
        onScroll={event => setTop(event.currentTarget.scrollTop)}
      >
        <div role="presentation" style={{height: start * height}} />
        {slides.slice(start, end).map((slide, offset) => {
          const index = start + offset;
          const overlay = rows.find(
            row => row.from <= index + 1 && row.to >= index + 1,
          );
          return (
            <ItemSlideRow
              key={index}
              slide={slide}
              index={index}
              overlay={overlay}
              selected={index === selected}
              menuTarget={menu?.index === index}
              overlaySelected={state.overlay === overlay?.id}
              count={slides.length}
              actions={actions}
              targetNames={
                overlay?.screens.map(
                  id =>
                    targets.find(screen => screen.id === id)?.name ??
                    '삭제된 화면',
                ) ?? []
              }
            />
          );
        })}
        <div
          role="presentation"
          style={{height: (slides.length - end) * height}}
        />
      </div>
      {menu === null ? null : (
        <Menu
          label="슬라이드 메뉴"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={slideMenuEntries(
            song
              ? () => openItemSong({items, editor, position: menu.index})
              : undefined,
            song
              ? {
                  open: () =>
                    openItemSong({
                      items,
                      editor,
                      position: menu.index,
                      action: 'hot-key',
                    }),
                  ...(state.song?.readOnly ? {reason: NEWER_FILE_REASON} : {}),
                }
              : undefined,
          )}
        />
      )}
    </div>
  );
}
