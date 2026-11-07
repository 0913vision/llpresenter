import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {createSlideId, themeIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
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
import {Button, Checkbox, PanelFooter, TextField} from '@renderer/ui';
import {TextArea} from '@renderer/ui/TextArea';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {isComposing} from '@renderer/ui/ime';
import {useItemMedia} from '../items/useItemSources';
import {
  SlidesCanvas,
  SlidesPreview,
  slideBand,
  useSlidesAppearance,
} from './SlidesVisuals';
import type {SlidesEditorModel} from './useSlidesEditor';
import {useSlidesSaveFocus} from './useSlidesSaveFocus';
import {SlideRows} from './SlideRows';
import styles from './SlidesEditor.module.css';

const ADVANCES = [3, 5, 8, 10, 15, 20, 30];
const TEXT_LIMIT = SLIDES_LIMITS.text;
const NAME_LIMIT = SLIDES_LIMITS.name;

function SlidesHeader({
  draft,
  update,
  themes,
  themeName,
}: {
  readonly draft: SlidesDraft;
  readonly update: () => void;
  readonly themes: ReturnType<typeof useSlidesAppearance>['themes'];
  readonly themeName: string;
}): JSX.Element {
  const {item} = draft.snapshot;
  const change = (slides: SlidesItem['slides'], typing?: string): void => {
    draft.change({...item, slides}, undefined, typing);
    update();
  };
  return (
    <header className={styles.header}>
      <TextField
        aria-label="이름"
        variant="title"
        value={item.slides.name}
        maxLength={NAME_LIMIT}
        onChange={name => change({...item.slides, name}, 'item-name')}
        onBlur={() => draft.endTyping()}
      />
      <span className={styles.setting}>
        <span>테마</span>
        <SelectMenu
          aria-label="테마"
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
            const next = {...item};
            const parsed = parsePayload(themeIdSchema, id);
            if (id === '') delete next.theme;
            else if (parsed.ok) next.theme = parsed.value;
            draft.change(next);
            update();
          }}
        />
      </span>
      <span className={styles.setting}>
        <span>넘기기</span>
        <SelectMenu
          aria-label="넘기기"
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
          checked={item.slides.loop ?? false}
          onChange={loop => change({...item.slides, loop})}
        />
        <span>반복</span>
      </span>
    </header>
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
          바꾸기…
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
}: {
  readonly api: LlpApi;
  readonly model: SlidesEditorModel;
}): JSX.Element | null {
  const {draft} = model;
  if (draft === null) return null;
  return (
    <SlidesEditorBody
      key={draft.snapshot.item.id}
      api={api}
      model={model}
      draft={draft}
    />
  );
}

function SlidesEditorBody({
  api,
  model,
  draft,
}: {
  readonly api: LlpApi;
  readonly model: SlidesEditorModel;
  readonly draft: SlidesDraft;
}): JSX.Element {
  const {item, selected} = draft.snapshot;
  const {root, save} = useSlidesSaveFocus(model, draft);
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
      isComposing(event) ||
      model.saving ||
      model.stopped ||
      model.leave !== null ||
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
      ['z', 'y', 's'].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key.toLowerCase() === 's') {
        editorTask(save());
        return;
      }
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
    <div ref={root} className={styles.layout} onKeyDownCapture={keyDown}>
      <div className={styles.left}>
        <fieldset
          className={styles.editable}
          disabled={model.saving || model.stopped || model.leave !== null}
          inert={model.saving || model.stopped || model.leave !== null}
        >
          <SlidesHeader
            draft={draft}
            update={update}
            themes={themes}
            themeName={appearance.themeName}
          />
          <SlideRows
            draft={draft}
            blocked={
              model.saving ||
              model.stopped ||
              model.leave !== null ||
              bibleDialog !== null ||
              picker !== null
            }
            update={update}
            report={model.problem}
            list={rowList}
            renderRow={(slide, index) => (
              <>
                <span className={styles.number}>{index + 1}</span>
                <div className={styles.thumbnail}>
                  <SlidesCanvas
                    item={item}
                    index={index}
                    appearance={appearance}
                    projection={projection}
                    thumbnail
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
                disabled={rows.length >= SLIDES_LIMIT}
                onClick={() => {
                  draft.add(newTextSlide(item.slides.form));
                  update();
                }}
              >
                글 추가
              </Button>
              <Button
                variant="ghost"
                icon="plus"
                disabled={rows.length >= SLIDES_LIMIT}
                onClick={event => showPicker(event.currentTarget)}
              >
                그림 추가…
              </Button>
              {item.slides.form !== 'blank' ? null : (
                <Button
                  variant="ghost"
                  icon="plus"
                  disabled={rows.length >= SLIDES_LIMIT}
                  onClick={() => setBibleDialog({})}
                >
                  성경 구절 추가…
                </Button>
              )}
            </div>
          </SlideRows>
        </fieldset>
        <PanelFooter count={rows.length} />
      </div>
      <div className={styles.side}>
        <SlidesPreview
          api={api}
          item={item}
          selected={at}
          media={media}
          projection={projection}
        />
        <div className={styles.save}>
          <Button
            disabled={!draft.dirty || model.saving || model.stopped}
            onClick={() => {
              editorTask(save());
            }}
          >
            저장
          </Button>
        </div>
      </div>
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
              draft.add({id: createSlideId(crypto.randomUUID()), media: id});
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
      {model.leave === null ? null : (
        <AlertDialog
          icon="slides"
          title={`‘${item.slides.name}’의 변경을 저장할까요?`}
          onCancel={model.cancel}
          actions={[
            {
              label: '저장 안 함',
              disabled: model.saving,
              onSelect: model.discard,
            },
            {
              label: '저장',
              primary: true,
              disabled: model.saving,
              onSelect: () => {
                editorTask(model.saveAndLeave());
              },
            },
          ]}
        />
      )}
    </div>
  );
}
