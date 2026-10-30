import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {MessageStyle} from '@core/schema/looks';
import {isLyricTextColor} from '@core/schema/textStyle';
import {NumberField} from '@renderer/ui/NumberField';
import {Properties, PropertyRow} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {ColorPicker} from './ColorPicker';
import {FontPicker} from './FontPicker';
import {missingFontReason, weightChoices} from './fontAvailability';
import {useFontCatalog} from './useFontCatalog';
import type {MessageStyleChange} from './messageStyleEdits';

const NUMBERS = [
  {key: 'size', label: '크기', min: 12, max: 300, step: 1, suffix: undefined},
  {
    key: 'lineHeight',
    label: '줄 간격',
    min: 0.8,
    max: 3,
    step: 0.05,
    suffix: undefined,
  },
  {
    key: 'maxLines',
    label: '최대 줄 수',
    min: 1,
    max: 10,
    step: 1,
    suffix: undefined,
  },
  {key: 'margin', label: '여백', min: 0, max: 30, step: 1, suffix: '%'},
] as const;

type NumericField = (typeof NUMBERS)[number];

function MessageNumberField({
  field,
  value,
  reason,
  onChange,
}: {
  readonly field: NumericField;
  readonly value: number;
  readonly reason: string | undefined;
  readonly onChange: Props['onChange'];
}): JSX.Element {
  const [local, setLocal] = useState<{
    source: number;
    optimistic: number | null;
    settled: boolean;
  }>({source: value, optimistic: null, settled: false});
  const serial = useRef(0);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (local.source !== value) {
    setLocal({
      source: value,
      optimistic:
        local.settled && local.optimistic === value ? null : local.optimistic,
      settled: local.settled,
    });
  }
  const commit = (next: number): void => {
    if (reason !== undefined) return;
    const token = ++serial.current;
    setLocal(previous => ({...previous, optimistic: next, settled: false}));
    const saving = onChange({kind: 'text', change: {[field.key]: next}});
    const rollback = (): void => {
      if (mounted.current && serial.current === token) {
        setLocal(previous => ({...previous, optimistic: null}));
      }
    };
    if (saving === undefined) rollback();
    else {
      saving.then(applied => {
        if (!applied) rollback();
        else if (mounted.current && serial.current === token) {
          setLocal(previous => ({
            ...previous,
            optimistic: previous.source === next ? null : previous.optimistic,
            settled: true,
          }));
        }
      }, rollback);
    }
  };
  return (
    <PropertyRow label={field.label}>
      {({controlId}) => (
        <NumberField
          id={controlId}
          value={local.optimistic ?? value}
          min={field.min}
          max={field.max}
          step={field.step}
          suffix={field.suffix}
          updateOn="commit"
          readOnly={reason !== undefined}
          aria-disabled={reason !== undefined || undefined}
          title={reason}
          onChange={commit}
        />
      )}
    </PropertyRow>
  );
}

interface Props {
  readonly style: MessageStyle;
  readonly reason: string | undefined;
  readonly onChange: (
    change: MessageStyleChange,
  ) => Promise<boolean> | undefined;
}

/** Edits the shared appearance of a message style in the Look editor. */
export function MessageStyleProperties(props: Props): JSX.Element {
  return <MessageStylePropertiesBody key={props.style.id} {...props} />;
}

