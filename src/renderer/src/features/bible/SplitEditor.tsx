import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import type {VerseInput} from '@core/bible/split/splitVerses';
import {planSlides} from '@core/bible/split/manualSplit';
import {contSizeOf, type SplitLayout} from '@core/bible/split/layout';
import {continuationText} from '@core/bible/split/continuation';
import {
  effectiveCuts,
  hintCharFromEvent,
  hintLabels,
  initialEditHistory,
  isShowingAuto,
  pressGap,
  redoEdit,
  undoEdit,
} from '@core/bible/split/cutState';
import {Dialog} from '@renderer/ui/Dialog';
import {fontFamilyFor} from '@renderer/rendering/slideLayer';
import type {BibleTextElement} from '@renderer/rendering/bibleMeasure';
import styles from './SplitEditor.module.css';

export interface SplitEditorProps {
  readonly verse: VerseInput;
  readonly label: string;
  readonly cuts: readonly number[];
  readonly layout: SplitLayout;
  readonly element: BibleTextElement;
  readonly prefix: string;
  readonly position: number;
  readonly total: number;
  readonly onConfirm: (cuts: readonly number[]) => Promise<void>;
  readonly onCancel: () => void;
}

function SplitPreviews({
  plan,
  element,
}: {
  readonly plan: ReturnType<typeof planSlides>;
  readonly element: BibleTextElement;
}): JSX.Element {
  const {text, frame} = element;
  const pitch = text.size * text.lineHeight;
  return (
    <div className={styles.previews}>
      {plan.slides.map(slide => {
        const height = Math.max(frame.h, pitch * slide.nLines);
        return (
          <figure
            key={slide.index}
            className={styles.preview}
            data-overflow={!slide.fits}
          >
            <svg
              viewBox={`0 0 ${frame.w} ${height}`}
              role="img"
              aria-label={`슬라이드 ${slide.index + 1}`}
            >
              <rect
                x="0"
                y="0"
                width={frame.w}
                height={frame.h}
                className={styles.box}
              />
              <foreignObject width={frame.w} height={height}>
                <div
                  style={{
                    fontFamily: fontFamilyFor(text.font),
                    fontWeight: text.weight,
                    fontSize: text.size,
                    lineHeight: text.lineHeight,
                    textAlign: text.align,
                  }}
                >
                  {slide.lines.map((line, index) => {
                    const run = continuationText(
                      line,
                      !slide.isLast && index === slide.lines.length - 1,
                    );
                    return (
                      <div
                        key={index}
                        data-overflow={index >= slide.maxLines}
                        className={styles.line}
                      >
                        {run.body}
                        {run.marker === '' ? null : (
                          <span
                            style={{fontSize: contSizeOf({size: text.size})}}
                          >
                            {run.marker}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </foreignObject>
            </svg>
            <figcaption>
              {slide.nLines}/{slide.maxLines}줄
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** Copible's word-gap editor. Its parent remounts it for each verse. */
export function SplitEditor(props: SplitEditorProps): JSX.Element {
  const [history, setHistory] = useState(() => initialEditHistory(props.cuts));
  const [buffer, setBuffer] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const active = useRef(true);
  const locked = useRef(false);
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
  const labels = hintLabels(Math.max(0, plan.words.length - 1));
  const cut = (j: number): void => {
    if (locked.current) return;
    setBuffer('');
    try {
      setHistory(pressGap(history, j));
      setProblem(undefined);
    } catch {
      setProblem('되돌리기 기록이 가득 참');
    }
  };
  const cancel = (): void => {
    if (!locked.current) props.onCancel();
  };
  const confirm = (): void => {
    if (!plan.ok || locked.current) return;
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
      setHistory(
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
      else setHistory(undoEdit(history));
    } else if (event.code === 'Escape') {
      if (buffer !== '') setBuffer('');
      else cancel();
    }
  };
  return (
    <div onKeyDownCapture={keyDown}>
      <Dialog
        title="절 나누기"
        subtitle={{
          text: `${props.label}${props.total > 1 ? ` ${props.position + 1}/${props.total}` : ''}`,
        }}
        size="l"
        initialFocus="surface"
        onCancel={cancel}
        primary={{
          label: busy ? '저장 중' : '확정',
          onSelect: confirm,
          disabled: !plan.ok || busy,
          title: !plan.ok ? '한 슬라이드에 들어가지 않는 구절 있음' : undefined,
        }}
        footerStart={
          problem === undefined ? (
            isShowingAuto(history.present) ? (
              <span className={styles.state}>자동</span>
            ) : null
          ) : (
            <span role="alert" className={styles.problem}>
              {problem}
            </span>
          )
        }
      >
        <div className={styles.words}>
          {plan.words.map((word, index) => {
            const label = labels[index - 1];
            return (
              <span key={word.start}>
                {label === undefined ? null : (
                  <button
                    type="button"
                    className={styles.hint}
                    aria-label={`${label.toUpperCase()}에서 자르기`}
                    aria-pressed={plan.cuts.includes(index)}
                    data-match={buffer === '' || label.startsWith(buffer)}
                    onClick={() => cut(index)}
                  >
                    {label.toUpperCase()}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.word}
                  disabled={index === plan.words.length - 1 || busy}
                  onClick={() => cut(index + 1)}
                >
                  {word.text}
                </button>{' '}
              </span>
            );
          })}
        </div>
        <SplitPreviews plan={plan} element={props.element} />
      </Dialog>
    </div>
  );
}
