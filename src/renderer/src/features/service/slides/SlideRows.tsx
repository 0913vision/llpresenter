import {
  useLayoutEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import type {SongEditorStore} from '../../songs/editor/songEditorStore';
import type {Slide, SlidesDraft} from '@core/services/slidesEdits';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {SongSlideSurface} from '../../songs/editor/SongSlideSurface';
import {SlidesListSession} from './slidesListSession';
import {useMeasuredRows} from '@renderer/ui/useMeasuredRows';
import styles from './SlidesEditor.module.css';
import {EditorSlideNumber} from '../../songs/editor/EditorSlideNumber';
import plate from '../../songs/editor/EditorSlidePlate.module.css';
import {useSongBlockWindow} from '../../songs/editor/useSongBlockWindow';
import {useSlideSurfaceView} from '../../songs/editor/SlideSurfaceView';

import {
  LEADING_CARD_WINDOW_ITEM,
  type LeadingSlideCard,
  type SlideCardRenderer,
} from '../../songs/editor/SlideCardRenderer';
import {LeadingSlideCardView} from '../../songs/editor/LeadingSlideCardView';
export type {SlideCardRenderer} from '../../songs/editor/SlideCardRenderer';

export function MeasuredRow({
  children,
  style,
  onHeight,
  id,
  className = styles.rowPosition,
}: {
  readonly children: ReactNode;
  readonly style: CSSProperties;
  readonly onHeight: (id: string, height: number) => void;
  readonly id: string;
  readonly className?: string | undefined;
}): JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = rowRef.current;
    if (node === null) return;
    const measure = (): void => {
      const height = node.getBoundingClientRect().height;
      if (height > 0) onHeight(id, height);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onHeight]);
  return (
    <div className={className} style={style} data-measured-row>
      <div ref={rowRef}>{children}</div>
    </div>
  );
}

