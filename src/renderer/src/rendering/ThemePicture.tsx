import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from 'react';
import type {ThemeElement, ThemeText} from '@core/schema/themes';
import {THEME_LIMITS, type ThemeElementKind} from '@core/themes/elementRules';
import {hasThemeText, type TextThemeElement} from '@core/themes/elementEdits';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {fontFamilyFor} from './slideLayer';
import {fitTextInFrame} from './fitText';
import {stageClockText, STAGE_TICK_MS} from './stageLayout';
import {fillTimerTokens, type RenderTimers} from './timerTokens';
import styles from './ThemePicture.module.css';

function textEffects(text: ThemeText): CSSProperties {
  const {outline, shadow} = text;
  const angle = (shadow.angle * Math.PI) / 180;
  return {
    fontFamily: fontFamilyFor(text.font),
    fontWeight: text.weight,
    lineHeight: text.lineHeight,
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
}: {
  readonly element: TextThemeElement;
  readonly content: string;
}): JSX.Element {
  const block = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = block.current;
    if (target === null) return;
    const maximumLines =
      element.kind === 'currentText' || element.kind === 'nextText'
        ? element.text.maxLines
        : Infinity;
    const size = fitTextInFrame(
      {
        size: element.text.size,
        width: element.frame.w,
        height: element.frame.h,
        maxLines: maximumLines,
        lineHeight: element.text.lineHeight,
      },
      candidate => {
        target.style.fontSize = `${candidate}px`;
        return {width: target.scrollWidth, height: target.scrollHeight};
      },
    );
    target.style.fontSize = `${size}px`;
  }, [element, content]);
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
        style={{...textEffects(element.text), fontSize: element.text.size}}
      >
        {content}
      </div>
    </div>
  );
}

function contents(
  element: ThemeElement,
  context: {
    samples: Partial<Record<ThemeElementKind, string>>;
    timers: RenderTimers | undefined;
  },
): JSX.Element | null {
  const {samples, timers} = context;
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
          objectFit:
            element.fit === 'fit'
              ? 'contain'
              : element.fit === 'fill'
                ? 'cover'
                : 'fill',
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
}: {
  readonly elements: readonly ThemeElement[];
  readonly background: string;
  readonly samples: Partial<Record<ThemeElementKind, string>>;
  readonly timers?: RenderTimers | undefined;
}): JSX.Element {
  return (
    <svg
      className={styles.picture}
      viewBox={`0 0 ${THEME_LIMITS.width} ${THEME_LIMITS.height}`}
      style={{backgroundColor: background}}
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
                {contents(element, {samples, timers})}
              </div>
            );
          })}
        </div>
      </foreignObject>
    </svg>
  );
}
