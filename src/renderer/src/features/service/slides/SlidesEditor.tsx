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
import {canChooseItemTheme} from '@core/themes/sectionThemeChoices';
import {SLIDES_LIMITS} from '@core/schema/service';
import type {ThemesFile} from '@core/schema/themes';
import {BibleSlidesDialog} from '@renderer/features/bible/BibleSlidesDialog';
import {
  newTextSlide,
  SLIDES_LIMIT,
  type Slide,
  type SlidesDraft,
  type SlidesItem,
} from '@core/services/slidesEdits';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {SlideFields} from './SlideFields';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {useSlideDefaults} from '@renderer/features/songs/editor/useSlideDefaults';
import {useEditorFocus} from '@renderer/features/songs/editor/useEditorFocus';
import {Button, TextField} from '@renderer/ui';
import {ItemEditorAddBar} from '@renderer/platform/ItemEditorAddBar';
import {ItemEditorShell} from '@renderer/platform/ItemEditorShell';
import {itemEditorAdapter} from '@renderer/platform/itemEditorAdapter';
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
  useSlidesItemWithBackground,
  useSlidesThemes,
} from './SlidesVisuals';
import type {SlidesEditorModel} from './useSlidesEditor';
import {SlideRows, type SlideCardRenderer} from './SlideRows';
import type {RenderSlideTextFields} from '@renderer/features/songs/editor/SlideCardRenderer';
import type {LeadingSlideCard} from '../../songs/editor/SlideCardRenderer';
import {SlideSurfaceView} from '../../songs/editor/SlideSurfaceView';
import styles from './SlidesEditor.module.css';
import {SlidesBackButton} from './SlidesBackButton';
import headerStyles from '../../songs/editor/SongHeader.module.css';
import {SlideTransitionMark} from '@renderer/ui/SlideTransitionMark';

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
  readonly themes: ThemesFile | undefined;
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
                ...(themes?.deletedThemes ?? [])
                  .filter(theme => theme.id === item.theme)
                  .map(theme => ({
                    value: theme.id,
                    label: `(${theme.name})`,
                    disabled: true,
                    title: '삭제된 테마',
                  })),
                ...(themes?.themes ?? [])
                  .filter(theme => canChooseItemTheme(item, theme.id))
                  .map(theme => ({
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
        </div>
      </header>
    </>
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
  renderTextFields,
}: {
  readonly api: LlpApi;
  readonly model: SlidesEditorModel;
  readonly store?: SongEditorStore | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly renderCard?: SlideCardRenderer | undefined;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly addCard?: ReactNode;
  readonly renderTextFields?: RenderSlideTextFields | undefined;
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
      renderTextFields={renderTextFields}
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
  renderTextFields,
}: {
  readonly api: LlpApi;
  readonly model: SlidesEditorModel;
  readonly store?: SongEditorStore | undefined;
  readonly onBack?: (() => void) | undefined;
  readonly draft: SlidesDraft;
  readonly renderCard?: SlideCardRenderer | undefined;
  readonly leadingCard?: LeadingSlideCard | undefined;
  readonly addCard?: ReactNode;
  readonly renderTextFields?: RenderSlideTextFields | undefined;
}): JSX.Element {
  const {item: draftItem, selected} = draft.snapshot;
  const slideDefaults = useSlideDefaults();
  const item = useSlidesItemWithBackground(draftItem);
  const serviceName = useShow(view => view.serviceName);
  const root = useRef<HTMLDivElement>(null);
  const {focusText, consumeTextFocus} = model;
  useEditorFocus(root, model.session, {onBack});
  useLayoutEffect(() => {
    if (!focusText) return;
    const row = root.current?.querySelector('[data-slide-index="0"]');
    const field = row?.querySelector<HTMLTextAreaElement>('textarea');
    if (field === null || field === undefined) return;
    field.focus({preventScroll: true});
    consumeTextFocus();
  }, [draft, focusText, consumeTextFocus]);
  useWindowShortcuts([
    {
      id: 'songWindow.save',
      context: 'song',
      when: () => !model.stopped && root.current?.closest('[inert]') === null,
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
  const {themes, file, themeName} = useSlidesThemes(item, {api});
  const [bibleDialog, setBibleDialog] = useState(false);
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
    if (bibleDialog) {
      restoreBibleFocus.current = true;
      return;
    }
    if (!restoreBibleFocus.current) return;
    restoreBibleFocus.current = false;
    const row =
      rowList.current?.querySelectorAll<HTMLElement>('[data-slide-id]')[at];
    row?.focus({preventScroll: true});
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
    (target ?? rowList.current)?.focus({preventScroll: true});
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
      bibleDialog
    ) {
      return;
    }
    if (
      event.ctrlKey &&
      !event.altKey &&
      isInTextEntry(event.target) &&
      !(
        event.target instanceof Element &&
        event.target.matches('[data-slide-box-text]')
      ) &&
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
      <ItemEditorShell
        as="div"
        className={styles.left}
        footer={
          <ItemEditorAddBar
            adapter={itemEditorAdapter(item)}
            end={<SlideSurfaceView ui={api.ui} />}
            count={rows.length + (leadingCard === undefined ? 0 : 1)}
            title={addCard}
            picture={
              <Button
                variant="ghost"
                icon="plus"
                disabled={
                  model.stopped ||
                  model.session?.readOnly === true ||
                  bibleDialog ||
                  picker !== null ||
                  rows.length >= SLIDES_LIMIT
                }
                onClick={event => showPicker(event.currentTarget)}
              >
                그림 추가
              </Button>
            }
            verse={
              <Button
                variant="ghost"
                icon="plus"
                disabled={
                  model.stopped ||
                  model.session?.readOnly === true ||
                  bibleDialog ||
                  picker !== null ||
                  rows.length >= SLIDES_LIMIT
                }
                onClick={() => setBibleDialog(true)}
              >
                성경 구절 추가…
              </Button>
            }
            slide={
              <Button
                variant="ghost"
                icon="plus"
                disabled={
                  model.stopped ||
                  model.session?.readOnly === true ||
                  bibleDialog ||
                  picker !== null ||
                  rows.length >= SLIDES_LIMIT
                }
                onClick={() => {
                  model.session?.requestReveal();
                  draft.insert([
                    newTextSlide(
                      item.slides.form,
                      slideDefaults[item.slides.form],
                    ),
                  ]);
                  update();
                }}
              >
                슬라이드 추가
              </Button>
            }
          />
        }
        header={
          <>
            <SlidesHeader
              draft={draft}
              disabled={model.stopped || model.session?.readOnly === true}
              onBack={onBack}
              serviceName={serviceName}
              update={update}
              themes={file}
              themeName={themeName}
              onCommitName={() =>
                rowList.current
                  ?.querySelector<HTMLTextAreaElement>('textarea')
                  ?.focus()
              }
            />
          </>
        }
      >
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
              bibleDialog ||
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
              model.session?.requestReveal();
              if (
                draft.insert([
                  newTextSlide(
                    item.slides.form,
                    slideDefaults[item.slides.form],
                  ),
                ])
              ) {
                update();
              }
            }}
            renderRow={(slide, index, mode) => (
              <>
                <div className={styles.thumbnail} data-editor-thumbnail>
                  <div className={styles.thumbnailCanvas}>
                    <SlidesCanvas item={item} index={index} themes={themes} />
                    <SlideTransitionMark transition={slide.transition} />
                  </div>
                  <SlideThumbnailBand
                    number={index + 1 + (leadingCard === undefined ? 0 : 1)}
                    label={slideBand(item, slide, media)}
                    labelColor={
                      item.slides.form === 'ad'
                        ? undefined
                        : labels.find(label => label.name === slide.label)
                            ?.color
                    }
                  />
                </div>
                {mode === 'grid' ? null : (
                  <div className={styles.fieldColumn}>
                    <SlideFields
                      slide={slide}
                      form={item.slides.form}
                      name={slideBand(item, slide, media)}
                      replace={button => showPicker(button, slide.id)}
                      change={(next, field) => changeSlide(index, next, field)}
                      endTyping={() => draft.endTyping()}
                    />
                    {renderTextFields?.(slide.id)}
                  </div>
                )}
              </>
            )}
          />
        </fieldset>
      </ItemEditorShell>
      {onBack !== undefined ? null : (
        <div className={styles.side}>
          <SlidesPreview api={api} item={item} selected={at} media={media} />
        </div>
      )}
      {!bibleDialog ? null : (
        <BibleSlidesDialog
          api={api}
          item={item}
          onInsert={slides => {
            model.session?.requestReveal();
            if (draft.insert(slides)) {
              update();
            }
          }}
          onClose={() => setBibleDialog(false)}
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
              model.session?.requestReveal();
              draft.insert([
                {
                  id: createSlideId(crypto.randomUUID()),
                  media: id,
                  transition: slideDefaults[item.slides.form],
                },
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