function MessageStylePropertiesBody({
  style,
  reason,
  onChange,
}: Props): JSX.Element {
  const fonts = useFontCatalog();
  const missing = missingFontReason(style.font, fonts);
  const fontProblem =
    missing ??
    (fonts.status === 'failed' ? '설치 글꼴을 불러올 수 없음' : undefined);
  const weights = weightChoices(style.font, style.weight, fonts);
  const weightReason =
    reason ??
    (weights.every(option => option.disabled) ? weights[0]?.title : undefined);
  const [draft, setDraft] = useState<string | null>(null);
  const [local, setLocal] = useState<{
    source: string;
    optimistic: string | null;
    settled: boolean;
  }>({source: style.color, optimistic: null, settled: false});
  const latest = useRef(style.color);
  const saved = useRef(style.color);
  const serial = useRef(0);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    saved.current = style.color;
    if (local.optimistic === null) latest.current = style.color;
  }, [style.color, local.optimistic]);
  if (local.source !== style.color) {
    setLocal({
      source: style.color,
      optimistic:
        local.settled && local.optimistic === style.color
          ? null
          : local.optimistic,
      settled: local.settled,
    });
  }
  const effective = local.optimistic ?? style.color;
  const shown = draft ?? effective;
  const valid = isLyricTextColor(shown);
  const text = (
    change: Extract<MessageStyleChange, {kind: 'text'}>['change'],
  ): void => {
    onChange({kind: 'text', change})?.catch((cause: unknown) => {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not edit the message style',
        detail: String(cause),
      });
    });
  };
  const commitColor = (value: string): void => {
    if (reason !== undefined) return;
    const next = value.toUpperCase();
    if (next === latest.current) return;
    latest.current = next;
    const token = ++serial.current;
    setLocal(previous => ({...previous, optimistic: next, settled: false}));
    const saving = onChange({kind: 'text', change: {color: next}});
    const rollback = (): void => {
      if (!mounted.current || serial.current !== token) return;
      latest.current = saved.current;
      setLocal(previous => ({...previous, optimistic: null}));
    };
    if (saving === undefined) rollback();
    else {
      saving.then(applied => {
        if (!applied) rollback();
        else if (mounted.current && serial.current === token) {
          setLocal(previous => ({
            ...previous,
            optimistic: previous.source === next ? null : previous.optimistic,
            settled: true,
          }));
        }
      }, rollback);
    }
  };
  return (
    <Properties>
      <div>
        <div>
          <PropertyRow label="글꼴">
            {({controlId}) => (
              <FontPicker
                id={controlId}
                font={style.font}
                state={fonts}
                reason={reason}
                problem={fontProblem}
                onChange={font => text({font})}
              />
            )}
          </PropertyRow>
          <PropertyRow label="굵기">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                block
                value={String(style.weight)}
                options={weights}
                disabled={weightReason !== undefined}
                title={weightReason}
                onChange={weight => text({weight: Number(weight)})}
              />
            )}
          </PropertyRow>
          <PropertyRow label="글자색">
            {({controlId}) => (
              <>
                <ColorPicker
                  value={valid ? shown.toUpperCase() : effective}
                  reason={reason}
                  onChange={commitColor}
                />
                <TextField
                  id={controlId}
                  value={shown}
                  onChange={setDraft}
                  readOnly={reason !== undefined}
                  aria-disabled={reason !== undefined || undefined}
                  title={reason}
                  invalid={!valid}
                  invalidReason={valid ? undefined : '#RRGGBB 형식으로 입력'}
                  onBlur={() => {
                    if (draft !== null && valid && reason === undefined) {
                      commitColor(shown);
                    }
                    setDraft(null);
                  }}
                  onKeyDown={event => {
                    if (isComposing(event) || hasModifier(event)) return;
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setDraft(null);
                    }
                  }}
                />
              </>
            )}
          </PropertyRow>
          {NUMBERS.map(field => (
            <MessageNumberField
              key={field.key}
              field={field}
              value={style[field.key]}
              reason={reason}
              onChange={onChange}
            />
          ))}
        </div>
        <div>
          <PropertyRow label="가로 정렬">
            {({controlId, labelId}) => (
              <SegmentedControl
                id={controlId}
                labelledBy={labelId}
                value={style.align}
                options={[
                  {value: 'left', label: '왼쪽'},
                  {value: 'center', label: '가운데'},
                ]}
                disabled={reason !== undefined}
                title={reason}
                onChange={align => text({align})}
              />
            )}
          </PropertyRow>
          <PropertyRow label="세로 위치">
            {({controlId, labelId}) => (
              <SegmentedControl
                id={controlId}
                labelledBy={labelId}
                value={style.vAlign}
                options={[
                  {value: 'top', label: '위'},
                  {value: 'middle', label: '가운데'},
                  {value: 'bottom', label: '아래'},
                ]}
                disabled={reason !== undefined}
                title={reason}
                onChange={vAlign => text({vAlign})}
              />
            )}
          </PropertyRow>
        </div>
      </div>
    </Properties>
  );
}
