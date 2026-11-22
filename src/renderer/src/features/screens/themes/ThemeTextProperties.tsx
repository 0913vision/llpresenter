import type {JSX} from 'react';
import {
  TEXT_EFFECT_LIMITS,
  type TextOutline,
  type TextShadow,
} from '@core/schema/textEffects';
import {
  THEME_FILE_LIMITS,
  type ThemeGroupedText,
  type ThemeTextStyle,
} from '@core/schema/theme';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {FontPicker} from '../fonts/FontPicker';
import {missingFontReason, weightChoices} from '../fonts/fontAvailability';
import {useFontCatalog} from '../fonts/useFontCatalog';
import {ColorProperty} from '../ColorProperty';
import {StringProperty} from '../StringProperty';
import {
  ThemeCheck,
  ThemeNumber,
  ThemeOptionalNumber,
} from './ThemePropertyFields';
import {themeCanvasBounds, type ThemeModel} from './useThemeEditor';

const NO_OUTLINE: TextOutline = {on: false, width: 2, color: '#000000'};
const NO_SHADOW: TextShadow = {
  on: false,
  blur: 8,
  distance: 4,
  angle: 45,
  opacity: 60,
  color: '#000000',
};

type Fit = NonNullable<ThemeGroupedText['fit']>;

function changeText(
  model: ThemeModel,
  id: string,
  change: (element: ThemeGroupedText) => ThemeGroupedText,
): void {
  model.property(id, element =>
    element.kind === 'text' || element.kind === 'next'
      ? change(element)
      : element,
  );
}

export function ThemeTextProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: ThemeGroupedText;
}): JSX.Element {
  const fonts = useFontCatalog();
  const reason = model.elementReason;
  const change = (update: (style: ThemeTextStyle) => ThemeTextStyle): void =>
    changeText(model, element.id, current => ({
      ...current,
      style: update(current.style),
    }));
  const text = element.style;
  const outline = text.outline ?? NO_OUTLINE;
  const shadow = text.shadow ?? NO_SHADOW;
  const changeOutline = (update: Partial<TextOutline>): void =>
    change(style => ({...style, outline: {...outline, ...update}}));
  const changeShadow = (update: Partial<TextShadow>): void =>
    change(style => ({...style, shadow: {...shadow, ...update}}));
  const weights = weightChoices(text.font, text.weight, fonts).filter(
    option =>
      Number(option.value) >= THEME_FILE_LIMITS.weight.min &&
      Number(option.value) <= THEME_FILE_LIMITS.weight.max,
  );
  return (
    <>
      <PropertyGroup title="글자">
        <PropertyRow label="글꼴">
          {({controlId}) => (
            <FontPicker
              id={controlId}
              font={text.font}
              state={fonts}
              reason={reason}
              problem={missingFontReason(text.font, fonts)}
              onChange={font => change(value => ({...value, font}))}
            />
          )}
        </PropertyRow>
        <PropertyRow label="굵기">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              block
              value={String(text.weight)}
              options={weights}
              disabled={reason !== undefined}
              title={reason}
              onChange={weight =>
                change(value => ({...value, weight: Number(weight)}))
              }
            />
          )}
        </PropertyRow>
        <ThemeNumber
          label="크기"
          value={text.size}
          min={THEME_FILE_LIMITS.fontSize.min}
          max={THEME_FILE_LIMITS.fontSize.max}
          reason={reason}
          change={size => change(value => ({...value, size}))}
        />
        <ColorProperty
          label="글자색"
          value={text.color}
          reason={reason}
          commit={color => change(value => ({...value, color}))}
        />
        <ThemeNumber
          label="줄 간격"
          value={text.lineHeight}
          min={THEME_FILE_LIMITS.lineHeight.min}
          max={THEME_FILE_LIMITS.lineHeight.max}
          step={0.05}
          reason={reason}
          change={lineHeight => change(value => ({...value, lineHeight}))}
        />
        <ThemeNumber
          label="자간"
          value={text.tracking}
          min={THEME_FILE_LIMITS.tracking.min}
          max={THEME_FILE_LIMITS.tracking.max}
          step={0.1}
          reason={reason}
          change={tracking => change(value => ({...value, tracking}))}
        />
        <ThemeCheck
          label="짧은 글 자간"
          checked={text.short !== undefined}
          reason={reason}
          change={on =>
            change(style => {
              const {short: _short, ...rest} = style;
              return on
                ? {...rest, short: {letters: 2, tracking: style.tracking}}
                : rest;
            })
          }
        />
        {text.short === undefined ? null : (
          <>
            <ThemeNumber
              label="최대 글자 수"
              value={text.short.letters}
              min={1}
              max={THEME_FILE_LIMITS.rows}
              reason={reason}
              change={letters =>
                change(style =>
                  style.short === undefined
                    ? style
                    : {...style, short: {...style.short, letters}},
                )
              }
            />
            <ThemeNumber
              label="짧은 글 자간 값"
              value={text.short.tracking}
              min={THEME_FILE_LIMITS.tracking.min}
              max={THEME_FILE_LIMITS.tracking.max}
              reason={reason}
              change={tracking =>
                change(style =>
                  style.short === undefined
                    ? style
                    : {...style, short: {...style.short, tracking}},
                )
              }
            />
          </>
        )}
        <ThemeCheck
          label="글머리 기호"
          checked={text.bullets ?? false}
          reason={reason}
          change={bullets => change(value => ({...value, bullets}))}
        />
        <PropertyRow label="가로 정렬">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              labelledBy={labelId}
              fill
              value={text.align}
              disabled={reason !== undefined}
              title={reason}
              options={[
                {value: 'left', label: '왼쪽', icon: 'aleft'},
                {value: 'center', label: '가운데', icon: 'acenter'},
                {value: 'right', label: '오른쪽', icon: 'aright'},
              ]}
              onChange={align => change(value => ({...value, align}))}
            />
          )}
        </PropertyRow>
        <PropertyRow label="세로 위치">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              labelledBy={labelId}
              fill
              value={text.vAlign}
              disabled={reason !== undefined}
              title={reason}
              options={[
                {value: 'top', label: '위'},
                {value: 'middle', label: '가운데'},
                {value: 'bottom', label: '아래'},
              ]}
              onChange={vAlign => change(value => ({...value, vAlign}))}
            />
          )}
        </PropertyRow>
      </PropertyGroup>
      <PropertyGroup title="효과">
        <ThemeCheck
          label="외곽선"
          checked={outline.on}
          reason={reason}
          change={on => changeOutline({on})}
        />
        {outline.on ? (
          <>
            <ThemeNumber
              label="두께"
              value={outline.width}
              min={TEXT_EFFECT_LIMITS.outlineWidth.min}
              max={TEXT_EFFECT_LIMITS.outlineWidth.max}
              reason={reason}
              change={width => changeOutline({width})}
            />
            <ColorProperty
              label="외곽선 색"
              value={outline.color}
              reason={reason}
              commit={color => changeOutline({color})}
            />
          </>
        ) : null}
        <ThemeCheck
          label="그림자"
          checked={shadow.on}
          reason={reason}
          change={on => changeShadow({on})}
        />
        {shadow.on ? (
          <>
            {(
              [
                {
                  key: 'blur',
                  label: '흐림',
                  max: TEXT_EFFECT_LIMITS.shadowBlur,
                },
                {
                  key: 'distance',
                  label: '거리',
                  max: TEXT_EFFECT_LIMITS.shadowDistance,
                },
                {
                  key: 'angle',
                  label: '각도',
                  max: TEXT_EFFECT_LIMITS.shadowAngle,
                },
                {key: 'opacity', label: '불투명도', max: 100},
              ] as const
            ).map(({key, label, max}) => (
              <ThemeNumber
                key={key}
                label={label}
                value={shadow[key]}
                max={max}
                reason={reason}
                change={number => changeShadow({[key]: number})}
              />
            ))}
            <ColorProperty
              label="그림자 색"
              value={shadow.color}
              reason={reason}
              commit={color => changeShadow({color})}
            />
          </>
        ) : null}
      </PropertyGroup>
    </>
  );
}

