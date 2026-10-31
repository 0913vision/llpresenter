import type {JSX} from 'react';
import {THEME_LIMITS} from '@core/themes/elementRules';
import {editThemeLayout} from '@core/themes/themeEdits';
import {resolveThemeScreen} from '@core/themes/resolve';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {ThemePicture} from '@renderer/rendering/ThemePicture';
import {Panel, PanelHeader, PanelBody, PanelTabs} from '@renderer/ui/Panel';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {menuAvailability} from '@renderer/ui/menuModel';
import {StageColorProperty} from '../stage/StageColorProperty';
import {ThemeElementProperties} from './ThemeElementProperties';
import {themeSamples} from './ThemeCanvas';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

export function ThemeProperties({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element {
  const element =
    model.selectedIds.length === 1
      ? model.visibleElements.find(value => value.id === model.selectedIds[0])
      : undefined;
  return (
    <Panel label="테마 속성" className={styles.right}>
      <div className={styles.thumbnails}>
        {model.screens.map(screen => {
          const resolved =
            model.theme === undefined
              ? undefined
              : resolveThemeScreen(model.theme, screen.id, model.screens);
          const source =
            model.screens.find(
              value => value.id === resolved?.sourceScreenId,
            ) ?? screen;
          const color =
            resolved?.layout.mode.kind === 'own'
              ? (resolved.layout.background ?? emptyScreenColor(source))
              : emptyScreenColor(source);
          return (
            <button
              key={screen.id}
              type="button"
              className={styles.screenButton}
              aria-label={`${screen.name} 편집`}
              aria-pressed={model.screen?.id === screen.id}
              onClick={() => model.chooseScreen(screen.id)}
            >
              <span className={styles.thumbnail}>
                <ThemePicture
                  elements={resolved?.layout.elements ?? []}
                  background={color}
                  samples={themeSamples}
                  timers={model.renderTimers}
                />
              </span>
              <span>{screen.name}</span>
            </button>
          );
        })}
      </div>
      <PanelHeader>
        <PanelTabs
          tabs={[
            {value: 'element', label: '요소'},
            {value: 'screen', label: '화면'},
          ]}
          value={model.tab}
          onChange={model.setTab}
        />
      </PanelHeader>
      <PanelBody tab={model.tab}>
        {model.tab === 'screen' ? (
          <ThemeScreenProperties model={model} />
        ) : element === undefined ? null : (
          <ThemeElementProperties model={model} element={element} />
        )}
      </PanelBody>
    </Panel>
  );
}

function ThemeScreenProperties({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element | null {
  const {layout, target, file, screen} = model;
  if (
    layout === undefined ||
    target === undefined ||
    file === null ||
    screen === undefined
  ) {
    return null;
  }
  const value =
    layout.mode.kind === 'same' ? layout.mode.screen : layout.mode.kind;
  const links = model.screens
    .filter(other => other.id !== screen.id)
    .map(other => {
      const valid = editThemeLayout(file, target, current => ({
        ...current,
        mode: {kind: 'same', screen: other.id},
      })).ok;
      return {
        value: other.id,
        label: `${other.name}과 동일`,
        ...menuAvailability(valid ? undefined : '연결할 수 없는 화면'),
      };
    });
  return (
    <Properties>
      <PropertyGroup title="화면">
        <PropertyRow label="방식" alignTop>
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              labelledBy={labelId}
              appearance="radioList"
              value={value}
              disabled={model.reason !== undefined}
              title={model.reason}
              options={[
                {value: 'own', label: '직접 배치'},
                ...links,
                {value: 'empty', label: '비움'},
              ]}
              onChange={kind =>
                model.layoutChange(current => {
                  if (kind === 'own' || kind === 'empty') {
                    return {...current, mode: {kind}};
                  }
                  const other = model.screens.find(
                    screen => screen.id === kind,
                  );
                  return other === undefined
                    ? current
                    : {...current, mode: {kind: 'same', screen: other.id}};
                })
              }
            />
          )}
        </PropertyRow>
        <StageColorProperty
          label="배경색"
          value={layout.background ?? ''}
          allowNone
          inheritedColor={emptyScreenColor(screen)}
          noneLabel={`화면 기본 (${emptyScreenColor(screen) === '#000000' ? '검정' : emptyScreenColor(screen)})`}
          reason={model.elementReason}
          commit={background =>
            model.layoutChange(current => {
              const {background: previous, ...rest} = current;
              return background === '' ? rest : {...current, background};
            })
          }
        />
        <PropertyValue
          label="크기"
          value={`${THEME_LIMITS.width} × ${THEME_LIMITS.height}`}
        />
      </PropertyGroup>
    </Properties>
  );
}
