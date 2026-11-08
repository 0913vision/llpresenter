import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react';
import type {ThemeElement, ThemeText} from '@core/schema/themes';
import type {ThemeBackground} from '@core/schema/themeBackground';
import {mediaObjectFit} from '@core/media/objectFit';
import {THEME_LIMITS, type ThemeElementKind} from '@core/themes/elementRules';
import {hasThemeText, type TextThemeElement} from '@core/themes/elementEdits';
import {continuationText} from '@core/bible/split/continuation';
import {contSizeOf} from '@core/bible/split/layout';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {fontFamilyFor} from './slideLayer';
import {fitTextInFrame} from './fitText';
import {stageClockText, STAGE_TICK_MS} from './stageClock';
import {fillTimerTokens, type RenderTimers} from './timerTokens';
import styles from './ThemePicture.module.css';
import {themeBackgroundStyle} from './themeBackground';
import bulletStyles from './bulletText.module.css';
import {BULLET_STYLE, textParagraphs} from './textParagraphs';
import {resolveTextTracking} from '@core/themes/textTracking';

interface MeasuredText {
  readonly lines: readonly string[];
  readonly continued: boolean;
  readonly part?: number;
}

function textEffects(
  text: ThemeText,
  content: string,
  continued: boolean,
): CSSProperties {
  const {outline, shadow} = text;
  const {spacing, indent} = resolveTextTracking(text, content, continued);
  const angle = (shadow.angle * Math.PI) / 180;
  return {
    ...BULLET_STYLE,
    fontFamily: fontFamilyFor(text.font),
    fontWeight: text.weight,
    lineHeight: text.lineHeight,
    letterSpacing: spacing,
    textIndent: indent,
    textAlign: text.align,
    color: text.color,
    WebkitTextStroke: outline.on
      ? `${outline.width}px ${outline.color}`
      : undefined,
    paintOrder: 'stroke fill',
    textShadow: shadow.on
      ? `${Math.cos(angle) * shadow.distance}px ${Math.sin(angle) * shadow.distance}px ${shadow.blur}px color-mix(in srgb, ${shadow.color} ${shadow.opacity}%, transparent)`
      : undefined,
  };
}

