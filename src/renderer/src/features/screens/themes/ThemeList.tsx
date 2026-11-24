import {useState, type JSX} from 'react';
import {slidePurposes, type ThemeFile} from '@core/schema/theme';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/menus/Menu';
import {Panel, PanelActions, PanelHeader, PanelTitle} from '@renderer/ui/panels/Panel';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {ChoiceRows} from '../ChoiceRows';
import {purposeNames} from './themeNames';
import {ThemeMenu} from './ThemeMenu';
import type {ThemeModel} from './useThemeEditor';
import {useThemeListActions} from './useThemeListActions';
import styles from './Themes.module.css';

/** 기본 on the default theme of its purpose, else the purpose a renamed theme is for. */
function ThemeTag({
  theme,
  isDefault,
}: {
  readonly theme: ThemeFile;
  readonly isDefault: boolean;
}): JSX.Element {
  return (
    <span className={styles.tags}>
      {isDefault ? (
        <span className={styles.tag}>기본</span>
      ) : theme.name === purposeNames[theme.purpose] ? null : (
        <span className={styles.tag}>{purposeNames[theme.purpose]}</span>
      )}
    </span>
  );
}

export function ThemeList({
  model,
  liveId,
}: {
  readonly model: ThemeModel;
  readonly liveId: string | undefined;
}): JSX.Element {
  const {list, reason} = model;
  const [menu, setMenu] = useState<{
    readonly theme: ThemeFile;
    readonly anchor: MenuAnchor;
  } | null>(null);
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const actions = useThemeListActions(model);
  const renameAfterMenu = useMenuHandoff<ThemeFile>(menu !== null, theme => {
    model.chooseTheme(theme.id);
    setRenaming(theme.id);
  });
  const deleteAfterMenu = useMenuHandoff<ThemeFile>(
    menu !== null,
    actions.requestDelete,
  );
  const choices = list?.themes ?? [];
  const find = (id: string | null): ThemeFile | undefined =>
    choices.find(theme => theme.id === id);
  return (
    <>
      <Panel label="테마 목록" className={styles.themeList}>
        <PanelHeader>
          <PanelTitle title="테마" />
          <PanelActions>
            <IconButton
              icon="plus"
              label="새 테마"
              disabled={actions.addReason !== undefined}
              title={actions.addReason}
              onClick={event => setAdding(event.currentTarget)}
            />
          </PanelActions>
        </PanelHeader>
        <ChoiceRows
          choices={choices}
          selected={model.theme?.id}
          inUse={new Set(liveId === undefined ? [] : [liveId])}
          modified={
            new Set(model.dirtyThemeId === null ? [] : [model.dirtyThemeId])
          }
          label="테마"
          onSelect={id => {
            const theme = find(id);
            if (theme !== undefined) model.chooseTheme(theme.id);
          }}
          canMove={() => reason === undefined}
          onMove={(id, before) => {
            const source = find(id);
            if (source !== undefined) {
              actions.move(source.id, find(before)?.id ?? null);
            }
          }}
          onRename={theme => {
            if (reason === undefined) setRenaming(theme.id);
          }}
          onDelete={actions.requestDelete}
          onMenu={(theme, anchor) => {
            model.chooseTheme(theme.id);
            setMenu({theme, anchor});
          }}
          renaming={
            renaming === null
              ? null
              : {
                  id: renaming,
                  handlers: {
                    onCommit: async name => {
                      const theme = find(renaming);
                      return theme === undefined
                        ? false
                        : actions.rename(theme.id, name);
                    },
                    onClose: () => setRenaming(null),
                  },
                }
          }
          rowEnd={theme => (
            <ThemeTag theme={theme} isDefault={actions.isDefault(theme)} />
          )}
        />
      </Panel>
      {menu === null ? null : (
        <ThemeMenu
          theme={menu.theme}
          anchor={menu.anchor}
          actions={{
            isDefault: actions.isDefault(menu.theme),
            reason,
            addReason: actions.addReason,
            makeDefault: () => actions.makeDefault(menu.theme.id),
            duplicate: () => actions.duplicate(menu.theme),
            rename: () => renameAfterMenu(menu.theme),
            restore: () => actions.restore(menu.theme.id),
            remove: () => {
              deleteAfterMenu(menu.theme);
              setMenu(null);
            },
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {adding === null || list === null ? null : (
        <Menu
          label="새 테마"
          anchor={{kind: 'element', element: adding}}
          entries={slidePurposes.map(purpose => ({
            kind: 'item',
            id: purpose,
            label: purposeNames[purpose],
            onSelect: () => actions.add(purpose),
          }))}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  );
}
