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
import {useMeasuredRows} from '@renderer/ui/useMeasuredRows';
import {
  SlideSurfaceView,
  useSlideSurfaceView,
} from '@renderer/features/songs/editor/SlideSurfaceView';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {itemThemes, useThemeSettings} from '@renderer/pictures/itemThemes';
import {LeadingSlideCardView} from '@renderer/features/songs/editor/LeadingSlideCardView';
import {useSongBlockWindow} from '@renderer/features/songs/editor/useSongBlockWindow';
import {SongSlideSurface} from '@renderer/features/songs/editor/SongSlideSurface';
import {visibleGridInsertionPosition} from '@renderer/features/songs/editor/gridInsertionPosition';
import {useShow} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {ItemEditorShell} from '@renderer/platform/ItemEditorShell';
import {ItemEditorAddBar} from '@renderer/platform/ItemEditorAddBar';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import {bibleEditorData, savedItemTiles} from './bibleItemModel';
import {useLeadingItemCard} from './useLeadingItemCard';
import {AddSectionCard} from './AddSectionCard';
import {BibleSlideSession} from './BibleSlideSession';
import {deleteBibleSlides} from './deleteBibleSlides';
import {BibleSlideFields} from './BibleSlideFields';
import {SermonTitleFields} from './SermonTitleFields';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {itemEditorAdapter} from '@renderer/platform/itemEditorAdapter';
import {MeasuredRow} from '../slides/SlideRows';
import type {ServiceItemStore} from './serviceItemStore';
import type {RenderSlideTextFields} from '@renderer/features/songs/editor/SlideCardRenderer';
import styles from './BibleInlineEditor.module.css';

export function BibleInlineEditor({
  items,
  shownItem,
  ui,
  onBack,
  hideHeader = false,
  onSplit,
  renderTextFields,
}: {
  readonly onSplit?: (() => void) | undefined;
  readonly items: ServiceItemStore;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
  readonly ui: Pick<UiApi, 'setLayout'>;
  readonly onBack: () => void;
  readonly hideHeader?: boolean;
  readonly renderTextFields?: RenderSlideTextFields | undefined;
}): JSX.Element | null {
  const current = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const state = shownItem ?? current;
  if (
    state.item === null ||
    (!isItemOfKind(state.item, 'bible') &&
      !isItemOfKind(state.item, 'sermon')) ||
    state.service === null
  ) {
    return null;
  }
  return (
    <BibleEditorContent
      items={items}
      shownItem={shownItem}
      item={state.item}
      serviceId={state.service.service.id}
      position={state.position}
      locked={state.busy || state.service.access === 'readOnly'}
      ui={ui}
      onBack={onBack}
      hideHeader={hideHeader}
      onSplit={onSplit}
      renderTextFields={renderTextFields}
    />
  );
}

