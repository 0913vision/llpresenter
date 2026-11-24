import {useState, type JSX, type KeyboardEvent, type RefObject} from 'react';
import {
  type VerseInput,
  planSlides,
  type SplitLayout,
  hintCharFromEvent,
} from '@core/bible';
import {Dialog} from '@renderer/ui/popups/Dialog';
import {Spinner} from '@renderer/ui/tiles/Spinner';
import type {ThemeFile} from '@core/schema/screens/theme';
import {SplitSlidePicture} from './SplitSlidePicture';
import {RESULTS_PER_ROW, useSplitDraft} from './useSplitDraft';
import {useSplitSave} from './useSplitSave';
import styles from './SplitEditor.module.css';

export interface SplitEditorProps {
  readonly pending?: boolean;
  readonly preparedPlan?: ReturnType<typeof planSlides> | undefined;
  readonly ruleBased?: boolean;
  readonly verse: VerseInput;
  readonly label: string;
  readonly cuts: readonly number[];
  readonly layout: SplitLayout;
  readonly theme: ThemeFile;
  readonly address: string;
  readonly prefix: string;
  readonly position: number;
  readonly total: number;
  readonly onConfirm: (
    cuts: readonly number[],
    texts: readonly string[],
  ) => Promise<void>;
  readonly onCancel: () => void;
}

const DIALOG_HEIGHT = 640;

/** Keeps one surface size while pending text is replaced by an editable verse. */
export function SplitEditor(props: SplitEditorProps): JSX.Element {
  const [spun, setSpun] = useState(props.pending === true);
  if (props.pending && !spun) setSpun(true);
  if (props.pending) {
    return (
      <div
        onKeyDownCapture={event => {
          if (
            event.code === 'Tab' ||
            /^F\d+$/.test(event.code) ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
          ) {
            return;
          }
          event.stopPropagation();
          event.preventDefault();
          if (event.code === 'Escape') props.onCancel();
        }}
      >
        <Dialog
          title="절 나누기"
          subtitle={{text: props.label}}
          size="xl"
          height={DIALOG_HEIGHT}
          headerEnd={
            props.total > 1 ? (
              <span className={styles.position}>
                {props.position + 1} / {props.total}
              </span>
            ) : undefined
          }
          bodyClassName={styles.body}
          initialFocus="surface"
          onCancel={props.onCancel}
          primary={{label: '확정', disabled: true, onSelect: () => undefined}}
        >
          <div className={styles.pending} role="status" aria-label="AI 준비 중">
            <Spinner />
          </div>
        </Dialog>
      </div>
    );
  }
  return <VerseSplitEditor {...props} afterSpinner={spun} />;
}

/**
 * One word of the verse and, after it, the key that cuts the verse there:
 * the letters typed so far stand out while they match.
 */
function SplitWord({
  text,
  label,
  typed,
  last,
  cut,
  busy,
  onCut,
}: {
  readonly text: string;
  readonly label: string | undefined;
  readonly typed: string;
  readonly last: boolean;
  readonly cut: boolean;
  readonly busy: boolean;
  readonly onCut: () => void;
}): JSX.Element {
  const matches = label?.startsWith(typed) === true;
  return (
    <span>
      <span className={styles.group}>
        <button
          type="button"
          className={styles.word}
          disabled={last || busy}
          onClick={onCut}
        >
          {text}
        </button>
        {label === undefined ? null : (
          <>
            {' '}
            <button
              type="button"
              className={styles.hint}
              aria-label={`${label.toUpperCase()}에서 자르기`}
              aria-pressed={cut}
              data-match={typed === '' || matches}
              disabled={busy}
              onClick={onCut}
            >
              {typed !== '' && matches ? (
                <>
                  <span className={styles.typed}>{typed.toUpperCase()}</span>
                  {label.slice(typed.length).toUpperCase()}
                </>
              ) : (
                label.toUpperCase()
              )}
            </button>
          </>
        )}
      </span>{' '}
    </span>
  );
}

/** Keys of the dialog that pass through it: Tab, F keys, Alt and Windows. */
function passesThrough(event: KeyboardEvent): boolean {
  return (
    event.altKey ||
    event.metaKey ||
    event.code === 'Tab' ||
    /^F\d+$/.test(event.code)
  );
}

function isConfirmKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.code === 'Space';
}

/**
 * Copible's word-gap editor. Typed hint letters cut the verse at a gap,
 * Backspace and Ctrl Z undo, Ctrl Y redoes, Enter or Space confirms. Its
 * parent remounts it for each verse.
 */
