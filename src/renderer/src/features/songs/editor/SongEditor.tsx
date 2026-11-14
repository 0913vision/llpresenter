import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {LabelMenu} from './LabelMenu';
import {SongEditorRibbon, type SongDesignRenderer} from './SongEditorRibbon';
import {SongBlock, type EditorFocus} from './SongBlock';
import {SongHeader} from './SongHeader';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongEditor.module.css';
import type {SongId} from '@core/schema/ids';
import type {UiApi} from '@contracts/ipc/ui';
import {isComposing} from '@renderer/ui/ime';
import {
  linearSlidesOf,
  slideCountOf,
  type EditorSlideItem,
} from '@core/songs/blockEdits';
import {PanelFooter} from '@renderer/ui/Panel';
import {Button} from '@renderer/ui/Button';
import {useSongBlockWindow} from './useSongBlockWindow';
import {SongSlideSurface} from './SongSlideSurface';
import {useSongSlideAppearance} from './useSongSlideAppearance';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {useShow} from '@renderer/session/show';
import {useEditorFocus} from './useEditorFocus';
import {SONG_LIMITS} from '@core/schema/song';
import {SlideSurfaceView, useSlideSurfaceView} from './SlideSurfaceView';
import {menuAvailability} from '@renderer/ui/menuModel';
import {useMeasuredRows} from '@renderer/ui/useMeasuredRows';
import {
  LEADING_CARD_WINDOW_ITEM,
  type LeadingSlideCard,
  type SlideCardRenderer,
} from './SlideCardRenderer';
import {LeadingSlideCardView} from './LeadingSlideCardView';

