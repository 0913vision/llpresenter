import {useEffect, useLayoutEffect, useRef, type JSX} from 'react';
import type {ThemeGradient} from '@core/schema/themeBackground';
import {moveGradientStop} from '@core/themes/gradientEdits';
import {themeBackgroundStyle} from '@renderer/rendering/themeBackground';
import styles from './ThemeGradient.module.css';

interface StopDrag {
  readonly pointer: number;
  readonly gradient: ThemeGradient;
  readonly index: number;
  readonly offset: number;
  readonly left: number;
  readonly width: number;
  readonly finish: () => void;
}

export function GradientStopBar({
  gradient,
  selected,
  reason,
  select,
  change,
  add,
  remove,
  begin,
}: {
  readonly gradient: ThemeGradient;
  readonly selected: number;
  readonly reason: string | undefined;
  readonly select: (index: number) => void;
  readonly change: (gradient: ThemeGradient) => void;
  readonly add: (position: number) => number | undefined;
  readonly remove: () => void;
  readonly begin: () => () => void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<StopDrag | null>(null);
  const focus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focus.current === null) return;
    const handles =
      host.current?.querySelectorAll<HTMLButtonElement>('[role="slider"]');
    handles?.[focus.current]?.focus();
    focus.current = null;
  });
  const finish = (): void => {
    const current = drag.current;
    drag.current = null;
    current?.finish();
    if (current !== null && host.current?.hasPointerCapture(current.pointer)) {
      host.current.releasePointerCapture(current.pointer);
    }
  };
  useEffect(() => () => drag.current?.finish(), []);
  const move = (base: ThemeGradient, index: number, position: number): void => {
    const next = moveGradientStop(base, index, position);
    select(next.index);
    focus.current = next.index;
    change(next.gradient);
  };
  return (
    <div
      className={styles.bar}
      ref={host}
      role="group"
      aria-label="그라데이션 색상점"
      onPointerMove={event => {
        if (reason !== undefined) {
          finish();
          return;
        }
        const current = drag.current;
        if (current?.pointer !== event.pointerId) return;
        move(
          current.gradient,
          current.index,
          Math.round(
            (((event.clientX - current.left) / current.width) * 100 -
              current.offset) *
              10,
          ) / 10,
        );
      }}
      onPointerUp={event => {
        if (drag.current?.pointer === event.pointerId) finish();
      }}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      <div
        className={styles.track}
        style={themeBackgroundStyle({...gradient, angle: 0})}
        title={
          reason ??
          (gradient.stops.length >= 4
            ? '색은 4개까지 추가할 수 있습니다'
            : undefined)
        }
        onClick={event => {
          if (
            reason !== undefined ||
            drag.current !== null ||
            event.target !== event.currentTarget
          ) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width > 0) {
            const index = add(
              Math.round(((event.clientX - rect.left) / rect.width) * 1000) /
                10,
            );
            if (index !== undefined) focus.current = index;
          }
        }}
      />
      {gradient.stops.map((stop, index) => (
        <button
          key={index}
          type="button"
          role="slider"
          aria-label={`색 ${index + 1}, ${stop.position} %`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stop.position}
          aria-valuetext={`${stop.position} %`}
          aria-orientation="horizontal"
          aria-current={index === selected ? 'true' : undefined}
          disabled={reason !== undefined}
          title={reason}
          className={styles.handle}
          style={{left: `${stop.position}%`, backgroundColor: stop.color}}
          onFocus={() => select(index)}
          onClick={() => select(index)}
          onPointerDown={event => {
            if (
              event.button !== 0 ||
              reason !== undefined ||
              drag.current !== null
            ) {
              return;
            }
            event.preventDefault();
            event.currentTarget.focus();
            const rect = host.current?.getBoundingClientRect();
            if (rect === undefined || rect.width <= 0) return;
            select(index);
            drag.current = {
              pointer: event.pointerId,
              gradient,
              index,
              offset:
                ((event.clientX - rect.left) / rect.width) * 100 -
                stop.position,
              left: rect.left,
              width: rect.width,
              finish: begin(),
            };
            host.current?.setPointerCapture(event.pointerId);
          }}
          onKeyDown={event => {
            if (
              event.ctrlKey ||
              event.altKey ||
              event.metaKey ||
              drag.current !== null
            ) {
              return;
            }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              event.stopPropagation();
              move(
                gradient,
                index,
                stop.position +
                  (event.key === 'ArrowLeft' ? -1 : 1) *
                    (event.shiftKey ? 10 : 1),
              );
            } else if (event.key === 'Delete' || event.key === 'Backspace') {
              event.preventDefault();
              event.stopPropagation();
              if (gradient.stops.length <= 2) return;
              remove();
              focus.current = Math.min(index, gradient.stops.length - 2);
            }
          }}
        />
      ))}
    </div>
  );
}