function VerseSplitEditor(
  props: SplitEditorProps & {readonly afterSpinner: boolean},
): JSX.Element {
  const draft = useSplitDraft(props);
  const {plan} = draft;
  const saving = useSplitSave({
    plan,
    previews: draft.previews,
    shakeClass: styles.shake ?? 'shake',
    afterSpinner: props.afterSpinner,
    onConfirm: props.onConfirm,
  });
  const cutAt = (gap: number): void => {
    if (saving.locked()) return;
    draft.cut(gap);
    saving.clearProblem();
  };
  const cancel = (): void => {
    if (!saving.locked()) props.onCancel();
  };

  /** A rule-based split takes no cuts: only confirm and cancel. */
  const ruleBasedKey = (event: KeyboardEvent): void => {
    event.preventDefault();
    if (!event.repeat && isConfirmKey(event)) saving.confirm();
    else if (event.code === 'Escape') cancel();
  };
  const historyKey = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyZ' && event.code !== 'KeyY') return;
    event.preventDefault();
    if (saving.locked()) return;
    draft.clearTyped();
    if (event.code === 'KeyY' || event.shiftKey) draft.redo();
    else draft.undo();
  };
  const editKey = (event: KeyboardEvent): void => {
    event.preventDefault();
    if (saving.locked()) return;
    const letter = hintCharFromEvent(event);
    if (letter !== null) {
      const gap = draft.typeHint(letter);
      if (gap !== null) cutAt(gap);
    } else if (isConfirmKey(event)) {
      if (!event.repeat) saving.confirm();
    } else if (event.code === 'Backspace') {
      if (draft.typed !== '') draft.clearTyped();
      else draft.undo();
    } else if (event.code === 'Escape') {
      if (draft.typed !== '') draft.clearTyped();
      else cancel();
    }
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (passesThrough(event)) return;
    event.stopPropagation();
    if (props.ruleBased) ruleBasedKey(event);
    else if (event.ctrlKey) historyKey(event);
    else editKey(event);
  };

  return (
    <div onKeyDownCapture={keyDown} style={{display: 'contents'}}>
      <Dialog
        title="절 나누기"
        subtitle={{text: props.label}}
        headerEnd={
          props.total > 1 ? (
            <span className={styles.position}>
              {props.position + 1} / {props.total}
            </span>
          ) : undefined
        }
        size="xl"
        height={DIALOG_HEIGHT}
        bodyClassName={styles.body}
        initialFocus="surface"
        onCancel={cancel}
        primary={{
          label: saving.busy ? '저장 중' : '확정',
          onSelect: saving.confirm,
          disabled: !plan.ok || saving.busy,
          title: !plan.ok
            ? '한 슬라이드에 들어가지 않는 구절이 있습니다.'
            : undefined,
        }}
        footerStart={
          saving.problem === undefined ? undefined : (
            <span role="alert" className={styles.problem}>
              {saving.problem}
            </span>
          )
        }
      >
        <div className={styles.words}>
          {props.ruleBased ? (
            <p>규칙 기반 분할</p>
          ) : (
            plan.words.map((word, index) => (
              <SplitWord
                key={word.start}
                text={word.text}
                label={draft.labels[index]}
                typed={draft.typed}
                last={index === plan.words.length - 1}
                cut={plan.cuts.includes(index + 1)}
                busy={saving.busy}
                onCut={() => cutAt(index + 1)}
              />
            ))
          )}
        </div>
        <SplitPreviews
          area={draft.previews}
          slides={plan.slides}
          prefix={props.prefix}
          address={props.address}
          theme={props.theme}
        />
      </Dialog>
    </div>
  );
}

/** The slides the cuts give, as they will look. */
function SplitPreviews({
  area,
  slides,
  prefix,
  address,
  theme,
}: {
  readonly area: RefObject<HTMLDivElement | null>;
  readonly slides: ReturnType<typeof planSlides>['slides'];
  readonly prefix: string;
  readonly address: string;
  readonly theme: ThemeFile;
}): JSX.Element {
  return (
    <div
      ref={area}
      className={styles.previews}
      data-centered={slides.length < RESULTS_PER_ROW}
      aria-label="나눈 결과"
    >
      {slides.map(slide => (
        <figure
          key={slide.index}
          className={styles.preview}
          data-overflow={!slide.fits}
        >
          <figcaption>{slide.index + 1}</figcaption>
          <div
            role="img"
            aria-label={`슬라이드 ${slide.index + 1}`}
            className={styles.slide}
          >
            <SplitSlidePicture
              text={slide.index === 0 ? prefix + slide.text : slide.text}
              continued={!slide.isLast}
              address={address}
              theme={theme}
            />
          </div>
        </figure>
      ))}
    </div>
  );
}
