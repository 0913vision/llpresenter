import type {JSX} from 'react';
import type {ThemeElement} from '@core/schema/themes';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {hasThemeText} from '@core/themes/elementEdits';
import {
  Properties,
  PropertyColumns,
  PropertyGroup,
  PropertyRow,
} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {StageColorProperty} from '../stage/StageColorProperty';
import {ThemeTextProperties} from './ThemeTextProperties';
import {ThemeImageChoice} from './ThemeImageChoice';
import {ThemeNumber, ThemeCheck, ThemeContent} from './ThemePropertyFields';
import {themeElementNames} from './themeNames';
import type {ThemeModel} from './useThemeEditor';

export function ThemeElementProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: ThemeElement;
}): JSX.Element {
  const reason = model.elementReason;
  const change = (transform: (value: ThemeElement) => unknown): void =>
    model.property(element.id, transform);
  const box =
    element.kind === 'box' || hasThemeText(element) ? element.box : undefined;
  const boxChange = (patch: object): void =>
    change(value =>
      value.kind === 'box' || hasThemeText(value)
        ? {
            ...value,
            box: {
              on: true,
              fill: '#000000',
              opacity: 100,
              radius: 0,
              ...value.box,
              ...patch,
            },
          }
        : value,
    );
  return (
    <Properties key={element.id}>
      <PropertyGroup title={themeElementNames[element.kind]}>
        <PropertyColumns>
          {(['x', 'y', 'w', 'h'] as const).map(field => (
            <ThemeNumber
              key={field}
              label={field.toUpperCase()}
              value={element.frame[field]}
              min={
                field === 'x' || field === 'y' ? 0 : THEME_LIMITS.minimumExtent
              }
              max={
                field === 'x'
                  ? THEME_LIMITS.width - element.frame.w
                  : field === 'y'
                    ? THEME_LIMITS.height - element.frame.h
                    : field === 'w'
                      ? THEME_LIMITS.width - element.frame.x
                      : THEME_LIMITS.height - element.frame.y
              }
              reason={reason}
              change={value => model.frameValue(element.id, {field, value})}
            />
          ))}
        </PropertyColumns>
        {element.kind === 'text' ? (
          <ThemeContent
            value={element.content}
            reason={reason}
            change={content => change(value => ({...value, content}))}
          />
        ) : null}
        {element.kind === 'clock' ? (
          <PropertyRow label="시계 형식">
            {({controlId, labelId}) => (
              <SegmentedControl
                id={controlId}
                labelledBy={labelId}
                value={element.clockFormat}
                disabled={reason !== undefined}
                title={reason}
                options={[
                  {value: '24h', label: '24시간'},
                  {value: '12h', label: '12시간'},
                ]}
                onChange={clockFormat =>
                  change(value => ({...value, clockFormat}))
                }
              />
            )}
          </PropertyRow>
        ) : null}
        {element.kind === 'timer' ? (
          <PropertyRow label="타이머">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                value={element.timerId ?? ''}
                disabled={reason !== undefined}
                title={reason}
                options={[
                  {value: '', label: '없음'},
                  ...model.timers.map(timer => ({
                    value: timer.id,
                    label: timer.name,
                  })),
                ]}
                onChange={id =>
                  change(value => {
                    if (value.kind !== 'timer') return value;
                    const {timerId, ...rest} = value;
                    const timer = model.timers.find(timer => timer.id === id);
                    return timer === undefined
                      ? rest
                      : {...rest, timerId: timer.id};
                  })
                }
              />
            )}
          </PropertyRow>
        ) : null}
        {element.kind === 'image' ? (
          <PropertyRow label="그림">
            {({controlId}) => (
              <ThemeImageChoice
                id={controlId}
                images={model.images}
                selected={element.mediaId}
                reason={reason}
                change={mediaId => change(value => ({...value, mediaId}))}
              />
            )}
          </PropertyRow>
        ) : null}
        {element.kind === 'image' ||
        element.kind === 'media' ||
        element.kind === 'background' ||
        element.kind === 'overlay' ? (
          <PropertyRow label="맞춤">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                value={element.fit}
                disabled={reason !== undefined}
                title={reason}
                options={[
                  {value: 'fit', label: '맞추기'},
                  {value: 'fill', label: '채우기'},
                  {value: 'stretch', label: '늘리기'},
                ]}
                onChange={fit => change(value => ({...value, fit}))}
              />
            )}
          </PropertyRow>
        ) : null}
        {element.kind === 'image' ||
        element.kind === 'media' ||
        element.kind === 'background' ? (
          <ThemeNumber
            label="모서리"
            value={element.radius}
            max={THEME_LIMITS.radius}
            reason={reason}
            change={radius => change(value => ({...value, radius}))}
          />
        ) : null}
      </PropertyGroup>
      {hasThemeText(element) ? (
        <ThemeTextProperties model={model} element={element} />
      ) : null}
      {element.kind === 'box' || hasThemeText(element) ? (
        <PropertyGroup title="배경">
          <ThemeCheck
            label="채우기"
            checked={box?.on ?? false}
            reason={reason}
            change={on => boxChange({on})}
          />
          {box?.on ? (
            <>
              <StageColorProperty
                label="색"
                value={box.fill}
                reason={reason}
                commit={fill => boxChange({fill})}
              />
              <ThemeNumber
                label="불투명도"
                value={box.opacity}
                max={100}
                reason={reason}
                change={opacity => boxChange({opacity})}
              />
              <ThemeNumber
                label="모서리"
                value={box.radius ?? 0}
                max={THEME_LIMITS.radius}
                reason={reason}
                change={radius => boxChange({radius})}
              />
            </>
          ) : null}
        </PropertyGroup>
      ) : null}
    </Properties>
  );
}
