import {useRef, type JSX, type KeyboardEvent, type PointerEvent} from 'react';
import type {HsvColor} from '@core/labels/colorSpace';
import styles from './LabelColorPopover.module.css';

const clamp = (value: number, max = 100): number =>
  Math.max(0, Math.min(max, value));

/** Pointer and keyboard controls share one preview and release boundary. */
interface ColorAreaProps {
  readonly value: HsvColor;
  readonly disabled: boolean;
  readonly onChange: (value: HsvColor) => void;
  readonly onCommit: () => void;
}

function ColorTrack({
  value,
  disabled,
  onChange,
  onCommit,
  hue,
}: ColorAreaProps & {readonly hue: boolean}): JSX.Element {
  const pointer = useRef<number | null>(null);
  const point = (event: PointerEvent<HTMLDivElement>, hue: boolean): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const x = clamp(((event.clientX - bounds.left) / bounds.width) * 100);
    const y = clamp(((event.clientY - bounds.top) / bounds.height) * 100);
    onChange(
      hue
        ? {...value, hue: x * 3.6}
        : {...value, saturation: x, brightness: 100 - y},
    );
  };
  const key = (event: KeyboardEvent<HTMLDivElement>, hue: boolean): void => {
    if (
      disabled ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1;
    const next = hue
      ? {...value, hue: clamp(value.hue + direction * step * 3.6, 360)}
      : event.key === 'ArrowLeft' || event.key === 'ArrowRight'
        ? {...value, saturation: clamp(value.saturation + direction * step)}
        : {...value, brightness: clamp(value.brightness + direction * step)};
    onChange(next);
  };
  const events = {
    tabIndex: disabled ? -1 : 0,
    'aria-disabled': disabled || undefined,
    onPointerDown: (event: PointerEvent<HTMLDivElement>): void => {
      if (disabled || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointer.current = event.pointerId;
      point(event, hue);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>): void => {
      if (!disabled && pointer.current === event.pointerId) point(event, hue);
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>): void => {
      if (pointer.current !== event.pointerId) return;
      point(event, hue);
      pointer.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      onCommit();
    },
    onLostPointerCapture: (): void => {
      pointer.current = null;
      onCommit();
    },
    onPointerCancel: (): void => {
      pointer.current = null;
      onCommit();
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>): void => key(event, hue),
    onKeyUp: (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key.startsWith('Arrow')) {
        event.stopPropagation();
        onCommit();
      }
    },
    onBlur: onCommit,
  };
  return hue ? (
    <div
      {...events}
      role="slider"
      aria-label="색상"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(value.hue)}
      className={styles.hue}
      style={{
        background:
          'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
      }}
    >
      <span
        className={styles.handle}
        style={{left: `${value.hue / 3.6}%`, top: '50%'}}
      />
    </div>
  ) : (
    <div
      {...events}
      role="slider"
      aria-label="채도와 밝기"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value.saturation)}
      aria-valuetext={`채도 ${Math.round(value.saturation)}%, 밝기 ${Math.round(value.brightness)}%`}
      className={styles.area}
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${value.hue} 100% 50%))`,
      }}
    >
      <span
        className={styles.handle}
        style={{
          left: `${value.saturation}%`,
          top: `${100 - value.brightness}%`,
        }}
      />
    </div>
  );
}

export function LabelColorArea(props: ColorAreaProps): JSX.Element {
  return (
    <>
      <ColorTrack {...props} hue={false} />
      <ColorTrack {...props} hue />
    </>
  );
}
