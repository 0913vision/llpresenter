import type {JSX} from 'react';
import {
  THEME_BACKGROUND_LIMITS,
  type ThemeBackground,
  type ThemeGradient,
} from '@core/schema/themeBackground';
import {addGradientStop, createThemeGradient} from '@core/themes/gradientEdits';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {
  Button,
  IconButton,
  NumberField,
  PropertyRow,
  SegmentedControl,
} from '@renderer/ui';
import {ColorProperty} from '../ColorProperty';
import {ThemeNumber} from './ThemePropertyFields';
import type {ThemeModel} from './useThemeEditor';

const BACKGROUNDS = [
  {value: 'inherit', label: '화면 기본'},
  {value: 'solid', label: '단색'},
  {value: 'linear', label: '그라데이션'},
] as const;

export function ThemeBackgroundProperties({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element | null {
  const {layout, screen, elementReason: reason} = model;
  if (layout === undefined || screen === undefined) return null;
  const background = layout.background;
  const selected =
    background === undefined
      ? 'inherit'
      : typeof background === 'string'
        ? 'solid'
        : 'linear';
  const inherited = emptyScreenColor(screen);
  const commit = (value: ThemeBackground | undefined): void =>
    model.layoutChange(current => {
      const {background: previous, ...rest} = current;
      return value === undefined ? rest : {...current, background: value};
    });
  const update = (change: (gradient: ThemeGradient) => ThemeGradient): void =>
    model.layoutChange(current =>
      typeof current.background === 'object'
        ? {...current, background: change(current.background)}
        : current,
    );
  return (
    <>
      <PropertyRow label="배경">
        {({controlId, labelId}) => (
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            options={BACKGROUNDS}
            value={selected}
            disabled={reason !== undefined}
            title={reason}
            onChange={kind => {
              if (kind === selected) return;
              commit(
                kind === 'inherit'
                  ? undefined
                  : kind === 'solid'
                    ? typeof background === 'string'
                      ? background
                      : (background?.stops[0]?.color ?? inherited)
                    : createThemeGradient(
                        typeof background === 'string' ? background : inherited,
                      ),
              );
            }}
          />
        )}
      </PropertyRow>
      {typeof background === 'string' ? (
        <ColorProperty
          label="색"
          value={background}
          reason={reason}
          commit={commit}
        />
      ) : null}
      {background === undefined || typeof background === 'string' ? null : (
        <>
          <ThemeNumber
            label="각도"
            value={background.angle}
            max={THEME_BACKGROUND_LIMITS.angle}
            reason={reason}
            change={angle => update(current => ({...current, angle}))}
          />
          {background.stops.map((stop, index) => (
            <div key={index}>
              <ColorProperty
                label={`색 ${index + 1}`}
                value={stop.color}
                reason={reason}
                commit={color =>
                  update(current => ({
                    ...current,
                    stops: current.stops.map((value, at) =>
                      at === index ? {...value, color} : value,
                    ),
                  }))
                }
              />
              <PropertyRow label={`위치 ${index + 1}`}>
                {({controlId}) => (
                  <>
                    <NumberField
                      id={controlId}
                      value={stop.position}
                      min={background.stops[index - 1]?.position ?? 0}
                      max={background.stops[index + 1]?.position ?? 100}
                      step={0.1}
                      unit="%"
                      updateOn="commit"
                      readOnly={reason !== undefined}
                      title={reason}
                      onChange={position =>
                        update(current => ({
                          ...current,
                          stops: current.stops.map((value, at) =>
                            at === index ? {...value, position} : value,
                          ),
                        }))
                      }
                    />
                    <IconButton
                      icon="trash"
                      label={`색 ${index + 1} 삭제`}
                      disabled={
                        reason !== undefined || background.stops.length <= 2
                      }
                      title={
                        reason ??
                        (background.stops.length <= 2
                          ? '색이 2개 이상 있어야 합니다'
                          : undefined)
                      }
                      onClick={() =>
                        update(current =>
                          current.stops.length <= 2
                            ? current
                            : {
                                ...current,
                                stops: current.stops.filter(
                                  (_, at) => at !== index,
                                ),
                              },
                        )
                      }
                    />
                  </>
                )}
              </PropertyRow>
            </div>
          ))}
          <PropertyRow label="색 추가">
            {() => (
              <Button
                icon="plus"
                disabled={
                  reason !== undefined ||
                  background.stops.length >= THEME_BACKGROUND_LIMITS.stops
                }
                title={
                  reason ??
                  (background.stops.length >= THEME_BACKGROUND_LIMITS.stops
                    ? '색은 4개까지 추가할 수 있습니다'
                    : undefined)
                }
                onClick={() => update(addGradientStop)}
              >
                색 추가
              </Button>
            )}
          </PropertyRow>
        </>
      )}
    </>
  );
}
