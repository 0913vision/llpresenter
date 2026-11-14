import {displayReference} from '@core/bible/displayReference';
import {
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {UiApi} from '@contracts/ipc/ui';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {useBibleTileProjection} from '@renderer/features/bible/useBibleProjections';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import type {ShowTile} from '@core/schema/showService';
import {useMeasuredRows} from '@renderer/ui/useMeasuredRows';
import {
  SlideSurfaceView,
  useSlideSurfaceView,
} from '@renderer/features/songs/editor/SlideSurfaceView';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {LeadingSlideCardView} from '@renderer/features/songs/editor/LeadingSlideCardView';
import {useSongBlockWindow} from '@renderer/features/songs/editor/useSongBlockWindow';
import {SongSlideSurface} from '@renderer/features/songs/editor/SongSlideSurface';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {PanelFooter} from '@renderer/ui/Panel';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import {bibleEditorData, savedPassageTiles} from './bibleItemModel';
import {useLeadingItemCard} from './useLeadingItemCard';
import {AddSectionCard} from './AddSectionCard';
import {BibleSlideSession} from './BibleSlideSession';
import {MeasuredRow} from '../slides/SlideRows';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './BibleInlineEditor.module.css';

export function BibleInlineEditor({
  items,
  ui,
  onBack,
  hideHeader = false,
}: {
  readonly items: ServiceItemStore;
  readonly ui: Pick<UiApi, 'setLayout'>;
  readonly onBack: () => void;
  readonly hideHeader?: boolean;
}): JSX.Element | null {
  const state = useSyncExternalStore(items.subscribe, items.getSnapshot);
  if (
    state.item === null ||
    !isItemOfKind(state.item, 'bible') ||
    state.service === null
  ) {
    return null;
  }
  return (
    <BibleEditorContent
      items={items}
      item={state.item}
      serviceId={state.service.service.id}
      position={state.position}
      locked={state.busy || state.service.access === 'readOnly'}
      ui={ui}
      onBack={onBack}
      hideHeader={hideHeader}
    />
  );
}

function BibleEditorContent({
  items,
  item,
  serviceId,
  position,
  ui,
  onBack,
  hideHeader,
  locked,
}: {
  readonly items: ServiceItemStore;
  readonly item: ServiceItemOf<'bible'>;
  readonly serviceId: string;
  readonly position: number;
  readonly ui: Pick<UiApi, 'setLayout'>;
  readonly onBack: () => void;
  readonly hideHeader: boolean;
  readonly locked: boolean;
}): JSX.Element {
  const saved = useShow(view => savedPassageTiles(view, serviceId, item.id));
  const projection = useBibleTileProjection({itemId: item.id, serviceId});
  const data = useMemo(
    () => bibleEditorData(item, saved, projection?.tiles),
    [item, saved, projection?.tiles],
  );
  const card = useLeadingItemCard(items, item.id);
  const {mode, scale} = useSlideSurfaceView();
  const verses = useMemo(
    () =>
      data.slides
        .filter(slide => slide.kind === 'verse')
        .map(slide => slide.tile),
    [data.slides],
  );
  const rows = useMemo(
    () => data.slides.map(slide => ({lines: slide.tile.lines})),
    [data.slides],
  );
  const offset = Number(card !== undefined);
  const session = useMemo(
    () =>
      new BibleSlideSession(item.id, verses, {items, offset, readOnly: locked}),
    [item.id, verses, items, offset, locked],
  );
  useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const scope = `${item.id}:${mode}:${scale}`;
  const ids = useMemo(
    () =>
      data.slides.map((slide, index) =>
        slide.kind === 'card' ? 'leading-card' : `verse:${index - offset}`,
      ),
    [data.slides, offset],
  );
  const {current, saveHeight} = useMeasuredRows(scope, ids, viewportRef);
  const heights = useMemo(
    () => ids.map(id => current.values[id]),
    [ids, current],
  );
  const saveCardHeight = useCallback(
    (height: number) => saveHeight('leading-card', height),
    [saveHeight],
  );
  const windowed = useSongBlockWindow(rows, position, {
    mode,
    scale,
    viewportRef,
    heights,
  });
  return (
    <section className={styles.editor} aria-label="성경 편집">
      {hideHeader ? null : (
        <header className={styles.header}>
          <Button onClick={onBack}>‹ 예배 순서</Button>
          <strong>{displayReference(data.reference.ref)}</strong>
        </header>
      )}
      <SongSlideSurface
        session={session}
        leadingCard={card}
        mixedLeadingSelection
        contentReadOnly
        onBack={onBack}
        className={styles.surface}
      >
        <div
          ref={viewportRef}
          className={styles.rows}
          data-view={mode}
          data-slide-columns={windowed.columns}
          aria-label="슬라이드 편집 목록"
          onScroll={event =>
            windowed.setScrollTop(event.currentTarget.scrollTop)
          }
        >
          <div className={styles.window} style={{height: windowed.total}}>
            {windowed.indices.map(index => {
              const slide = data.slides[index];
              if (slide === undefined) return null;
              const id = ids[index];
              if (id === undefined) throw new Error('Missing Bible slide ID');
              const style = {
                top:
                  windowed.offsets[Math.floor(index / windowed.columns)] ?? 0,
                left:
                  mode === 'grid'
                    ? (index % windowed.columns) *
                      (windowed.cellWidth + windowed.columnGap)
                    : 0,
                width:
                  mode === 'grid' && windowed.cellWidth > 0
                    ? windowed.cellWidth
                    : '100%',
              };
              return slide.kind === 'card' && card !== undefined ? (
                <MeasuredRow
                  key="card"
                  id="leading-card"
                  onHeight={saveHeight}
                  className={styles.position}
                  style={style}
                >
                  <LeadingSlideCardView
                    card={card}
                    mode={mode}
                    style={{position: 'relative'}}
                    onHeight={saveCardHeight}
                  />
                </MeasuredRow>
              ) : (
                <MeasuredRow
                  key={index}
                  id={id}
                  onHeight={saveHeight}
                  className={styles.position}
                  style={style}
                >
                  <div
                    className={styles.row}
                    role="option"
                    aria-selected={session.slideModel
                      .getSnapshot()
                      .selection.ids.has(String(index - offset))}
                    data-selected={session.slideModel
                      .getSnapshot()
                      .selection.ids.has(String(index - offset))}
                    aria-readonly={slide.readOnly}
                    data-song-slide={String(index - offset)}
                    data-slide-index={index - offset}
                    tabIndex={0}
                    onClick={event =>
                      session.selectSlides({
                        type: 'click',
                        id: String(index - offset),
                        ctrl: event.ctrlKey || event.metaKey,
                        shift: event.shiftKey,
                      })
                    }
                  >
                    <div className={styles.thumbnail}>
                      <div className={styles.canvas}>
                        <VersePicture
                          itemId={item.id}
                          index={index - offset}
                          verses={verses}
                          projection={projection}
                        />
                      </div>
                      <SlideThumbnailBand
                        number={index + 1}
                        label={slide.tile.label ?? undefined}
                      />
                    </div>
                    <div className={styles.verse}>
                      <strong>{slide.tile.label}</strong>
                      <span>{slide.tile.lines.join('\n')}</span>
                    </div>
                  </div>
                </MeasuredRow>
              );
            })}
          </div>
          <div className={styles.add}>
            <AddSectionCard items={items} itemId={item.id} />
          </div>
        </div>
      </SongSlideSurface>
      <PanelFooter
        count={data.slides.length}
        end={<SlideSurfaceView ui={ui} />}
      />
    </section>
  );
}

function VersePicture({
  itemId,
  index,
  verses,
  projection,
}: {
  readonly itemId: string;
  readonly index: number;
  readonly verses: readonly ShowTile[];
  readonly projection: BibleProjection | null;
}): JSX.Element | null {
  const appearance = projection?.appearance;
  const layer = slideLayerOf({itemId, index}, () => verses);
  if (appearance === undefined || layer === null) return null;
  return (
    <SlidePicture
      slide={layer}
      layout={appearance.theme.layout}
      emptyColor={appearance.theme.emptyColor}
      item={appearance.theme.item}
    />
  );
}
