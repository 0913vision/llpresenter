import {useRef, type CSSProperties, type JSX, type KeyboardEvent} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {sliderKeyValue, sliderPercent} from './sliderValue';
import {useSliderPointer} from './sliderPointer';
import {useTooltip} from './Tooltip';
import type {Workspace} from './workspace';
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
  /** Use `any` for continuous dragging; arrow keys still move by 1. */
  readonly step?: number | 'any' | undefined;
  /** An optional step for Shift plus an arrow key. */
  readonly shiftStep?: number | undefined;
  /** Reports when a pointer interaction ends or a key changes the value. */
  readonly onCommit?: ((value: number) => void) | undefined;
  /** In Show, a pointer interaction returns focus to its previous owner. */
  readonly workspace?: Workspace | undefined;
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
  shiftStep,
  onCommit,
  workspace = 'prep',
  label,
  icon,
  width = 'regular',
  surface = 'panel',
  valueText,
  disabled = false,
  title,
  className,
}: SliderProps): JSX.Element {
  const pointerProps = useSliderPointer({workspace, disabled, onCommit});
  const ignoreNativeStep = useRef(false);
  const scale = {min, max, step: step === 'any' ? 1 : step};
  const {targetProps, tooltip} = useTooltip({text: title ?? label});
  const trackStyle: TrackStyle = {
    '--slider-value': `${sliderPercent(value, scale)}%`,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (disabled) return;
    if (event.ctrlKey || event.altKey || event.metaKey) {
      ignoreNativeStep.current =
        sliderKeyValue(event.key, value, scale) !== undefined;
      return;
    }
    ignoreNativeStep.current = false;
    const keyScale =
      event.shiftKey && event.key.startsWith('Arrow') && shiftStep !== undefined
        ? {...scale, step: shiftStep}
        : scale;
    const next = sliderKeyValue(event.key, value, keyScale);
    if (next === undefined) return;
    event.preventDefault();
    if (next !== value) {
      onChange(next);
      onCommit?.(next);
    }
  };

  const slider = (
    <input
      {...pointerProps}
      onPointerDown={event => {
        ignoreNativeStep.current = false;
        pointerProps.onPointerDown(event);
      }}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={valueText}
      style={trackStyle}
      className={classNames(
        styles.slider,
        widthClass[width],
        surface === 'dialog' && styles.onDialog,
      )}
      onChange={event => {
        if (ignoreNativeStep.current) {
          event.currentTarget.value = String(value);
          return;
        }
        onChange(Number(event.target.value));
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={() => {
        ignoreNativeStep.current = false;
      }}
      onBlur={() => {
        ignoreNativeStep.current = false;
      }}
    />
  );

  return (
    <span
      {...targetProps}
      className={classNames(
        styles.row,
        width === 'block' && styles.blockRow,
        className,
      )}
    >
      {icon === undefined ? null : <Icon name={icon} size={ICON_SIZE} />}
      {slider}
      {tooltip}
    </span>
  );
}
