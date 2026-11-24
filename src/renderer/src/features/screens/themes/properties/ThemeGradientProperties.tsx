import {useState, type JSX} from 'react';
import {THEME_FILE_LIMITS} from '@core/schema/screens/theme';
import {
  addGradientStop,
  moveGradientStop,
  removeGradientStop,
  GRADIENT_PRESETS,
  isGradientPreset,
  type GradientBackground,
} from '@core/theme';
import {backgroundPaint} from '@renderer/rendering/themeBackground';
import {sampleGradient} from '@renderer/rendering/sampleGradient';
import {IconButton, NumberField, PropertyRow} from '@renderer/ui';
import {ColorProperty} from '../../ColorProperty';
import {ThemeNumber} from './ThemePropertyFields';
import {GradientStopBar} from './GradientStopBar';
import type {ThemeModel} from '../useThemeEditor';
import styles from './ThemeGradient.module.css';

const MAX_ANGLE = 359;

/** Chooses a preset of a gradient, or its angle and colors. */
export function ThemeGradientProperties({
  gradient,
  model,
  change,
}: {
  readonly gradient: GradientBackground;
  readonly model: ThemeModel;
  readonly change: (gradient: GradientBackground) => void;
}): JSX.Element {
  const [selection, select] = useState(0);
  const selected = Math.min(selection, gradient.stops.length - 1);
  const stop = gradient.stops[selected];
  const {reason} = model;
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
                  style={backgroundPaint(preset.gradient)}
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
        max={MAX_ANGLE}
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
                gradient.stops.length >= THEME_FILE_LIMITS.gradientStops ||
                reason !== undefined
              ) {
                return;
              }
              const color = sampleGradient(gradient, position);
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
                      ? '색이 2개 이상 있어야 합니다.'
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