function sizesOf(text: string): number[] | undefined {
  const sizes = text
    .split(',')
    .map(part => Number(part.trim()))
    .filter(size => size > 0);
  return sizes.length === 0 ? undefined : sizes;
}

/** How a text gets smaller, and how its rows are kept, when it is long. */
export function ThemeFitProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: ThemeGroupedText;
}): JSX.Element {
  const reason = model.elementReason;
  const fit = element.fit ?? {};
  const change = (update: Partial<Record<keyof Fit, unknown>>): void =>
    changeText(model, element.id, current => {
      const {fit: before, ...rest} = current;
      const next = Object.fromEntries(
        Object.entries({...before, ...update}).filter(
          ([, value]) => value !== undefined && value !== false,
        ),
      );
      return Object.keys(next).length === 0 ? rest : {...rest, fit: next};
    });
  return (
    <PropertyGroup title="긴 글">
      <StringProperty
        label="크기 단계"
        value={fit.sizes?.join(', ') ?? ''}
        reason={reason}
        placeholder="없음"
        commit={text => change({sizes: sizesOf(text)})}
      />
      <ThemeOptionalNumber
        label="최소 크기"
        value={fit.min}
        first={Math.round(element.style.size / 2)}
        min={THEME_FILE_LIMITS.fontSize.min}
        max={THEME_FILE_LIMITS.fontSize.max}
        reason={reason}
        change={min => change({min})}
      />
      <ThemeOptionalNumber
        label="최대 줄 수"
        value={fit.rows}
        first={2}
        min={1}
        max={THEME_FILE_LIMITS.rows}
        reason={reason}
        change={rows => change({rows})}
      />
      <ThemeCheck
        label="적은 줄 유지"
        checked={fit.keepRows ?? false}
        reason={reason}
        change={keepRows => change({keepRows})}
      />
      <ThemeCheck
        label="항목 안에서 같게"
        checked={fit.together ?? false}
        reason={reason}
        change={together => change({together})}
      />
      <ThemeCheck
        label="줄 고르게"
        checked={element.wrap === 'balance'}
        reason={reason}
        change={on =>
          changeText(model, element.id, current => {
            const {wrap: _wrap, ...rest} = current;
            return on ? {...rest, wrap: 'balance'} : rest;
          })
        }
      />
      <ThemeOptionalNumber
        label="높이 고정"
        value={element.height}
        first={element.frame.h}
        min={1}
        max={themeCanvasBounds.height}
        reason={reason}
        change={height =>
          changeText(model, element.id, current => {
            const {height: _height, ...rest} = current;
            return height === undefined ? rest : {...rest, height};
          })
        }
      />
      <ThemeOptionalNumber
        label="최소 줄 수"
        value={element.rows}
        first={1}
        min={1}
        max={THEME_FILE_LIMITS.rows}
        reason={reason}
        change={rows =>
          changeText(model, element.id, current => {
            const {rows: _rows, ...rest} = current;
            return rows === undefined ? rest : {...rest, rows};
          })
        }
      />
    </PropertyGroup>
  );
}