function BibleEditorContent({
  items,
  shownItem,
  item,
  serviceId,
  position,
  ui,
  onBack,
  hideHeader,
  onSplit,
  locked,
  renderTextFields,
}: {
  readonly onSplit?: (() => void) | undefined;
  readonly items: ServiceItemStore;
  readonly shownItem?: ReturnType<ServiceItemStore['getSnapshot']> | undefined;
  readonly item: ServiceItemOf<'bible' | 'sermon'>;
  readonly serviceId: string;
  readonly position: number;
  readonly ui: Pick<UiApi, 'setLayout'>;
  readonly onBack: () => void;
  readonly hideHeader: boolean;
  readonly locked: boolean;
  readonly renderTextFields: RenderSlideTextFields | undefined;
}): JSX.Element {
  const saved = useShow(view => savedItemTiles(view, serviceId, item.id));
  const row = useShow(view => view.rows.find(entry => entry.id === item.id));
  const lookup = row?.kind === 'bible' ? row.bible?.passage : undefined;
  const themes = itemThemes(row, saved, useThemeSettings());
  const data = useMemo(() => bibleEditorData(item, saved), [item, saved]);
  const card = useLeadingItemCard(items, item.id, {
    shownItem,
    renderTextFields,
  });
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
  const selection = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const deleteSelection = (removeCard: boolean): void => {
    const selected = [...session.slideModel.getSnapshot().selection.ids]
      .map(Number)
      .sort((left, right) => left - right);
    const tiles = selected.flatMap(index => {
      const tile = verses[index];
      return tile === undefined ? [] : [tile];
    });
    const first = selected[0] ?? 0;
    editorTask(
      deleteBibleSlides({
        items,
        serviceId,
        itemId: item.id,
        tiles,
        lookup,
        removeCard,
      }).then(saved => {
        const current = items.getSnapshot();
        if (
          !saved ||
          current.item?.id !== item.id ||
          current.service?.service.id !== serviceId
        ) {
          return;
        }
        const nextOffset = removeCard ? 0 : offset;
        const remaining = verses.length - tiles.length;
        items.setBibleSelection([]);
        items.selectPosition(
          Math.max(0, Math.min(first, remaining - 1) + nextOffset),
        );
      }),
    );
  };
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
    fallbackHeight: 180 * (9 / 16) + 28,
  });
  const gridCaret =
    selection.selection.caret === null
      ? null
      : visibleGridInsertionPosition(
          {
            index: selection.selection.caret,
            count: verses.length,
            leading: offset,
            columns: windowed.columns,
            width: windowed.cellWidth,
            columnGap: windowed.columnGap,
            offsets: windowed.offsets,
          },
          2,
        );
  return (
    <ItemEditorShell
      className={styles.editor}
      label="성경 편집"
      footer={
        <ItemEditorAddBar
          adapter={itemEditorAdapter(item)}
          count={data.slides.length}
          end={<SlideSurfaceView ui={ui} />}
          title={
            <AddSectionCard
              items={items}
              itemId={item.id}
              shownItem={shownItem}
            />
          }
        />
      }
      header={
        <>
          {hideHeader ? null : (
            <header className={styles.header}>
              <Button onClick={onBack}>‹ 예배 순서</Button>
              <strong>{displayReference(data.reference.ref)}</strong>
            </header>
          )}
          {onSplit === undefined ? null : (
            <Button
              className={styles.split}
              disabled={
                locked || verses[position - offset]?.bibleVerse === undefined
              }
              onClick={onSplit}
            >
              {'절 나누기'}
            </Button>
          )}
        </>
      }
    >
      <SongSlideSurface
        itemKind={itemEditorAdapter(item).kind}
        session={session}
        leadingCard={card}
        mixedLeadingSelection
        contentReadOnly
        deleteSelection={deleteSelection}
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
                    role={
                      mode === 'list' && renderTextFields ? 'group' : 'option'
                    }
                    aria-selected={
                      mode === 'list' && renderTextFields
                        ? undefined
                        : session.slideModel
                            .getSnapshot()
                            .selection.ids.has(String(index - offset))
                    }
                    data-selected={session.slideModel
                      .getSnapshot()
                      .selection.ids.has(String(index - offset))}
                    aria-readonly={
                      renderTextFields ? undefined : slide.readOnly
                    }
                    aria-label={
                      mode === 'list' && renderTextFields
                        ? `${index + 1}번 슬라이드`
                        : undefined
                    }
                    data-song-slide={String(index - offset)}
                    data-slide-index={index - offset}
                    tabIndex={0}
                    onFocusCapture={event => {
                      if (isInTextEntry(event.target)) {
                        session.selectSlides({
                          type: 'click',
                          id: String(index - offset),
                        });
                      }
                    }}
                    onClick={event => {
                      if (
                        event.target instanceof Element &&
                        event.target.closest('button, textarea, input, summary')
                      ) {
                        return;
                      }
                      session.selectSlides({
                        type: 'click',
                        id: String(index - offset),
                        ctrl: event.ctrlKey || event.metaKey,
                        shift: event.shiftKey,
                      });
                    }}
                  >
                    <div className={styles.thumbnail}>
                      <div className={styles.canvas}>
                        <TilePicture
                          tile={slide.tile}
                          slide={slideLayerOf(
                            {itemId: item.id, index: index - offset},
                            () => verses,
                          )}
                          themes={themes}
                        />
                      </div>
                      <SlideThumbnailBand
                        number={index + 1}
                        label={
                          slide.tile.slideLabel ?? slide.tile.label ?? undefined
                        }
                      />
                    </div>
                    {mode === 'grid' ? null : (
                      <div className={styles.verse}>
                        {isItemOfKind(item, 'sermon') &&
                        slide.tile.sermonTitle === true ? (
                          <SermonTitleFields
                            items={items}
                            serviceId={serviceId}
                            item={item}
                            readOnly={locked}
                          />
                        ) : (
                          <BibleSlideFields
                            items={items}
                            serviceId={serviceId}
                            item={item}
                            lookup={lookup}
                            tile={slide.tile}
                            readOnly={locked}
                          />
                        )}
                        {slide.tile.key === undefined
                          ? null
                          : renderTextFields?.(slide.tile.key)}
                      </div>
                    )}
                  </div>
                </MeasuredRow>
              );
            })}
            {selection.selection.caret === null ? null : (
              <div
                className={styles.caret}
                data-slide-gap={selection.selection.caret}
                data-caret="true"
                style={
                  mode === 'grid' && gridCaret !== null
                    ? gridCaret
                    : {
                        top:
                          windowed.offsets[
                            selection.selection.caret + offset
                          ] ?? windowed.total,
                      }
                }
              />
            )}
          </div>
        </div>
      </SongSlideSurface>
    </ItemEditorShell>
  );
}
