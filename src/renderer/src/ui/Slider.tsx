import type {CSSProperties, JSX, KeyboardEvent} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {sliderKeyValue, sliderPercent} from './sliderValue';
import styles from './Slider.module.css';

/** The slider width: 120, 96 (narrow window, 진행 도구 volume), or the cell. */
export type SliderWidth = 'regular' | 'compact' | 'block';

/** The surface under the slider, which the gap of the focus ring matches. */
export type SliderSurface = 'panel' | 'dialog';

export interface SliderProps {
  readonly value: number;
  /** Reports each value while the user drags or presses keys. */
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  /** The change for one arrow key press. Defaults to 1. */
  readonly step?: number | undefined;
  /** The accessible name and tooltip, such as 썸네일 크기 or 음량. */
  readonly label: string;
  /** A leading icon, such as `grid` or `audio`. */
  readonly icon?: string | undefined;
  readonly width?: SliderWidth | undefined;
  readonly surface?: SliderSurface | undefined;
  /** The value as read aloud, such as 70%. */
  readonly valueText?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text that replaces the label, such as the reason it is disabled. */
  readonly title?: string | undefined;
  readonly className?: string | undefined;
}

type TrackStyle = CSSProperties & Readonly<Record<'--slider-value', string>>;

const ICON_SIZE = 14;

const widthClass = {
  regular: undefined,
  compact: styles.compact,
  block: styles.block,
} as const satisfies Record<SliderWidth, string | undefined>;

/** A horizontal slider for an amount, such as thumbnail size or volume. */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  icon,
  width = 'regular',
  surface = 'panel',
  valueText,
  disabled = false,
  title,
  className,
}: SliderProps): JSX.Element {
  const scale = {min, max, step};
  const trackStyle: TrackStyle = {
    '--slider-value': `${sliderPercent(value, scale)}%`,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const next = sliderKeyValue(event.key, value, scale);
    if (next === undefined) return;
    event.preventDefault();
    if (next !== value) onChange(next);
  };

  // TODO(0913vision): Draw `title` with Tooltip once ui-2 lands.
  const slider = (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={valueText}
      title={title ?? label}
      style={trackStyle}
      className={classNames(
        styles.slider,
        widthClass[width],
        surface === 'dialog' && styles.onDialog,
        icon === undefined && className,
      )}
      onChange={event => onChange(Number(event.target.value))}
      onKeyDown={handleKeyDown}
    />
  );

  if (icon === undefined) return slider;
  return (
    <span
      className={classNames(
        styles.row,
        width === 'block' && styles.blockRow,
        className,
      )}
    >
      <Icon name={icon} size={ICON_SIZE} />
      {slider}
    </span>
  );
}
