import {useCallback, useEffect, useRef, useState, type JSX} from 'react';
import {createPortal} from 'react-dom';
import {isLabelColor, type LabelColor} from '@core/labels/colors';
import {colorToHsv, hsvToColor, type HsvColor} from '@core/labels/colorSpace';
import {Button} from './Button';
import {Icon} from './Icon';
import {TextField} from './TextField';
import {LabelColorPicker} from './LabelColorPicker';
import {LabelColorArea} from './LabelColorArea';
import {isComposing} from './ime';
import {useChoicePopup} from './useChoicePopup';
import {layerContainer} from './layers';
import {labelInk} from './labelInk';
import menuStyles from './Menu.module.css';
import styles from './LabelColorPopover.module.css';

function ColorPopover({
  anchor,
  label,
  value,
  disabled,
  onPreview,
  onChange,
  onClose,
}: {
  readonly anchor: HTMLElement;
  readonly label: string;
  readonly value: LabelColor;
  readonly disabled: boolean;
  readonly onPreview: (color: LabelColor | null) => void;
  readonly onChange: (color: LabelColor) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [hsv, setHsv] = useState(() => colorToHsv(value));
  const [hex, setHex] = useState(value === 'none' ? '' : value);
  const current = useRef(value);
  const applied = useRef(value);
  const dirty = useRef(false);
  const pending = useRef(false);
  const restore = useRef(true);
  const callbacks = useRef({onChange, onPreview});
  useEffect(() => {
    callbacks.current = {onChange, onPreview};
  });
  const persist = useCallback((color: LabelColor): void => {
    if (pending.current) return;
    pending.current = true;
    callbacks.current
      .onChange(color)
      .then(accepted => {
        if (accepted) applied.current = color;
      })
      .finally(() => {
        pending.current = false;
      })
      .catch((error: unknown) =>
        console.error('Label color save failed', error),
      );
  }, []);
  const commit = useCallback((): void => {
    if (!dirty.current) return;
    dirty.current = false;
    if (current.current !== applied.current) {
      persist(current.current);
    } else callbacks.current.onPreview(null);
  }, [persist]);
  const close = (focus: boolean): void => {
    if (
      !focus &&
      document.activeElement === surface.current?.querySelector('input')
    ) {
      applyHex();
    }
    commit();
    restore.current = focus;
    onClose();
  };
  const {surface, onKeyDown} = useChoicePopup({
    anchor,
    closeWithinLayers: true,
    onClose: close,
    onEscape: () => close(true),
  });
  useEffect(() => {
    (
      surface.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      surface.current?.querySelector<HTMLElement>('[role="radio"]')
    )?.focus();
  }, [surface]);
  useEffect(
    () => () => {
      commit();
      if (restore.current && anchor.isConnected) anchor.focus();
    },
    [anchor, commit],
  );
  const preview = (next: HsvColor): void => {
    const color = hsvToColor(next);
    setHsv(next);
    setHex(color);
    current.current = color;
    dirty.current = true;
    onPreview(color);
  };
  const applyHex = (): void => {
    const next = hex.toUpperCase();
    if (disabled || !isLabelColor(next) || next === 'none') return;
    current.current = next;
    setHsv(colorToHsv(current.current));
    setHex(current.current);
    dirty.current = true;
    commit();
  };
  return createPortal(
    <div
      className={menuStyles.layer}
      data-over-modal={anchor.closest('[role="dialog"]') !== null || undefined}
    >
      <div
        ref={surface}
        role="dialog"
        aria-label={label}
        className={`${menuStyles.menu} ${styles.popover}`}
        onKeyDown={onKeyDown}
        onBlur={event => {
          if (
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget) &&
            !anchor.contains(event.relatedTarget)
          ) {
            close(false);
          }
        }}
      >
        <LabelColorPicker
          label={label}
          value={value}
          disabled={disabled}
          onChange={color => {
            dirty.current = false;
            persist(color);
            close(true);
          }}
          onSelectCurrent={() => close(true)}
        />
        <div role="separator" className={styles.separator} />
        <LabelColorArea
          value={hsv}
          disabled={disabled}
          onChange={preview}
          onCommit={commit}
        />
        <div className={styles.hex}>
          <TextField
            size="sm"
            aria-label="색 코드"
            placeholder="#RRGGBB"
            value={hex}
            readOnly={disabled}
            onChange={setHex}
            invalid={hex !== '' && (!isLabelColor(hex) || hex === 'none')}
            invalidReason="#RRGGBB 형식으로 입력"
            onBlur={applyHex}
            onKeyDown={event => {
              if (event.key === 'Enter' && !isComposing(event)) {
                event.preventDefault();
                event.stopPropagation();
                applyHex();
              }
            }}
          />
          <span className={styles.sample} style={labelInk(value)}>
            {value === 'none' ? <Icon name="x" size={12} /> : null}
          </span>
        </div>
      </div>
    </div>,
    layerContainer('popover'),
  );
}

/** A compact trigger and a color popup shared by both catalog placements. */
export function LabelColorControl({
  label,
  value,
  disabled,
  onPreview,
  onChange,
  onOpen,
}: {
  readonly label: string;
  readonly value: LabelColor;
  readonly disabled: boolean;
  readonly onPreview: (color: LabelColor | null) => void;
  /** Resolves true after the catalog accepts the color; false keeps it retryable. */
  readonly onChange: (color: LabelColor) => Promise<boolean>;
  readonly onOpen?: ((open: () => void) => void) | undefined;
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const show = (): void => {
    if (onOpen === undefined) setOpen(true);
    else onOpen(() => setOpen(true));
  };
  return (
    <>
      <Button
        ref={setButton}
        size="sm"
        title="색"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={event => {
          if (
            !disabled &&
            event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            event.key === 'ArrowDown'
          ) {
            event.preventDefault();
            show();
          }
        }}
      >
        <span className={styles.chip} style={labelInk(value)}>
          {value === 'none' ? <Icon name="x" size={12} /> : null}
        </span>
        <Icon name="down" size={12} />
      </Button>
      {open && button !== null ? (
        <ColorPopover
          anchor={button}
          label={label}
          value={value}
          disabled={disabled}
          onPreview={onPreview}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