export function SlideRows({
  draft,
  store,
  blocked,
  report,
  list: listRef,
  renderRow,
  renderCard,
  leadingCard,
  children,
  session,
  onBack,
  onAdd,
}: {
  readonly draft: SlidesDraft;
  readonly store?: SongEditorStore | undefined;
  readonly blocked: boolean;
  readonly update: () => void;
  readonly report: (message: string) => void;
  readonly list: RefObject<HTMLDivElement | null>;
  readonly renderRow: (slide: Slide, index: number) => ReactNode;
  /** Return a card body to replace the normal row or cell contents. */
  readonly renderCard?: SlideCardRenderer | undefined;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly children?: ReactNode;
  readonly session?: SlidesListSession | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly onAdd?: ((index: number) => void) | undefined;
}): JSX.Element {
  const fallback = useMemo(
    () =>
      new SlidesListSession(draft, {
        locked: () => false,
        problem: message => console.error(message),
      }),
    [draft],
  );
  useLayoutEffect(
    () => fallback.configure({locked: () => blocked, problem: report}),
    [fallback, blocked, report],
  );
  const commands = session ?? fallback;
  useSyncExternalStore(
    commands.slideModel.subscribe,
    commands.slideModel.getSnapshot,
  );
  const {item, selection, selected} = draft.snapshot;
  const rows = item.slides.slides;
  const view = useSlideSurfaceView();
  const scope = `${view.mode}:${view.scale}`;
  const ids: string[] = rows.map(slide => slide.id);
  if (leadingCard !== undefined) ids.push('leading-card');
  const {current, saveHeight} = useMeasuredRows(scope, ids, listRef);
  const leadingOffset = leadingCard === undefined ? 0 : 1;
  const heights = useMemo(() => {
    const values = rows.map(slide => current.values[slide.id]);
    return leadingCard === undefined
      ? values
      : [current.values['leading-card'], ...values];
  }, [rows, current, leadingCard]);
  const windowSlides = useMemo(() => {
    const content = rows.map(slide => ({
      lines: 'text' in slide ? slide.text.split('\n') : [''],
    }));
    return leadingCard === undefined
      ? content
      : [LEADING_CARD_WINDOW_ITEM, ...content];
  }, [rows, leadingCard]);
  const {total, offsets, columns, cellWidth, columnGap, indices, setScrollTop} =
    useSongBlockWindow(windowSlides, selected + leadingOffset, {
      mode: view.mode,
      scale: view.scale,
      viewportRef: listRef,
      heights,
    });
  const gap = (index: number): ReactNode => (
    <button
      type="button"
      className={styles.gap}
      aria-label={`${index + 1}번째 위치에 삽입`}
      data-gap-index={index}
      data-slide-gap={index}
      data-caret={selection.caret === index || undefined}
      tabIndex={-1}
      onClick={event => {
        commands.selectSlides({type: 'gap', index});
        event.currentTarget
          .closest<HTMLElement>('[aria-label="슬라이드 편집 명령"]')
          ?.focus();
      }}
    />
  );
  return (
    <SongSlideSurface
      session={commands}
      store={store}
      leadingCard={leadingCard}
      report={commands.reportNotice}
      blocked={blocked}
      onBack={onBack}
      onAdd={onAdd}
      className={styles.rowSurface}
    >
      <div
        ref={listRef}
        className={styles.rows}
        data-view={view.mode}
        data-slide-columns={columns}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        aria-label="슬라이드 편집 목록"
        tabIndex={-1}
      >
        <div className={styles.rowWindow} style={{height: total}}>
          {indices.map(position => {
            if (leadingCard !== undefined && position === 0) {
              return (
                <MeasuredRow
                  key="leading-card"
                  id="leading-card"
                  onHeight={saveHeight}
                  style={{
                    top: offsets[0] ?? 0,
                    left: 0,
                    height:
                      view.mode === 'grid'
                        ? (offsets[1] ?? 0) - (offsets[0] ?? 0)
                        : undefined,
                    width:
                      view.mode === 'grid' && cellWidth > 0
                        ? cellWidth
                        : '100%',
                  }}
                >
                  <LeadingSlideCardView
                    card={leadingCard}
                    mode={view.mode}
                    style={{position: 'relative'}}
                  />
                </MeasuredRow>
              );
            }
            const index = position - leadingOffset;
            const slide = rows[index];
            if (slide === undefined) return null;
            return (
              <MeasuredRow
                key={slide.id}
                id={slide.id}
                onHeight={saveHeight}
                style={{
                  top: offsets[Math.floor(position / columns)] ?? 0,
                  left:
                    view.mode === 'grid' && cellWidth > 0
                      ? `${(position % columns) * (cellWidth + columnGap)}px`
                      : `${((position % columns) * 100) / columns}%`,
                  height:
                    view.mode === 'grid'
                      ? (offsets[Math.floor(position / columns) + 1] ?? 0) -
                        (offsets[Math.floor(position / columns)] ?? 0)
                      : undefined,
                  width:
                    view.mode === 'grid' && cellWidth > 0
                      ? `${cellWidth}px`
                      : `${100 / columns}%`,
                }}
              >
                {gap(index)}
                <div
                  className={`${styles.row} ${plate.row} ${view.mode === 'grid' ? plate.grid : ''}`}
                  data-active={selection.ids.has(slide.id)}
                  data-selected={selection.ids.has(slide.id) || undefined}
                  data-focused={selected === index}
                  tabIndex={-1}
                  data-slide-id={slide.id}
                  data-song-slide={slide.id}
                  data-slide-index={index}
                  data-editor-block={index}
                  draggable={!blocked}
                  onClick={event => {
                    if (
                      isInTextEntry(event.target) ||
                      (event.target instanceof Element &&
                        event.target.closest('button') !== null)
                    ) {
                      return;
                    }
                    commands.selectSlides({
                      type: 'click',
                      id: slide.id,
                      shift: event.shiftKey,
                      ctrl: event.ctrlKey || event.metaKey,
                    });
                  }}
                  onFocusCapture={event => {
                    if (isInTextEntry(event.target)) {
                      commands.selectSlides({type: 'click', id: slide.id});
                    }
                  }}
                >
                  {view.mode === 'grid' ? null : (
                    <EditorSlideNumber
                      number={index + 1 + leadingOffset}
                      selected={selection.ids.has(slide.id)}
                      onToggle={() =>
                        commands.selectSlides({
                          type: 'click',
                          id: slide.id,
                          ctrl: true,
                        })
                      }
                    />
                  )}
                  {renderCard?.(slide, index, view.mode) ??
                    renderRow(slide, index)}
                </div>
              </MeasuredRow>
            );
          })}
        </div>
        {gap(rows.length)}
        {children}
      </div>
    </SongSlideSurface>
  );
}
