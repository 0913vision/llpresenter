import type {JSX} from 'react';
import type {SlideBackground} from '@core/schema/screens/theme';
import {createGradient, GRADIENT_PRESETS, APP_PICTURE_IDS} from '@core/theme';
import {PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {ColorProperty} from '../../ColorProperty';
import {ThemeGradientProperties} from './ThemeGradientProperties';
import {ThemeFitRow} from './ThemePropertyFields';
import {ThemeImageChoice} from './ThemeImageChoice';
import type {ThemeModel} from '../useThemeEditor';

const KINDS = [
  {value: 'none', label: '없음'},
  {value: 'color', label: '단색'},
  {value: 'gradient', label: '그라데이션'},
  {value: 'media', label: '이미지'},
] as const;

const FIRST_COLOR = '#000000';

function startOf(
  kind: SlideBackground['kind'],
  before: SlideBackground,
): SlideBackground {
  const color =
    before.kind === 'color'
      ? before.color
      : before.kind === 'gradient'
        ? (before.stops[0]?.color ?? FIRST_COLOR)
        : FIRST_COLOR;
  switch (kind) {
    case 'none':
      return {kind};
    case 'color':
      return {kind, color};
    case 'gradient':
      return GRADIENT_PRESETS[0]?.gradient ?? createGradient(color);
    case 'media':
      return {kind, media: APP_PICTURE_IDS.scripture, fit: 'stretch'};
  }
}

/** What a theme shows behind its texts, unless a slide has its own. */
export function ThemeBackgroundProperties({
  model,
  background,
}: {
  readonly model: ThemeModel;
  readonly background: SlideBackground;
}): JSX.Element {
  const {reason} = model;
  const commit = (value: SlideBackground): void => {
    model.themeChange(theme => ({...theme, background: value}));
  };
  return (
    <>
      <PropertyRow label="배경">
        {({controlId}) => (
          <SelectMenu
            id={controlId}
            block
            options={KINDS}
            value={background.kind}
            disabled={reason !== undefined}
            title={reason}
            onChange={kind => {
              if (kind !== background.kind) commit(startOf(kind, background));
            }}
          />
        )}
      </PropertyRow>
      {background.kind === 'color' ? (
        <ColorProperty
          label="색"
          value={background.color}
          reason={reason}
          commit={color => commit({...background, color})}
        />
      ) : null}
      {background.kind === 'gradient' ? (
        <ThemeGradientProperties
          key={model.theme?.id}
          model={model}
          gradient={background}
          change={commit}
        />
      ) : null}
      {background.kind === 'media' ? (
        <>
          <PropertyRow label="이미지">
            {({controlId}) => (
              <ThemeImageChoice
                id={controlId}
                selected={background.media}
                reason={reason}
                change={media => commit({...background, media})}
              />
            )}
          </PropertyRow>
          <ThemeFitRow
            value={background.fit ?? 'fill'}
            reason={reason}
            change={fit => commit({...background, fit})}
          />
        </>
      ) : null}
    </>
  );
}
