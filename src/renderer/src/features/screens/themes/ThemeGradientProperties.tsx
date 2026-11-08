import {useState, type JSX} from 'react';
import {
  THEME_BACKGROUND_LIMITS,
  type ThemeGradient,
} from '@core/schema/themeBackground';
import {
  addGradientStop,
  moveGradientStop,
  removeGradientStop,
} from '@core/themes/gradientEdits';
import {GRADIENT_PRESETS, isGradientPreset} from '@core/themes/gradientPresets';
import {themeBackgroundStyle} from '@renderer/rendering/themeBackground';
import {sampleThemeGradient} from '@renderer/rendering/sampleThemeGradient';
import {IconButton, NumberField, PropertyRow} from '@renderer/ui';
import {ColorProperty} from '../ColorProperty';
import {ThemeNumber} from './ThemePropertyFields';
import {GradientStopBar} from './GradientStopBar';
import type {ThemeModel} from './useThemeEditor';
import styles from './ThemeGradient.module.css';

export function ThemeGradientProperties({
  gradient,
  model,
  change,
}: {
  readonly gradient: ThemeGradient;
  readonly model: ThemeModel;
  readonly change: (gradient: ThemeGradient) => void;
}): JSX.Element {
  const [selection, select] = useState(0);
  const selected = Math.min(selection, gradient.stops.length - 1);
  const stop = gradient.stops[selected];
  const reason = model.elementReason;
  const remove = (): void => {
    if (reason !== undefined) return;
    const next = removeGradientStop(gradient, selected);
    if (next === gradient) return;
    select(Math.min(selected, next.stops.length - 1));
    change(next);
  };
  return (
    <>
      <PropertyRow label="프리셋" alignTop>
        {({controlId, labelId}) => (
          <div
            id={controlId}
            role="group"
            aria-labelledby={labelId}
            className={styles.presets}
          >
            {GRADIENT_PRESETS.map(preset => (
              <button
                key={preset.name}
                type="button"
                className={styles.preset}
                aria-pressed={isGradientPreset(gradient, preset.gradient)}
                disabled={reason !== undefined}
                title={reason}
                onClick={() => {
                  select(0);
                  if (!isGradientPreset(gradient, preset.gradient)) {
                    change({
                      ...gradient,
                      angle: preset.gradient.angle,
                      stops: preset.gradient.stops,
                    });
                  }
                }}
              >
                <span
                  className={styles.picture}
                  style={themeBackgroundStyle(preset.gradient)}
                />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        )}
      </PropertyRow>
      <ThemeNumber
        label="각도"
        value={gradient.angle}
        max={THEME_BACKGROUND_LIMITS.angle}
        reason={reason}
        change={angle => change({...gradient, angle})}
      />
      <PropertyRow label="색상점" alignTop>
        {() => (
          <GradientStopBar
            gradient={gradient}
            selected={selected}
            reason={reason}
            select={select}
            change={change}
            remove={remove}
            begin={model.beginEditGroup}
            add={position => {
              if (
                gradient.stops.length >= THEME_BACKGROUND_LIMITS.stops ||
                reason !== undefined
              ) {
                return;
              }
              const color = sampleThemeGradient(gradient, position);
              if (color === null) {
                model.reportError(
                  new Error('Could not sample a gradient color'),
                );
                return;
              }
              const next = addGradientStop(gradient, position, color);
              select(next.index);
              change(next.gradient);
              return next.index;
            }}
          />
        )}
      </PropertyRow>
      {stop === undefined ? null : (
        <>
          <ColorProperty
            key={selected}
            label="색"
            value={stop.color}
            reason={reason}
            commit={color =>
              change({
                ...gradient,
                stops: gradient.stops.map((value, index) =>
                  index === selected ? {...value, color} : value,
                ),
              })
            }
          />
          <PropertyRow label="위치">
            {({controlId}) => (
              <>
                <NumberField
                  id={controlId}
                  value={stop.position}
                  min={0}
                  max={100}
                  step={0.1}
                  unit="%"
                  updateOn="commit"
                  readOnly={reason !== undefined}
                  title={reason}
                  onChange={position => {
                    const next = moveGradientStop(gradient, selected, position);
                    select(next.index);
                    change(next.gradient);
                  }}
                />
                <IconButton
                  icon="trash"
                  label="색 삭제"
                  disabled={reason !== undefined || gradient.stops.length <= 2}
                  title={
                    reason ??
                    (gradient.stops.length <= 2
                      ? '색이 2개 이상 있어야 합니다'
                      : undefined)
                  }
                  onClick={remove}
                />
              </>
            )}
          </PropertyRow>
        </>
      )}
    </>
  );
}
