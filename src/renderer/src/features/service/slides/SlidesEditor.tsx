import type {SongEditorStore} from '../../songs/editor/songEditorStore';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {createSlideId, themeIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import {withItemTheme} from '@core/services/itemFieldChanges';
import {SLIDES_LIMITS, type VerseSlide} from '@core/schema/service';
import {BibleSlidesDialog} from '@renderer/features/bible/BibleSlidesDialog';
import {useSlidesVerseProjection} from '@renderer/features/bible/useSlidesVerseProjection';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import {
  newTextSlide,
  SLIDES_LIMIT,
  type Slide,
  type SlidesDraft,
  type SlidesItem,
} from '@core/services/slidesEdits';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {useEditorFocus} from '@renderer/features/songs/editor/useEditorFocus';
import {Button, Checkbox, PanelFooter, TextField} from '@renderer/ui';
import {TextArea} from '@renderer/ui/TextArea';
import {SlideThumbnailBand} from '@renderer/ui/SlideThumbnail';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {useShow} from '@renderer/session/show';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {isComposing} from '@renderer/ui/ime';
import {useItemMedia, useItemSettings} from '../items/useItemSources';
import {
  SlidesCanvas,
  SlidesPreview,
  slideBand,
  useSlidesAppearance,
  useSlidesItemWithBackground,
} from './SlidesVisuals';
import type {SlidesEditorModel} from './useSlidesEditor';
import {SlideRows, type SlideCardRenderer} from './SlideRows';
import type {LeadingSlideCard} from '../../songs/editor/SlideCardRenderer';
import {SlideSurfaceView} from '../../songs/editor/SlideSurfaceView';
import styles from './SlidesEditor.module.css';
import {SlidesBackButton} from './SlidesBackButton';
import headerStyles from '../../songs/editor/SongHeader.module.css';
import {SlideTransitionMark} from '@renderer/ui/SlideTransitionMark';

const ADVANCES = [3, 5, 8, 10, 15, 20, 30];
const TEXT_LIMIT = SLIDES_LIMITS.text;
const NAME_LIMIT = SLIDES_LIMITS.name;

function SlidesHeader({
  draft,
  update,
  themes,
  themeName,
  onCommitName,
  onBack,
  serviceName,
  disabled,
}: {
  readonly draft: SlidesDraft;
  readonly update: () => void;
  readonly themes: ReturnType<typeof useSlidesAppearance>['themes'];
  readonly themeName: string;
  readonly onCommitName: () => void;
  readonly onBack: (() => void) | undefined;
  readonly serviceName: string;
  readonly disabled: boolean;
}): JSX.Element {
  const {item} = draft.snapshot;
  const change = (slides: SlidesItem['slides'], typing?: string): void => {
    draft.change({...item, slides}, undefined, typing);
    update();
  };
  return (
    <>
      <header className={headerStyles.header} data-inline="true">
        {onBack === undefined ? null : (
          <SlidesBackButton serviceName={serviceName} onBack={onBack} />
        )}
        <span className={headerStyles.unsaved} data-empty aria-hidden="true" />
        <div className={headerStyles.title}>
          <TextField
            aria-label="이름"
            variant="title"
            block
            disabled={disabled}
            value={item.slides.name}
            maxLength={NAME_LIMIT}
            onChange={name => change({...item.slides, name}, 'item-name')}
            onBlur={() => draft.endTyping()}
            onKeyDown={event => {
              if (
                (event.key === 'Enter' || event.key === 'Tab') &&
                !event.shiftKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.metaKey &&
                !isComposing(event)
              ) {
                event.preventDefault();
                draft.endTyping();
                onCommitName();
              }
            }}
          />
        </div>
      </header>
      <div className={styles.settings}>
        <span className={styles.setting}>
          <span>테마</span>
          <SelectMenu
            aria-label="테마"
            disabled={disabled}
            size="sm"
            value={item.theme ?? ''}
            valueText={themeName}
            options={[
              {value: '', label: '기본'},
              ...(themes?.themes ?? []).map(theme => ({
                value: theme.id,
                label: theme.name,
              })),
            ]}
            onChange={id => {
              const parsed = parsePayload(themeIdSchema, id);
              if (id !== '' && !parsed.ok) return;
              const chosen = parsed.ok ? parsed.value : undefined;
              draft.change(withItemTheme(item, chosen, themes));
              update();
            }}
          />
        </span>
        <span className={styles.setting}>
          <span>넘기기</span>
          <SelectMenu
            aria-label="넘기기"
            disabled={disabled}
            size="sm"
            value={String(item.slides.advance ?? '')}
            options={[
              {value: '', label: '손으로'},
              ...ADVANCES.map(seconds => ({
                value: String(seconds),
                label: `${seconds}초마다`,
              })),
            ]}
            onChange={value => {
              const slides = {...item.slides};
              if (value === '') delete slides.advance;
              else slides.advance = Number(value);
              change(slides);
            }}
          />
        </span>
        <span className={styles.setting}>
          <Checkbox
            aria-label="반복"
            disabled={disabled}
            checked={item.slides.loop ?? false}
            onChange={loop => change({...item.slides, loop})}
          />
          <span>반복</span>
        </span>
      </div>
    </>
  );
}

function SlideFields({
  slide,
  form,
  name,
  projection,
  replace,
  change,
  endTyping,
}: {
  readonly slide: Slide;
  readonly form: SlidesItem['slides']['form'];
  readonly name: string;
  readonly projection: BibleProjection | null;
  readonly replace: (button: HTMLElement) => void;
  readonly change: (slide: Slide, field: string) => void;
  readonly endTyping: () => void;
}): JSX.Element {
  if ('verse' in slide) {
    const index = projection?.tiles.findIndex(
      tile => tile.sourceSlideId === slide.id,
    );
    const tile = index === undefined ? undefined : projection?.tiles[index];
    const part =
      index === undefined ? undefined : projection?.partsByTile[index];
    return (
      <div className={styles.fields}>
        <span className={styles.verseReference}>
          {tile?.reference ?? name}
          {part !== null && part !== undefined && part.partCount > 1
            ? ` (${part.part}/${part.partCount})`
            : ''}
        </span>
        <span className={styles.verseText}>
          {part?.text ?? tile?.lines.join('\n')}
        </span>
      </div>
    );
  }
  if ('media' in slide) {
    return (
      <div className={styles.pictureFile}>
        <span>{name}</span>
        <Button variant="ghost" onClick={event => replace(event.currentTarget)}>
          바꾸기
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.fields} data-form={form}>
      {form === 'ad' ? (
        <>
          <label htmlFor={`name-${slide.id}`}>이름</label>
          <TextField
            className={styles.nameField}
            id={`name-${slide.id}`}
            aria-label="슬라이드 이름"
            value={slide.name ?? ''}
            maxLength={NAME_LIMIT}
            onChange={name => change({...slide, name}, 'name')}
            onBlur={endTyping}
          />
        </>
      ) : null}
      {form === 'ad' ? <label htmlFor={`text-${slide.id}`}>내용</label> : null}
      <TextArea
        id={`text-${slide.id}`}
        aria-label={form === 'ad' ? '내용' : '글'}
        value={slide.text}
        maxLength={TEXT_LIMIT}
        onChange={text => change({...slide, text}, 'text')}
        onBlur={endTyping}
      />
    </div>
  );
}

export function SlidesEditor({
  api,
  model,
  store,
  onBack,
  renderCard,
  leadingCard,
  addCard,
}: {
  readonly api: LlpApi;
  readonly model: SlidesEditorModel;
  readonly store?: SongEditorStore | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly renderCard?: SlideCardRenderer | undefined;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly addCard?: ReactNode;
}): JSX.Element | null {
  const {draft} = model;
  if (draft === null) return null;
  return (
    <SlidesEditorBody
      key={draft.snapshot.item.id}
      api={api}
      model={model}
      store={store}
      draft={draft}
      onBack={onBack}
      renderCard={renderCard}
      leadingCard={leadingCard}
      addCard={addCard}
    />
  );
}

function SlidesEditorBody({
  api,
  model,
  store,
  onBack,
  draft,
  renderCard,
  leadingCard,
  addCard,
}: {
  readonly api: LlpApi;
  readonly model: SlidesEditorModel;
  readonly store?: SongEditorStore | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly draft: SlidesDraft;
  readonly renderCard?: SlideCardRenderer | undefined;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly addCard?: ReactNode;
}): JSX.Element {
  const {item: draftItem, selected} = draft.snapshot;
  const item = useSlidesItemWithBackground(draftItem);
  const serviceName = useShow(view => view.serviceName);
  const root = useRef<HTMLDivElement>(null);
  const {focusText, consumeTextFocus} = model;
  useEditorFocus(root, model.session, {onBack});
  useLayoutEffect(() => {
    if (!focusText) return;
    root.current
      ?.querySelector<HTMLTextAreaElement>('[data-slide-index="0"] textarea')
      ?.focus({preventScroll: true});
    consumeTextFocus();
  }, [draft, focusText, consumeTextFocus]);
  useWindowShortcuts([
    {
      id: 'songWindow.save',
      context: 'song',
      when: () => !model.stopped,
      run: () => editorTask(model.flush()),
    },
  ]);
  const labelsDoc = useItemSettings(
    api.settings,
    'labels',
    store !== undefined,
  ).document;
  const labels = labelsDoc?.name === 'labels' ? labelsDoc.value.labels : [];
  const mediaSource = useItemMedia(api.media);
  const media = mediaSource.document?.value.items ?? [];
  const {appearance, themes} = useSlidesAppearance(api, item);
  const {projection} = useSlidesVerseProjection(api, item);
  const [bibleDialog, setBibleDialog] = useState<{
    reference?: VerseSlide['verse'];
  } | null>(null);
  const [picker, setPicker] = useState<{
    anchor: HTMLElement;
    slideId?: string;
  } | null>(null);
  const [query, setQuery] = useState('');
  const rowList = useRef<HTMLDivElement>(null);
  const focusAfterRemove = useRef(false);
  const update = (): void => model.update();
  const rows = item.slides.slides;
  const at = Math.max(0, Math.min(selected, rows.length - 1));
  const restoreBibleFocus = useRef(false);
  useEffect(() => {
    if (bibleDialog !== null) {
      restoreBibleFocus.current = true;
      return;
    }
    if (!restoreBibleFocus.current) return;
    restoreBibleFocus.current = false;
    const row =
      rowList.current?.querySelectorAll<HTMLElement>('[data-slide-id]')[at];
    row?.focus();
  }, [bibleDialog, at]);
  useLayoutEffect(() => {
    if (!focusAfterRemove.current) return;
    focusAfterRemove.current = false;
    const caret = draft.snapshot.selection.caret;
    const target =
      caret === null
        ? rowList.current?.querySelectorAll<HTMLElement>('[data-slide-id]')[at]
        : rowList.current?.querySelector<HTMLElement>(
            `[data-gap-index="${caret}"]`,
          );
    (target ?? rowList.current)?.focus();
  });
  const showPicker = (anchor: HTMLElement, slideId?: string): void => {
    setQuery('');
    setPicker({anchor, ...(slideId === undefined ? {} : {slideId})});
  };
  const changeSlide = (index: number, next: Slide, field: string): void => {
    draft.change(
      {
        ...item,
        slides: {
          ...item.slides,
          slides: rows.map((slide, at) => (at === index ? next : slide)),
        },
      },
      index,
      `${next.id}:${field}`,
    );
    update();
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      isComposing(event) ||
      model.stopped ||
      bibleDialog !== null
    ) {
      return;
    }
    const verse = rows[at];
    if (
      event.ctrlKey &&
      !event.altKey &&
      event.code === 'KeyE' &&
      verse !== undefined &&
      'verse' in verse
    ) {
      event.preventDefault();
      event.stopPropagation();
      setBibleDialog({reference: verse.verse});
      return;
    }
    if (
      event.ctrlKey &&
      !event.altKey &&
      isInTextEntry(event.target) &&
      ['z', 'y'].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
      event.stopPropagation();
      const focusedRow =
        document.activeElement?.closest<HTMLElement>('[data-slide-id]');
      if (event.key.toLowerCase() === 'y' || event.shiftKey) draft.redo();
      else draft.undo();
      focusAfterRemove.current =
        focusedRow != null &&
        rowList.current?.contains(focusedRow) === true &&
        !draft.snapshot.item.slides.slides.some(
          slide => slide.id === focusedRow.dataset['slideId'],
        );
      update();
    }
  };
  return (
    <div
      ref={root}
      className={styles.layout}
      data-inline={onBack !== undefined || undefined}
      aria-label="슬라이드 편집"
      onKeyDownCapture={keyDown}
    >
      <div className={styles.left}>
        <SlidesHeader
          draft={draft}
          disabled={model.stopped || model.session?.readOnly === true}
          onBack={onBack}
          serviceName={serviceName}
          update={update}
          themes={themes}
          themeName={appearance.themeName}
          onCommitName={() =>
            rowList.current
              ?.querySelector<HTMLTextAreaElement>('textarea')
              ?.focus()
          }
        />
        <fieldset
          className={styles.editable}
          disabled={model.stopped || model.session?.readOnly === true}
          inert={model.stopped || model.session?.readOnly === true}
        >
          <SlideRows
            draft={draft}
            store={store}
            blocked={
              model.stopped ||
              model.session?.readOnly === true ||
              bibleDialog !== null ||
              picker !== null
            }
            update={update}
            report={model.problem}
            list={rowList}
            session={model.session ?? undefined}
            onBack={onBack}
            leadingCard={leadingCard}
            renderCard={renderCard}
            onAdd={index => {
              draft.selectRows({type: 'gap', index});
              if (draft.insert([newTextSlide(item.slides.form)])) update();
            }}
            renderRow={(slide, index) => (
              <>
                <div className={styles.thumbnail} data-editor-thumbnail>
                  <div className={styles.thumbnailCanvas}>
                    <SlidesCanvas
                      item={item}
                      index={index}
                      appearance={appearance}
                      projection={projection}
                      thumbnail
                    />
                    <SlideTransitionMark transition={slide.transition} />
                  </div>
                  <SlideThumbnailBand
                    number={index + 1 + (leadingCard === undefined ? 0 : 1)}
                    label={slideBand(slide, media)}
                    labelColor={
                      labels.find(label => label.name === slide.label)?.color
                    }
                  />
                </div>
                <SlideFields
                  slide={slide}
                  form={item.slides.form}
                  name={slideBand(slide, media)}
                  projection={projection}
                  replace={button => showPicker(button, slide.id)}
                  change={(next, field) => changeSlide(index, next, field)}
                  endTyping={() => draft.endTyping()}
                />
              </>
            )}
          >
            <div className={styles.add}>
              <Button
                variant="ghost"
                icon="plus"
                disabled={
                  model.stopped ||
                  model.session?.readOnly === true ||
                  rows.length >= SLIDES_LIMIT
                }
                onClick={event => showPicker(event.currentTarget)}
              >
                그림 추가
              </Button>
              {item.slides.form !== 'blank' ? null : (
                <Button
                  variant="ghost"
                  icon="plus"
                  disabled={
                    model.stopped ||
                    model.session?.readOnly === true ||
                    rows.length >= SLIDES_LIMIT
                  }
                  onClick={() => setBibleDialog({})}
                >
                  성경 구절 추가…
                </Button>
              )}
            </div>
          </SlideRows>
        </fieldset>
        <PanelFooter
          end={<SlideSurfaceView ui={api.ui} />}
          count={rows.length + (leadingCard === undefined ? 0 : 1)}
        >
          {addCard}
          <Button
            variant="ghost"
            icon="plus"
            disabled={
              model.stopped ||
              model.session?.readOnly === true ||
              bibleDialog !== null ||
              picker !== null ||
              rows.length >= SLIDES_LIMIT
            }
            onClick={() => {
              draft.insert([newTextSlide(item.slides.form)]);
              update();
            }}
          >
            슬라이드 추가
          </Button>
        </PanelFooter>
      </div>
      {onBack !== undefined ? null : (
        <div className={styles.side}>
          <SlidesPreview
            api={api}
            item={item}
            selected={at}
            media={media}
            projection={projection}
          />
        </div>
      )}
      {bibleDialog === null ? null : (
        <BibleSlidesDialog
          api={api}
          item={item}
          selected={at}
          {...(bibleDialog.reference === undefined
            ? {}
            : {reference: bibleDialog.reference})}
          onInsert={slides => {
            if (draft.insert(slides)) {
              update();
            }
          }}
          onClose={() => setBibleDialog(null)}
        />
      )}
      {picker === null ? null : (
        <MediaPicker
          label="그림 선택"
          allowNone={false}
          anchor={picker.anchor}
          items={media.filter(file => file.kind === 'image')}
          selected={undefined}
          query={query}
          onQueryChange={setQuery}
          onSelect={id => {
            if (id === undefined) return;
            if (picker.slideId === undefined) {
              draft.insert([
                {id: createSlideId(crypto.randomUUID()), media: id},
              ]);
            } else {
              const index = rows.findIndex(
                slide => slide.id === picker.slideId,
              );
              const slide = rows[index];
              if (slide !== undefined && 'media' in slide) {
                changeSlide(index, {...slide, media: id}, 'picture');
              }
            }
            update();
          }}
          onClose={restore => {
            if (restore) picker.anchor.focus();
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
