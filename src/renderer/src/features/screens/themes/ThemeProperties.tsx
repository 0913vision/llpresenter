import type {JSX} from 'react';
import {SlidePicture} from '@renderer/pictures/SlidePicture';
import {Panel, PanelBody, PanelHeader, PanelTabs} from '@renderer/ui/Panel';
import {ThemeElementProperties} from './ThemeElementProperties';
import {ThemeFileProperties} from './ThemeFileProperties';
import {ThemeScreenProperties} from './ThemeScreenProperties';
import {sampleDrawing} from './themeDrawing';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

export function ThemeProperties({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element {
  const {theme, screens, labels} = model;
  const element =
    model.selectedIds.length === 1
      ? model.layout?.elements.find(value => value.id === model.selectedIds[0])
      : undefined;
  return (
    <Panel label="테마 속성" className={styles.right}>
      <div className={styles.thumbnails}>
        {screens.map(screen => (
          <button
            key={screen.id}
            type="button"
            className={styles.screenButton}
            aria-label={`${screen.name} 편집`}
            aria-pressed={model.screen?.id === screen.id}
            onClick={() => model.chooseScreen(screen.id)}
          >
            <span className={styles.thumbnail}>
              {theme === undefined ? null : (
                <SlidePicture
                  {...sampleDrawing(theme, screen, {screens, labels})}
                />
              )}
            </span>
            <span>{screen.name}</span>
          </button>
        ))}
      </div>
      <PanelHeader>
        <PanelTabs
          tabs={[
            {value: 'element', label: '요소'},
            {value: 'screen', label: '화면'},
            {value: 'theme', label: '테마'},
          ]}
          value={model.tab}
          onChange={model.setTab}
        />
      </PanelHeader>
      <PanelBody variant="properties" tab={model.tab}>
        {model.tab === 'theme' ? (
          <ThemeFileProperties model={model} />
        ) : model.tab === 'screen' ? (
          <ThemeScreenProperties model={model} />
        ) : element === undefined ? null : (
          <ThemeElementProperties model={model} element={element} />
        )}
      </PanelBody>
    </Panel>
  );
}
