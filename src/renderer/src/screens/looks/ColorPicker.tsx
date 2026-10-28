import {useState, type JSX, type PointerEvent} from 'react';
import {Dialog} from '@renderer/ui/Dialog';
import {Slider} from '@renderer/ui/Slider';
import {pressHandler} from '@renderer/ui/press';
import {useTooltip} from '@renderer/ui/Tooltip';
import {hexFromHsv, hsvFromHex, type HsvColor} from './colorConversion';
import styles from './ColorPicker.module.css';

const PERCENT_MAX = 100;
const HUE_MAX = 360;

function selectionAt(
  event: PointerEvent<HTMLDivElement>,
): {saturation: number; value: number} | undefined {
  const bounds = event.currentTarget.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;
  const clamp = (value: number): number => Math.min(1, Math.max(0, value));
  return {
    saturation:
      clamp((event.clientX - bounds.left) / bounds.width) * PERCENT_MAX,
    value:
      (1 - clamp((event.clientY - bounds.top) / bounds.height)) * PERCENT_MAX,
  };
}

function PickerDialog({
  value,
  label,
  onApply,
  onCancel,
}: {
  readonly value: string;
  readonly label: string;
  readonly onApply: (color: string) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [selection, setSelection] = useState<HsvColor>(() => hsvFromHex(value));
  const hex = hexFromHsv(selection);
  const point = (event: PointerEvent<HTMLDivElement>): void => {
    const next = selectionAt(event);
    if (next !== undefined) setSelection(previous => ({...previous, ...next}));
  };
  const rows = [
    {key: 'hue', label: '색조', max: HUE_MAX, suffix: '°'},
    {key: 'saturation', label: '채도', max: PERCENT_MAX, suffix: '%'},
    {key: 'value', label: '명도', max: PERCENT_MAX, suffix: '%'},
  ] as const;
  return (
    <Dialog
      title={`${label} 선택`}
      size="s"
      onCancel={onCancel}
      primary={{label: '적용', onSelect: () => onApply(hex)}}
    >
      <div className={styles.content}>
        <div
          className={styles.plane}
          aria-hidden="true"
          style={{
            backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${selection.hue} 100% 50%))`,
          }}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            point(event);
          }}
          onPointerMove={event => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              point(event);
            }
          }}
        >
          <span
            className={styles.cursor}
            style={{
              left: `${selection.saturation}%`,
              top: `${PERCENT_MAX - selection.value}%`,
            }}
          />
        </div>
        {rows.map(row => (
          <div key={row.key} className={styles.row}>
            <span>{row.label}</span>
            <Slider
              label={row.label}
              min={0}
              max={row.max}
              step="any"
              width="block"
              surface="dialog"
              className={row.key === 'hue' ? styles.hue : undefined}
              value={selection[row.key]}
              valueText={`${Math.round(selection[row.key])}${row.suffix}`}
              onChange={value =>
                setSelection(previous => ({...previous, [row.key]: value}))
              }
            />
            <span className={styles.number}>
              {Math.round(selection[row.key])}
              {row.suffix}
            </span>
          </div>
        ))}
        <div className={styles.preview}>
          <span
            className={styles.previewSwatch}
            style={{backgroundColor: hex}}
          />
          <output aria-label="선택한 색">{hex}</output>
        </div>
      </div>
    </Dialog>
  );
}

/** Opens an in-app, accessible color picker for the lyric text swatch. */
export function ColorPicker({
  value,
  reason,
  onChange,
  label = '글자색',
}: {
  readonly value: string;
  readonly reason: string | undefined;
  readonly onChange: (color: string) => void;
  readonly label?: string | undefined;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const title = `${label} 선택`;
  const {targetProps, tooltip} = useTooltip({text: reason ?? title});
  if (open && reason !== undefined) setOpen(false);
  return (
    <>
      <button
        {...targetProps}
        type="button"
        aria-label={title}
        aria-haspopup="dialog"
        aria-disabled={reason !== undefined || undefined}
        className={styles.swatch}
        onClick={pressHandler(reason !== undefined, () => setOpen(true))}
      >
        <span
          aria-hidden="true"
          className={styles.chip}
          style={{backgroundColor: value}}
        />
      </button>
      {tooltip}
      {open ? (
        <PickerDialog
          value={value}
          label={label}
          onCancel={() => setOpen(false)}
          onApply={color => {
            setOpen(false);
            onChange(color);
          }}
        />
      ) : null}
    </>
  );
}