/** Mount with a window-owned store; unmounting does not discard song history. */
export function SongEditor({
  store,
  onImportedSave,
  unsaved = false,
  onBack,
  actions,
  renderDesign,
  renderCard,
  leadingCard,
  addCard,
  ui,
}: {
  readonly store: SongEditorStore;
  readonly ui?: Pick<UiApi, 'setLayout'> | undefined;
  readonly renderDesign?: SongDesignRenderer | undefined;
  readonly renderCard?: SlideCardRenderer<EditorSlideItem> | undefined;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly addCard?: ReactNode;
  readonly onImportedSave?: ((id: SongId) => void) | undefined;
  /** Shows the dot before the title while edits wait for 저장. */
  readonly unsaved?: boolean;
  readonly onBack?: (() => void) | undefined;
  readonly actions?: ReactNode;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const serviceName = useShow(view => view.serviceName);
  const root = useRef<HTMLElement>(null);
  useEditorFocus(root, state.session, {onBack, request: state.openRequest});
  return (
    <section ref={root} aria-label="곡 편집" className={styles.editor}>
      {state.session === null ? null : (
        <div key={state.session.document.song.id} className={styles.content}>
          <SongHeader
            store={store}
            session={state.session}
            onImportedSave={onImportedSave}
            unsaved={unsaved || state.session.unsaved || state.imported}
            back={
              onBack === undefined ? undefined : (
                <Button className={styles.back} onClick={onBack}>
                  ‹{' '}
                  {state.session.itemSession
                    ? serviceName || '예배 순서'
                    : '라이브러리'}
                </Button>
              )
            }
            actions={state.imported ? null : actions}
          />
          <SongEditorRibbon
            store={store}
            session={state.session}
            busy={state.busy}
            renderDesign={renderDesign}
          />
          <SongSlideSurface
            session={state.session}
            leadingCard={leadingCard}
            store={store}
            className={styles.surface}
            onBack={onBack}
            blocked={state.busy}
            extraMenu={index => [
              {
                kind: 'item',
                id: 'song-title',
                label: '제목 슬라이드 추가',
                ...menuAvailability(
                  state.busy || state.session?.readOnly
                    ? '지금은 편집할 수 없습니다'
                    : (state.session?.history.snapshot.song.slides.length ??
                          0) >= SONG_LIMITS.slides
                      ? '슬라이드가 너무 많습니다'
                      : undefined,
                ),
                onSelect: () =>
                  state.session?.edit({
                    type: 'title',
                    title: state.session.title.nextValue,
                    index:
                      state.session.slideModel.getSnapshot().selection.caret ??
                      (state.session.slideModel.getSnapshot().selection.ids
                        .size > 0
                        ? index + 1
                        : 0),
                  }),
              },
            ]}
          >
            <SongBlocks
              store={store}
              session={state.session}
              renderCard={renderCard}
              leadingCard={leadingCard}
              addCard={addCard}
            />
          </SongSlideSurface>
          <PanelFooter
            end={<SlideSurfaceView ui={ui} />}
            count={
              slideCountOf(state.session.history.snapshot.song) +
              (leadingCard === undefined ? 0 : 1)
            }
          />
        </div>
      )}
    </section>
  );
}

function SongBlocks({
  store,
  session,
  renderCard,
  leadingCard,
  addCard,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession;
  readonly renderCard?: SlideCardRenderer<EditorSlideItem> | undefined;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly addCard?: ReactNode;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const {song, selection} = session.history.snapshot;
  const list = useSyncExternalStore(
    session.history.model.subscribe,
    session.history.model.getSnapshot,
  );
  const theme = useSongSlideAppearance(session);
  const previousBlock = useRef(selection.block);
  const restoredSelection = useRef<{
    input: HTMLTextAreaElement | null | undefined;
    block: number;
    start: number;
    end: number;
  } | null>(null);
  const focus = useRef<EditorFocus>({
    inputs: [],
    requested: false,
    composing: false,
    restoring: false,
  });
  const [menu, setMenu] = useState<{anchor: HTMLElement; block: number} | null>(
    null,
  );
  const slides = useMemo(() => linearSlidesOf(song), [song]);
  const view = useSlideSurfaceView();
  const leadingOffset = leadingCard === undefined ? 0 : 1;
  const [leadingHeight, setLeadingHeight] = useState<number | undefined>(
    undefined,
  );
  const scope = `${view.mode}:${view.scale}`;
  const ids: string[] = slides.map(slide => slide.id);
  const viewportRef = useRef<HTMLDivElement>(null);
  const {current, saveHeight} = useMeasuredRows(scope, ids, viewportRef);
  const heights = useMemo(() => {
    const values =
      view.mode === 'grid' ? slides.map(slide => current.values[slide.id]) : [];
    return leadingCard === undefined
      ? view.mode === 'grid'
        ? values
        : undefined
      : [leadingHeight, ...values];
  }, [view.mode, slides, current, leadingCard, leadingHeight]);
  const windowSlides = useMemo(
    () =>
      leadingCard === undefined
        ? slides
        : [LEADING_CARD_WINDOW_ITEM, ...slides],
    [slides, leadingCard],
  );
  const {
    viewport,
    total,
    offsets,
    columns,
    cellWidth,
    columnGap,
    indices,
    setScrollTop,
  } = useSongBlockWindow(windowSlides, selection.block + leadingOffset, {
    menu: menu?.block === undefined ? undefined : menu.block + leadingOffset,
    mode: view.mode,
    scale: view.scale,
    viewportRef,
    ...(heights === undefined ? {} : {heights}),
  });
  const tab = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (
      event.code !== 'Tab' ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      focus.current.composing ||
      isComposing(event)
    ) {
      return;
    }
    const target = event.target;
    if (!(
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLButtonElement
    )) {
      return;
    }
    const row = target.closest<HTMLElement>('[data-editor-block]');
    if (row === null) return;
    const block = Number(row.dataset.editorBlock);
    const input = target instanceof HTMLTextAreaElement;
    const label =
      target ===
      row.querySelector('button:not([data-slide-gap], [role="checkbox"])');
    if (event.shiftKey ? !label && !(input && session.readOnly) : !input) {
      return;
    }
    const next = block + (event.shiftKey ? -1 : 1);
    if (!Number.isInteger(block) || next < 0 || next >= slides.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focus.current.requested = true;
    focus.current.target =
      !event.shiftKey && !session.readOnly ? 'label' : 'lyrics';
    session.select({block: next, start: 0, end: 0});
  };
  const openMenu = useCallback(
    (anchor: HTMLElement, block: number): void => {
      const slide = session.history.snapshot.song.slides[block];
      if (slide === undefined) return;
      if (!session.history.model.getSnapshot().selection.ids.has(slide.id)) {
        session.selectSlides({type: 'click', id: slide.id});
      }
      setMenu(current => (current?.anchor === anchor ? null : {anchor, block}));
    },
    [session],
  );
  useLayoutEffect(() => {
    const owner = focus.current;
    owner.inputs.length = slides.length;
    if (owner.composing) return;
    const input = owner.inputs[selection.block];
    const previous = restoredSelection.current;
    const needsRestore =
      owner.requested ||
      previous === null ||
      previous.input !== input ||
      previous.block !== selection.block ||
      previous.start !== selection.start ||
      previous.end !== selection.end;
    restoredSelection.current = {input, ...selection};
    const changedBlock = previousBlock.current !== selection.block;
    previousBlock.current = selection.block;
    if (changedBlock) input?.scrollIntoView({block: 'nearest'});
    const ownsFocus =
      document.activeElement instanceof HTMLTextAreaElement &&
      owner.inputs.includes(document.activeElement);
    if (
      input !== undefined &&
      input !== null &&
      needsRestore &&
      (owner.requested || ownsFocus)
    ) {
      owner.restoring = true;
      const target =
        owner.requested && owner.target === 'label'
          ? viewport.current?.querySelector<HTMLElement>(
              `[data-editor-block="${selection.block}"] button:not([data-slide-gap], [role="checkbox"])`,
            )
          : input;
      (target ?? input).focus({preventScroll: true});
      if (target === input) {
        input.setSelectionRange(selection.start, selection.end);
      }
      owner.restoring = false;
      if (owner.requested) input.scrollIntoView({block: 'nearest'});
    }
    owner.requested = false;
    owner.target = 'lyrics';
  });
  return (
    <div
      ref={viewport}
      role="group"
      aria-label="가사"
      className={styles.blocks}
      data-view={view.mode}
      data-slide-columns={columns}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={tab}
    >
      <div className={styles.blockWindow} style={{height: total}}>
        {indices.map(position => {
          if (leadingCard !== undefined && position === 0) {
            if (view.mode === 'grid') {
              return (
                <div
                  key="leading-card"
                  style={{
                    position: 'absolute',
                    top: offsets[0] ?? 0,
                    left: 0,
                    width: cellWidth > 0 ? cellWidth : '100%',
                    height: (offsets[1] ?? 0) - (offsets[0] ?? 0),
                  }}
                >
                  <LeadingSlideCardView
                    card={leadingCard}
                    mode={view.mode}
                    onHeight={setLeadingHeight}
                    style={{position: 'relative'}}
                  />
                </div>
              );
            }
            return (
              <LeadingSlideCardView
                key="leading-card"
                card={leadingCard}
                mode={view.mode}
                onHeight={setLeadingHeight}
                style={{
                  top: offsets[0] ?? 0,
                  left: 0,
                  width: '100%',
                }}
              />
            );
          }
          const block = position - leadingOffset;
          const slide = slides[block];
          return slide === undefined ? null : (
            <SongBlock
              key={block}
              slide={slide}
              block={block}
              session={session}
              renderCard={renderCard}
              focus={focus}
              active={list.selection.ids.has(slide.id)}
              focused={selection.block === block}
              caret={list.selection.caret === block}
              canvas={
                theme === undefined ? undefined : (
                  <SlidePicture
                    output
                    {...theme}
                    background={theme.background}
                    slide={{
                      itemId: song.id,
                      position: block,
                      lines: slide.lines,
                      ...(slide.titleSlide === undefined
                        ? {}
                        : {titleSlide: slide.titleSlide}),
                      ...(slide.titleLayout === undefined
                        ? {}
                        : {titleLayout: slide.titleLayout}),
                      ...(slide.lyricFormat === undefined
                        ? {}
                        : {lyricFormat: slide.lyricFormat}),
                      label: slide.label ?? null,
                    }}
                  />
                )
              }
              locked={state.busy || session.readOnly}
              editable={!session.readOnly}
              color={
                state.labels?.value.labels.find(
                  label => label.name === slide.label,
                )?.color ?? 'none'
              }
              expanded={menu?.block === block}
              onOpen={openMenu}
              top={offsets[Math.floor(position / columns)] ?? 0}
              column={position % columns}
              columns={columns}
              cellWidth={cellWidth}
              columnGap={columnGap}
              grid={view.mode === 'grid'}
              rowHeight={
                view.mode === 'grid'
                  ? (offsets[Math.floor(position / columns) + 1] ?? 0) -
                    (offsets[Math.floor(position / columns)] ?? 0)
                  : undefined
              }
              onMeasure={saveHeight}
              numberOffset={leadingOffset}
            />
          );
        })}
      </div>
      <button
        type="button"
        className={styles.endGap}
        data-slide-gap={slides.length}
        tabIndex={-1}
        data-caret={list.selection.caret === slides.length}
        aria-label="마지막 슬라이드 뒤에 삽입"
        onClick={event => {
          session.selectSlides({type: 'gap', index: slides.length});
          event.currentTarget
            .closest<HTMLElement>('[aria-label="슬라이드 편집 명령"]')
            ?.focus();
        }}
      />
      <div className={styles.addRow}>
        <Button
          variant="ghost"
          icon="plus"
          disabled={state.busy || session.readOnly}
          onClick={() => session.edit({type: 'insert'})}
        >
          슬라이드 추가
        </Button>
        {addCard}
      </div>
      {menu === null ? null : (
        <LabelMenu
          store={store}
          anchor={menu.anchor}
          selected={
            slides[menu.block]?.label === ''
              ? undefined
              : slides[menu.block]?.label
          }
          onChoose={name => {
            session.select({block: menu.block, start: 0, end: 0});
            session.edit({type: 'label', name});
          }}
          onClose={restore => {
            setMenu(null);
            if (restore) menu.anchor.focus();
          }}
        />
      )}
    </div>
  );
}
