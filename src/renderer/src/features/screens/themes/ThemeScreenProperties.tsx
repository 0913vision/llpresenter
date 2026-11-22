import type {JSX} from 'react';
import {THEME_CANVAS, screenKinds, type ScreenKind} from '@core/schema/theme';
import {canFollow, ownLayoutFrom} from '@core/theme/screens';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {withParticle} from '@renderer/ui/korean';
import {ColorProperty} from '../ColorProperty';
import type {ThemeModel} from './useThemeEditor';

const kindNames: Readonly<Record<ScreenKind, string>> = {
  audience: '청중 화면',
  broadcast: '방송',
  stage: '무대 화면',
};

/** What a theme says for the open screen. */
export function ThemeScreenProperties({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element | null {
  const {own, target, reason, screens} = model;
  if (own === undefined || target === undefined) return null;
  const {theme, screen} = target;
  const value = own.mode === 'same' ? own.as : own.mode;
  return (
    <Properties>
      <PropertyGroup title="화면">
        <PropertyRow label="방식" alignTop>
          {({controlId, labelId}) => (
            <SegmentedControl<'own' | 'empty' | ScreenKind>
              id={controlId}
              labelledBy={labelId}
              appearance="radioList"
              value={value}
              disabled={reason !== undefined}
              title={reason}
              options={[
                {value: 'own', label: '직접 배치'},
                ...screenKinds
                  .filter(as => canFollow(theme, screen, {as, screens}))
                  .map(as => {
                    const name =
                      screens.find(entry => entry.kind === as)?.name ??
                      kindNames[as];
                    return {
                      value: as,
                      label: `${name}${withParticle(name)} 같음`,
                    };
                  }),
                {value: 'empty', label: '비움'},
              ]}
              onChange={mode =>
                model.screenChange(
                  mode === 'own'
                    ? ownLayoutFrom(theme, screen)
                    : mode === 'empty'
                      ? {mode}
                      : {mode: 'same', as: mode},
                )
              }
            />
          )}
        </PropertyRow>
        {own.mode === 'own' ? (
          <ColorProperty
            label="바탕색"
            value={own.backdrop ?? ''}
            reason={reason}
            allowNone
            noneLabel="화면 기본"
            commit={color => {
              const {backdrop: _backdrop, ...rest} = own;
              model.screenChange(
                color === '' ? rest : {...rest, backdrop: color},
              );
            }}
          />
        ) : null}
        <PropertyValue
          label="크기"
          value={`${THEME_CANVAS.width} × ${THEME_CANVAS.height}`}
        />
      </PropertyGroup>
    </Properties>
  );
}
