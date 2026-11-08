import type {JSX} from 'react';
import {type ThemeBackground} from '@core/schema/themeBackground';
import {createThemeGradient} from '@core/themes/gradientEdits';
import {GRADIENT_PRESETS} from '@core/themes/gradientPresets';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {PropertyRow, SegmentedControl} from '@renderer/ui';
import {ColorProperty} from '../ColorProperty';
import {ThemeGradientProperties} from './ThemeGradientProperties';
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
                    : (GRADIENT_PRESETS[0]?.gradient ??
                      createThemeGradient(inherited)),
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
        <ThemeGradientProperties
          key={`${model.theme?.id}:${screen.id}`}
          model={model}
          gradient={background}
          change={commit}
        />
      )}
    </>
  );
}
