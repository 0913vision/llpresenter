import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {LyricStyle} from '@shared/schema/looks';
import {isLyricTextColor} from '@shared/schema/textStyle';
import {NumberField} from '@renderer/ui/NumberField';
import {
  Properties,
  PropertyColumns,
  PropertyRow,
} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {TextField} from '@renderer/ui/TextField';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import type {LyricStyleEdit} from './lyricStyleEdits';
import {FontPicker} from './FontPicker';
import {ColorPicker} from './ColorPicker';
import {LyricEffectsProperties} from './LyricEffectsProperties';
import type {LyricEffectsChange} from './lyricEffectsEdits';
import {missingFontReason, weightChoices} from './fontAvailability';
import {useFontCatalog} from './useFontCatalog';

type Change = (
  change: LyricStyleEdit['change'],
) => Promise<boolean> | undefined;

interface ColorState {
  readonly source: string;
  readonly optimistic: string | null;
}

const NUMBER_FIELDS = [
  {key: 'size', label: '크기', min: 12, max: 300, step: 1},
  {key: 'lineHeight', label: '줄 간격', min: 0.8, max: 3, step: 0.05},
  {key: 'maxLines', label: '최대 줄 수', min: 1, max: 10, step: 1},
  {key: 'margin', label: '여백', min: 0, max: 30, step: 1},
] as const;

function ColorField({
  style,
  reason,
  change,
}: {
  readonly style: LyricStyle;
  readonly reason: string | undefined;
  readonly change: Change;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const [local, setLocal] = useState<ColorState>({
    source: style.color,
    optimistic: null,
  });
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
      optimistic: local.optimistic === style.color ? null : local.optimistic,
    });
  }
  const effective = local.optimistic ?? style.color;
  const shown = draft ?? effective;
  const valid = isLyricTextColor(shown);
  const commit = (value: string): void => {
    if (reason !== undefined) return;
    const next = value.toUpperCase();
    if (next === latest.current) return;
    latest.current = next;
    const token = ++serial.current;
    setLocal(previous => ({
      ...previous,
      optimistic: next,
    }));
    const saving = change({color: next});
    const rollback = (): void => {
      if (!mounted.current || serial.current !== token) return;
      latest.current = saved.current;
      setLocal(previous => ({...previous, optimistic: null}));
    };
    if (saving === undefined) rollback();
    else {
      saving.then(applied => {
        if (!applied) rollback();
        else if (
          mounted.current &&
          serial.current === token &&
          saved.current === next
        ) {
          setLocal(previous => ({...previous, optimistic: null}));
        }
      }, rollback);
    }
  };
  return (
    <PropertyRow label="글자색">
      {({controlId}) => (
        <>
          <ColorPicker
            value={valid ? shown.toUpperCase() : effective}
            reason={reason}
            onChange={commit}
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
              if (draft !== null && valid) commit(shown);
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

/** Shared lyric text properties; every control saves only its own changed fields. */
export function LyricStyleProperties({
  style,
  reason,
  change,
  changeEffects,
}: {
  readonly style: LyricStyle;
  readonly reason: string | undefined;
  readonly change: Change;
  readonly changeEffects: (
    change: LyricEffectsChange,
  ) => Promise<boolean> | undefined;
}): JSX.Element {
  const fonts = useFontCatalog();
  const missing = missingFontReason(style.font, fonts);
  const fontProblem =
    missing ??
    (fonts.status === 'failed' ? '설치 글꼴을 불러올 수 없음' : undefined);
  const dispatch = (update: LyricStyleEdit['change']): void => {
    change(update)?.catch((cause: unknown) => {
      window.llp?.log.write({
        level: 'error',
        message: 'Could not edit the lyric style',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
    });
  };
  const weights = weightChoices(style.font, style.weight, fonts);
  const weightReason =
    reason ??
    (weights.every(option => option.disabled) ? weights[0]?.title : undefined);
  return (
    <Properties>
      <PropertyColumns>
        <div>
          <PropertyRow label="글꼴">
            {({controlId}) => (
              <FontPicker
                id={controlId}
                font={style.font}
                state={fonts}
                reason={reason}
                problem={fontProblem}
                onChange={font => dispatch({font})}
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
                onChange={weight => dispatch({weight: Number(weight)})}
              />
            )}
          </PropertyRow>
          <ColorField
            key={style.id}
            style={style}
            reason={reason}
            change={change}
          />
          {NUMBER_FIELDS.map(field => (
            <PropertyRow key={field.key} label={field.label}>
              {({controlId}) => (
                <NumberField
                  id={controlId}
                  value={style[field.key]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  suffix={field.key === 'margin' ? '%' : undefined}
                  updateOn="commit"
                  readOnly={reason !== undefined}
                  aria-disabled={reason !== undefined || undefined}
                  title={reason}
                  onChange={value => dispatch({[field.key]: value})}
                />
              )}
            </PropertyRow>
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
                onChange={align => dispatch({align})}
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
                onChange={vAlign => dispatch({vAlign})}
              />
            )}
          </PropertyRow>
          <LyricEffectsProperties
            style={style}
            reason={reason}
            onChange={changeEffects}
          />
        </div>
      </PropertyColumns>
    </Properties>
  );
}
