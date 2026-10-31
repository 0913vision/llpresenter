import type {JSX} from 'react';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {hasThemeText, type TextThemeElement} from '@core/themes/elementEdits';
import {LYRIC_EFFECT_LIMITS} from '@core/schema/looks';
import type {ThemeText} from '@core/schema/themes';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {FontPicker} from '../looks/FontPicker';
import {missingFontReason, weightChoices} from '../looks/fontAvailability';
import {useFontCatalog} from '../looks/useFontCatalog';
import {StageColorProperty} from '../stage/StageColorProperty';
import {ThemeCheck, ThemeNumber} from './ThemePropertyFields';
import type {ThemeModel} from './useThemeEditor';

export function ThemeTextProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: TextThemeElement;
}): JSX.Element {
  const fonts = useFontCatalog();
  const reason = model.elementReason;
  const change = (transform: (text: ThemeText) => unknown): void =>
    model.property(element.id, current =>
      hasThemeText(current)
        ? {...current, text: transform(current.text)}
        : current,
    );
  const text = element.text;
  const weights = weightChoices(text.font, text.weight, fonts).filter(
    option =>
      Number(option.value) >= THEME_LIMITS.weight.min &&
      Number(option.value) <= THEME_LIMITS.weight.max,
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
          min={THEME_LIMITS.fontSize.min}
          max={THEME_LIMITS.fontSize.max}
          reason={reason}
          change={size => change(value => ({...value, size}))}
        />
        <StageColorProperty
          label="글자색"
          value={text.color}
          reason={reason}
          commit={color => change(value => ({...value, color}))}
        />
        <ThemeNumber
          label="줄 간격"
          value={text.lineHeight}
          min={THEME_LIMITS.lineHeight.min}
          max={THEME_LIMITS.lineHeight.max}
          step={0.05}
          reason={reason}
          change={lineHeight => change(value => ({...value, lineHeight}))}
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
        {element.kind === 'currentText' || element.kind === 'nextText' ? (
          <ThemeNumber
            label="최대 줄 수"
            value={element.text.maxLines}
            min={1}
            max={THEME_LIMITS.maxLines}
            reason={reason}
            change={maxLines => change(value => ({...value, maxLines}))}
          />
        ) : null}
      </PropertyGroup>
      <PropertyGroup title="효과">
        <ThemeCheck
          label="외곽선"
          checked={text.outline.on}
          reason={reason}
          change={on =>
            change(value => ({...value, outline: {...value.outline, on}}))
          }
        />
        {text.outline.on ? (
          <>
            <ThemeNumber
              label="두께"
              value={text.outline.width}
              min={LYRIC_EFFECT_LIMITS.outlineWidth.min}
              max={LYRIC_EFFECT_LIMITS.outlineWidth.max}
              reason={reason}
              change={width =>
                change(value => ({
                  ...value,
                  outline: {...value.outline, width},
                }))
              }
            />
            <StageColorProperty
              label="외곽선 색"
              value={text.outline.color}
              reason={reason}
              commit={color =>
                change(value => ({
                  ...value,
                  outline: {...value.outline, color},
                }))
              }
            />
          </>
        ) : null}
        <ThemeCheck
          label="그림자"
          checked={text.shadow.on}
          reason={reason}
          change={on =>
            change(value => ({...value, shadow: {...value.shadow, on}}))
          }
        />
        {text.shadow.on ? (
          <>
            {(
              [
                {
                  key: 'blur',
                  label: '흐림',
                  max: LYRIC_EFFECT_LIMITS.shadowBlur,
                },
                {
                  key: 'distance',
                  label: '거리',
                  max: LYRIC_EFFECT_LIMITS.shadowDistance,
                },
                {
                  key: 'angle',
                  label: '각도',
                  max: LYRIC_EFFECT_LIMITS.shadowAngle,
                },
                {key: 'opacity', label: '불투명도', max: 100},
              ] as const
            ).map(({key, label, max}) => (
              <ThemeNumber
                key={key}
                label={label}
                value={text.shadow[key]}
                max={max}
                reason={reason}
                change={number =>
                  change(value => ({
                    ...value,
                    shadow: {...value.shadow, [key]: number},
                  }))
                }
              />
            ))}
            <StageColorProperty
              label="그림자 색"
              value={text.shadow.color}
              reason={reason}
              commit={color =>
                change(value => ({...value, shadow: {...value.shadow, color}}))
              }
            />
          </>
        ) : null}
      </PropertyGroup>
    </>
  );
}
