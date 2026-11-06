import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {VerseInput} from '@core/bible/split/splitVerses';
import {planSlides} from '@core/bible/split/manualSplit';
import type {SplitLayout} from '@core/bible/split/layout';
import {
  effectiveCuts,
  hintCharFromEvent,
  hintLabels,
  initialEditHistory,
  pressGap,
  redoEdit,
  undoEdit,
  type EditHistory,
} from '@core/bible/split/cutState';
import {Dialog} from '@renderer/ui/Dialog';
import type {BibleTextElement} from '@renderer/rendering/bibleMeasure';
import type {SplitAppearance} from './splitProjection';
import {SplitSlidePicture} from './SplitSlidePicture';
import styles from './SplitEditor.module.css';

export interface SplitEditorProps {
  readonly verse: VerseInput;
  readonly label: string;
  readonly cuts: readonly number[];
  readonly layout: SplitLayout;
  readonly element: BibleTextElement;
  readonly appearance?: SplitAppearance | undefined;
  readonly prefix: string;
  readonly position: number;
  readonly total: number;
  readonly onConfirm: (cuts: readonly number[]) => Promise<void>;
  readonly onCancel: () => void;
}

const DIALOG_HEIGHT = 640;
const RESULTS_PER_ROW = 3;
const RESULT_TOP_INSET = 16;

/** Copible's word-gap editor. Its parent remounts it for each verse. */
export function SplitEditor(props: SplitEditorProps): JSX.Element {
  const [history, setHistory] = useState(() => initialEditHistory(props.cuts));
  const [buffer, setBuffer] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const active = useRef(true);
  const locked = useRef(false);
  const previews = useRef<HTMLDivElement>(null);
  const changedGap = useRef<number | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const plan = useMemo(
    () =>
      planSlides(props.verse.text, effectiveCuts(history.present), {
        ...props.layout,
        prefix: props.prefix,
      }),
    [props.verse.text, history.present, props.layout, props.prefix],
  );
  useLayoutEffect(() => {
    const gap = changedGap.current;
    const area = previews.current;
    if (gap === undefined || area === null) return;
    changedGap.current = undefined;
    const part = plan.cuts.filter(cut => cut <= gap).length;
    const rowStart = Math.floor(part / RESULTS_PER_ROW) * RESULTS_PER_ROW;
    const target = area.children.item(rowStart);
    if (target instanceof HTMLElement) {
      area.scrollTop = target.offsetTop - RESULT_TOP_INSET;
    }
  }, [plan]);
  const labels = hintLabels(Math.max(0, plan.words.length - 1));
  const edit = (next: EditHistory, gap?: number): void => {
    if (next === history) return;
    const previous = effectiveCuts(history.present);
    const cuts = effectiveCuts(next.present);
    const userGap = [...history.present.user, ...next.present.user].find(
      value =>
        history.present.user.includes(value) !==
        next.present.user.includes(value),
    );
    const effectiveGap = [...previous, ...cuts].find(
      value => previous.includes(value) !== cuts.includes(value),
    );
    changedGap.current =
      gap ??
      (history.present.dismissed !== next.present.dismissed
        ? effectiveGap
        : (userGap ?? effectiveGap));
    setHistory(next);
  };
  const cut = (j: number): void => {
    if (locked.current) return;
    setBuffer('');
    try {
      edit(pressGap(history, j), j);
      setProblem(undefined);
    } catch {
      setProblem('되돌리기 기록이 가득 참');
    }
  };
  const cancel = (): void => {
    if (!locked.current) props.onCancel();
  };
  const confirm = (): void => {
    if (locked.current) return;
    if (!plan.ok) {
      previews.current
        ?.querySelectorAll<HTMLElement>('figure[data-overflow="true"]')
        .forEach(preview => {
          preview.classList.remove(styles.shake ?? 'shake');
          preview.getBoundingClientRect();
          preview.classList.add(styles.shake ?? 'shake');
        });
      return;
    }
    locked.current = true;
    setBusy(true);
    setProblem(undefined);
    props
      .onConfirm(plan.cuts)
      .catch((cause: unknown) => {
        if (active.current) {
          setProblem(
            cause instanceof Error ? cause.message : '절 나누기 저장 실패',
          );
        }
      })
      .finally(() => {
        if (active.current) {
          locked.current = false;
          setBusy(false);
        }
      });
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (
      event.altKey ||
      event.metaKey ||
      event.code === 'Tab' ||
      /^F\d+$/.test(event.code)
    ) {
      return;
    }
    event.stopPropagation();
    if (event.ctrlKey) {
      if (event.code !== 'KeyZ' && event.code !== 'KeyY') return;
      event.preventDefault();
      if (locked.current) return;
      setBuffer('');
      edit(
        event.code === 'KeyY' || event.shiftKey
          ? redoEdit(history)
          : undoEdit(history),
      );
      return;
    }
    event.preventDefault();
    if (locked.current) return;
    const letter = hintCharFromEvent(event);
    if (letter !== null) {
      const typed = buffer + letter;
      const index = labels.indexOf(typed);
      if (index >= 0) cut(index + 1);
      else {
        setBuffer(labels.some(label => label.startsWith(typed)) ? typed : '');
      }
    } else if (event.code === 'Enter' || event.code === 'Space') {
      if (!event.repeat) confirm();
    } else if (event.code === 'Backspace') {
      if (buffer !== '') setBuffer('');
      else edit(undoEdit(history));
    } else if (event.code === 'Escape') {
      if (buffer !== '') setBuffer('');
      else cancel();
    }
  };
  return (
    <div onKeyDownCapture={keyDown}>
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
          label: busy ? '저장 중' : '확정',
          onSelect: confirm,
          disabled: !plan.ok || busy,
          title: !plan.ok ? '한 슬라이드에 들어가지 않는 구절 있음' : undefined,
        }}
        footerStart={
          problem === undefined ? undefined : (
            <span role="alert" className={styles.problem}>
              {problem}
            </span>
          )
        }
      >
        <div className={styles.words}>
          {plan.words.map((word, index) => {
            const label = labels[index];
            const matches = label?.startsWith(buffer) === true;
            return (
              <span key={word.start}>
                <span className={styles.group}>
                  <button
                    type="button"
                    className={styles.word}
                    disabled={index === plan.words.length - 1 || busy}
                    onClick={() => cut(index + 1)}
                  >
                    {word.text}
                  </button>
                  {label === undefined ? null : (
                    <>
                      {' '}
                      <button
                        type="button"
                        className={styles.hint}
                        aria-label={`${label.toUpperCase()}에서 자르기`}
                        aria-pressed={plan.cuts.includes(index + 1)}
                        data-match={buffer === '' || matches}
                        disabled={busy}
                        onClick={() => cut(index + 1)}
                      >
                        {buffer !== '' && matches ? (
                          <>
                            <span className={styles.typed}>
                              {buffer.toUpperCase()}
                            </span>
                            {label.slice(buffer.length).toUpperCase()}
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
          })}
        </div>
        <div
          ref={previews}
          className={styles.previews}
          data-centered={plan.slides.length < RESULTS_PER_ROW}
          aria-label="나눈 결과"
        >
          {plan.slides.map(slide => (
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
                  lines={slide.lines}
                  continued={!slide.isLast}
                  reference={props.label}
                  element={props.element}
                  maxLines={slide.maxLines}
                  appearance={props.appearance}
                />
              </div>
            </figure>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
