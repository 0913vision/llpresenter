import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {LYRIC_EFFECT_LIMITS, type LyricStyle} from '@core/schema/looks';
import {isLyricTextColor} from '@core/schema/textStyle';
import {NumberField} from '@renderer/ui/NumberField';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {Switch} from '@renderer/ui/Switch';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {ColorPicker} from './ColorPicker';

type Style = LyricStyle;

import type {LyricEffectsChange} from '@core/looks/lyricEffectsEdits';

const REFERENCE_POSITIONS = [
  {value: 'bottomRight', label: '오른쪽 아래'},
  {value: 'bottomLeft', label: '왼쪽 아래'},
  {value: 'afterLastLine', label: '마지막 줄 다음'},
  {value: 'hidden', label: '숨김'},
] as const;

function EffectColor({
  label,
  value,
  reason,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly reason: string | undefined;
  readonly onChange: (value: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const valid = isLyricTextColor(shown);
  return (
    <PropertyRow label={label}>
      {({controlId}) => (
        <>
          <ColorPicker
            label={label}
            value={valid ? shown.toUpperCase() : value}
            reason={reason}
            onChange={onChange}
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
                onChange(shown.toUpperCase());
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
  );
}

function EffectNumber({
  label,
  value,
  min,
  max,
  suffix,
  reason,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly suffix?: string | undefined;
  readonly reason: string | undefined;
  readonly onChange: (value: number) => Promise<boolean> | undefined;
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
    const saving = onChange(next);
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
    <PropertyRow label={label}>
      {({controlId}) => (
        <NumberField
          id={controlId}
          value={local.optimistic ?? value}
          min={min}
          max={max}
          step={1}
          suffix={suffix}
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

/** Edits effect fields separately so delayed writes retain other changes. */
export function LyricEffectsProperties({
  style,
  reason,
  onChange,
}: {
  readonly style: Style;
  readonly reason: string | undefined;
  readonly onChange: (
    change: LyricEffectsChange,
  ) => Promise<boolean> | undefined;
}): JSX.Element {
  const outlineReason =
    reason ?? (style.outline.on ? undefined : '외곽선이 꺼져 있음');
  const shadowReason =
    reason ?? (style.shadow.on ? undefined : '그림자가 꺼져 있음');
  const outline = (
    change: Partial<Style['outline']>,
  ): Promise<boolean> | undefined => onChange({kind: 'outline', change});
  const shadow = (
    change: Partial<Style['shadow']>,
  ): Promise<boolean> | undefined => onChange({kind: 'shadow', change});
  const shadowNumbers = [
    {
      key: 'blur',
      label: '그림자 흐림',
      max: LYRIC_EFFECT_LIMITS.shadowBlur,
      suffix: undefined,
    },
    {
      key: 'distance',
      label: '그림자 거리',
      max: LYRIC_EFFECT_LIMITS.shadowDistance,
      suffix: undefined,
    },
    {
      key: 'angle',
      label: '그림자 각도',
      max: LYRIC_EFFECT_LIMITS.shadowAngle,
      suffix: '°',
    },
    {key: 'opacity', label: '그림자 불투명도', max: 100, suffix: '%'},
  ] as const;
  return (
    <>
      <PropertyRow label="외곽선">
        {({controlId}) => (
          <Switch
            id={controlId}
            checked={style.outline.on}
            disabled={reason !== undefined}
            title={reason}
            onChange={on => {
              outline({on})?.catch(() => undefined);
            }}
          />
        )}
      </PropertyRow>
      <EffectNumber
        label="외곽선 두께"
        value={style.outline.width}
        min={LYRIC_EFFECT_LIMITS.outlineWidth.min}
        max={LYRIC_EFFECT_LIMITS.outlineWidth.max}
        reason={outlineReason}
        onChange={width => outline({width})}
      />
      <EffectColor
        label="외곽선 색"
        value={style.outline.color}
        reason={outlineReason}
        onChange={color => {
          outline({color})?.catch(() => undefined);
        }}
      />
      <PropertyRow label="그림자">
        {({controlId}) => (
          <Switch
            id={controlId}
            checked={style.shadow.on}
            disabled={reason !== undefined}
            title={reason}
            onChange={on => {
              shadow({on})?.catch(() => undefined);
            }}
          />
        )}
      </PropertyRow>
      {shadowNumbers.map(field => (
        <EffectNumber
          key={field.key}
          label={field.label}
          value={style.shadow[field.key]}
          min={0}
          max={field.max}
          suffix={field.suffix}
          reason={shadowReason}
          onChange={value => shadow({[field.key]: value})}
        />
      ))}
      <EffectColor
        label="그림자 색"
        value={style.shadow.color}
        reason={shadowReason}
        onChange={color => {
          shadow({color})?.catch(() => undefined);
        }}
      />
      <PropertyRow label="출처 위치">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            value={style.referencePosition}
            options={REFERENCE_POSITIONS}
            disabled={reason !== undefined}
            title={reason}
            onChange={value => {
              onChange({kind: 'referencePosition', value})?.catch(
                () => undefined,
              );
            }}
          />
        )}
      </PropertyRow>
    </>
  );
}