function ThemeTextBox({
  element,
  content,
  measured,
}: {
  readonly element: TextThemeElement;
  readonly content: string;
  readonly measured?: MeasuredText | undefined;
}): JSX.Element {
  const block = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = block.current;
    if (target === null) return;
    if (measured !== undefined) {
      target.style.fontSize = `${element.text.size}px`;
      return;
    }
    const size = fitTextInFrame(
      {
        size: element.text.size,
        width: element.frame.w,
        height: element.frame.h,
      },
      candidate => {
        target.style.fontSize = `${candidate}px`;
        return {width: target.scrollWidth, height: target.scrollHeight};
      },
    );
    target.style.fontSize = `${size}px`;
  }, [element, content, measured]);
  return (
    <div
      className={styles.textBox}
      style={{
        justifyContent: {
          top: 'flex-start',
          middle: 'center',
          bottom: 'flex-end',
        }[element.text.vAlign],
      }}
    >
      <div
        ref={block}
        className={styles.text}
        style={{
          ...textEffects(
            element.text,
            measured?.lines.join('\n') ?? content,
            measured?.continued ?? false,
          ),
          fontSize: element.text.size,
        }}
      >
        {measured === undefined
          ? element.text.bullets
            ? textParagraphs([content]).map((line, index) => (
                <div key={index} className={bulletStyles.paragraph}>
                  {line.trim() === '' ? null : (
                    <span className={bulletStyles.marker} aria-hidden="true">
                      •
                    </span>
                  )}
                  {line || '\u00a0'}
                </div>
              ))
            : element.text.shortTracking !== undefined
              ? content
                  .split('\n')
                  .map((line, index) => (
                    <div key={index}>{line || '\u00a0'}</div>
                  ))
              : content
          : measured.lines.map((line, index) => {
              const startsParagraph = index === 0 && (measured.part ?? 1) === 1;
              const run = continuationText(
                line,
                measured.continued && index === measured.lines.length - 1,
              );
              return (
                <div
                  key={index}
                  className={`${styles.measuredLine} ${element.text.bullets ? (startsParagraph ? bulletStyles.paragraph : bulletStyles.continuation) : ''}`}
                  data-measured-line=""
                >
                  {element.text.bullets &&
                  startsParagraph &&
                  line.trim() !== '' ? (
                    <span className={bulletStyles.marker} aria-hidden="true">
                      •
                    </span>
                  ) : null}
                  {run.body || (run.marker === '' ? '\u00a0' : '')}
                  {run.marker === '' ? null : (
                    <span style={{fontSize: contSizeOf(element.text)}}>
                      {run.marker}
                    </span>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}

function contents(
  element: ThemeElement,
  context: {
    samples: Partial<Record<ThemeElementKind, string>>;
    timers: RenderTimers | undefined;
    media: Partial<Record<'media' | 'background', string>> | undefined;
    measuredText: MeasuredText | undefined;
    measuredNextText: MeasuredText | undefined;
  },
): JSX.Element | null {
  const {samples, timers} = context;
  if (element.kind === 'media' || element.kind === 'background') {
    const source = context.media?.[element.kind];
    return source === undefined ? null : (
      <img
        className={styles.image}
        src={source}
        alt=""
        draggable={false}
        style={{
          objectFit: mediaObjectFit(element.fit),
          borderRadius: element.radius,
        }}
      />
    );
  }
  if (element.kind === 'clock' || element.kind === 'timer') {
    return (
      <ThemeTime
        element={element}
        timers={timers}
        sample={samples[element.kind] ?? ''}
      />
    );
  }
  if (hasThemeText(element)) {
    return (
      <ThemeTextBox
        element={element}
        measured={
          element.kind === 'currentText'
            ? context.measuredText
            : element.kind === 'nextText'
              ? context.measuredNextText
              : undefined
        }
        content={
          element.kind === 'text'
            ? element.content
            : (samples[element.kind] ?? '')
        }
      />
    );
  }
  if (element.kind === 'image') {
    return (
      <img
        className={styles.image}
        src={mediaUrl(element.mediaId)}
        alt=""
        draggable={false}
        style={{
          objectFit: mediaObjectFit(element.fit),
          borderRadius: element.radius,
        }}
      />
    );
  }
  return null;
}

function ThemeTime({
  element,
  timers,
  sample,
}: {
  readonly element: Extract<ThemeElement, {kind: 'clock' | 'timer'}>;
  readonly timers: RenderTimers | undefined;
  readonly sample: string;
}): JSX.Element {
  const [now, setNow] = useState(() => ({timer: 0, wall: Date.now()}));
  useEffect(() => {
    const tick = (): void =>
      setNow(
        timers?.now() ?? {
          timer: performance.timeOrigin + performance.now(),
          wall: Date.now(),
        },
      );
    tick();
    const interval = setInterval(tick, STAGE_TICK_MS);
    return () => clearInterval(interval);
  }, [timers]);
  const content =
    element.kind === 'clock'
      ? stageClockText(now.wall, element.clockFormat)
      : element.timerId === undefined || timers === undefined
        ? sample
        : fillTimerTokens(`{timer:${element.timerId}}`, timers, now);
  return <ThemeTextBox element={element} content={content} />;
}

/** Draws reference-pixel theme elements for editor canvases and their thumbnails. */
export function ThemePicture({
  elements,
  background,
  samples,
  timers,
  media,
  measuredText,
  measuredNextText,
}: {
  readonly elements: readonly ThemeElement[];
  readonly background: ThemeBackground;
  readonly samples: Partial<Record<ThemeElementKind, string>>;
  readonly timers?: RenderTimers | undefined;
  readonly media?: Partial<Record<'media' | 'background', string>> | undefined;
  /** Already measured output rows, drawn at the theme size without fitting or wrapping. */
  readonly measuredText?: MeasuredText | undefined;
  readonly measuredNextText?: MeasuredText | undefined;
}): JSX.Element {
  return (
    <svg
      className={styles.picture}
      viewBox={`0 0 ${THEME_LIMITS.width} ${THEME_LIMITS.height}`}
      style={themeBackgroundStyle(background)}
      aria-hidden="true"
    >
      <foreignObject width={THEME_LIMITS.width} height={THEME_LIMITS.height}>
        <div
          className={styles.reference}
          style={{width: THEME_LIMITS.width, height: THEME_LIMITS.height}}
        >
          {elements.map(element => {
            const box =
              element.kind === 'box' || hasThemeText(element)
                ? element.box
                : undefined;
            return (
              <div
                key={element.id}
                className={styles.element}
                style={{
                  left: element.frame.x,
                  top: element.frame.y,
                  width: element.frame.w,
                  height: element.frame.h,
                }}
              >
                {box?.on === true ? (
                  <div
                    className={styles.fill}
                    style={{
                      backgroundColor: box.fill,
                      opacity: box.opacity / 100,
                      borderRadius: box.radius ?? 0,
                    }}
                  />
                ) : null}
                {contents(element, {
                  samples,
                  timers,
                  media,
                  measuredText,
                  measuredNextText,
                })}
              </div>
            );
          })}
        </div>
      </foreignObject>
    </svg>
  );
}
