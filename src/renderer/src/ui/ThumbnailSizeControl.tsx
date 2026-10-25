import {useRef, type JSX, type PointerEvent} from 'react';
import {classNames} from './classNames';
import {NumberField} from './NumberField';
import {Slider} from './Slider';
import {
  clampThumbnailScale,
  commitThumbnailScale,
  MAX_THUMBNAIL_SCALE_PERCENT,
  MIN_THUMBNAIL_SCALE_PERCENT,
  THUMBNAIL_SCALE_SHIFT_STEP,
  THUMBNAIL_SCALE_STEP,
} from './thumbnailSize';
import type {Workspace} from './workspace';
import styles from './ThumbnailSizeControl.module.css';

export interface ThumbnailSizeControlProps {
  readonly value: number;
  /** Live percentage, including fractions during a drag. */
  readonly onChange: (value: number) => void;
  /** Whole percentage after pointer release, a key, Enter, or field blur. */
  readonly onCommit?: ((value: number) => void) | undefined;
  readonly workspace?: Workspace | undefined;
  readonly compact?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * Continuous slide-size slider and synchronized percentage field from spec-13.
 * The caller starts at DEFAULT_THUMBNAIL_SCALE_PERCENT and owns persistence.
 */
export function ThumbnailSizeControl({
  value,
  onChange,
  onCommit,
  workspace = 'prep',
  compact = false,
  disabled = false,
  className,
}: ThumbnailSizeControlProps): JSX.Element {
  const percentage = clampThumbnailScale(value);
  const focusBeforeDrag = useRef<Element | null>(null);
  const rememberFocus = (event: PointerEvent<HTMLSpanElement>): void => {
    if (workspace !== 'show') return;
    if (
      event.target instanceof HTMLInputElement &&
      event.target.type === 'range'
    ) {
      focusBeforeDrag.current = document.activeElement;
    }
  };
  const restoreFocus = (event: PointerEvent<HTMLSpanElement>): void => {
    if (
      !(event.target instanceof HTMLInputElement) ||
      event.target.type !== 'range'
    ) {
      return;
    }
    const previous = focusBeforeDrag.current;
    focusBeforeDrag.current = null;
    if (workspace !== 'show') return;
    if (
      previous instanceof HTMLElement &&
      previous.isConnected &&
      previous !== document.body
    ) {
      previous.focus({preventScroll: true});
    } else event.target.blur();
  };
  const finishDrag = (next: number): void => {
    const committed = commitThumbnailScale(next);
    if (committed !== next) onChange(committed);
    onCommit?.(committed);
  };
  const commitField = (next: number): void => {
    const committed = commitThumbnailScale(next);
    if (committed !== percentage) onChange(committed);
    onCommit?.(committed);
  };
  return (
    <span
      role="group"
      aria-label="슬라이드 크기"
      className={classNames(styles.control, className)}
      onPointerDownCapture={rememberFocus}
      onPointerUpCapture={restoreFocus}
      onPointerCancelCapture={restoreFocus}
    >
      <Slider
        label="슬라이드 크기"
        icon="grid"
        min={MIN_THUMBNAIL_SCALE_PERCENT}
        max={MAX_THUMBNAIL_SCALE_PERCENT}
        step="any"
        shiftStep={THUMBNAIL_SCALE_SHIFT_STEP}
        value={percentage}
        valueText={`${commitThumbnailScale(percentage)}%`}
        onChange={onChange}
        onCommit={finishDrag}
        width={compact ? 'compact' : 'regular'}
        disabled={disabled}
      />
      <NumberField
        aria-label="슬라이드 크기 백분율"
        min={MIN_THUMBNAIL_SCALE_PERCENT}
        max={MAX_THUMBNAIL_SCALE_PERCENT}
        step={THUMBNAIL_SCALE_STEP}
        updateOn="commit"
        value={commitThumbnailScale(percentage)}
        suffix="%"
        onChange={commitField}
        disabled={disabled}
        className={styles.field}
      />
    </span>
  );
}
