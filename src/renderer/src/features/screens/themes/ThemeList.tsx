import {useEffect, useRef, useState, type JSX} from 'react';
import {limitReason} from '@core/common/limitReason';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import {slidePurposes, type ThemeFile} from '@core/schema/theme';
import {THEMES_LIMITS} from '@core/schema/themes';
import {
  copiedThemeName,
  editThemeList,
  newTheme,
  ownThemeCount,
  type ThemeListEdit,
  builtInTheme,
  themeFor,
} from '@core/theme';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {Panel, PanelActions, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import {ChoiceRows} from '../ChoiceRows';
import {purposeNames, themeProblems} from './themeNames';
import {ThemeMenu} from './ThemeMenu';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';
import {useAlive} from '@renderer/ui/useAlive';

function newId(): ThemeId {
  return createThemeId(crypto.randomUUID());
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
  const alive = useAlive();
  const focusCreated = useRef<ThemeId | null>(null);
  useEffect(() => {
    const id = focusCreated.current;
    if (id === null) return;
    const row = document.querySelector<HTMLElement>(
      `[role="listbox"][aria-label="테마"] [role="option"][data-value="${id}"]`,
    );
    if (row !== null) {
      row.focus({preventScroll: true});
      focusCreated.current = null;
    }
  }, [model.theme?.id]);
  const renameAfterMenu = useMenuHandoff<ThemeFile>(menu !== null, theme => {
    model.chooseTheme(theme.id);
    setRenaming(theme.id);
  });
  const execute = async (edit: ThemeListEdit): Promise<boolean> => {
    const unchanged = model.guardInteraction();
    const result = await model.change(
      value => editThemeList(value, edit),
      edit.kind === 'rename' ? 'saved' : 'applied',
    );
    if (!alive.current) return false;
    if (!result.ok) {
      model.report(themeProblems[result.error]);
      return false;
    }
    if (result.value && edit.kind === 'add' && unchanged()) {
      model.chooseTheme(edit.theme.id);
      focusCreated.current = edit.theme.id;
    }
    return result.value;
  };
  const run = (edit: ThemeListEdit): void => {
    execute(edit).catch(model.reportError);
  };
  const requestDelete = (theme: ThemeFile): void => {
    deleteSelection(
      1,
      () => model.reason === undefined && builtInTheme(theme.id) === undefined,
      () => {
        if (model.dirtyThemeId === theme.id) model.discard();
        run({kind: 'delete', id: theme.id});
      },
    );
  };
  const deleteAfterMenu = useMenuHandoff<ThemeFile>(
    menu !== null,
    requestDelete,
  );
  const full = list !== null && ownThemeCount(list) >= THEMES_LIMITS.themes;
  const addReason =
    reason ?? (full ? limitReason('테마', THEMES_LIMITS.themes) : undefined);
  const duplicate = (theme: ThemeFile): void => {
    if (list === null) return;
    run({
      kind: 'add',
      theme: {
        ...theme,
        id: newId(),
        name: copiedThemeName(list, theme.name),
      },
      after: theme.id,
    });
  };
  useWindowShortcuts([
    {
      id: 'edit.duplicate',
      when: event =>
        event.target instanceof Element &&
        event.target.closest('[role="listbox"][aria-label="테마"]') !== null &&
        model.theme !== undefined,
      unavailable: () => addReason,
      run: () => {
        if (addReason === undefined && model.theme !== undefined) {
          duplicate(model.theme);
        }
      },
    },
  ]);
  const isDefault = (theme: ThemeFile): boolean =>
    list !== null && themeFor(list, theme.purpose).id === theme.id;
  const choices = list?.themes ?? [];
  return (
    <>
      <Panel label="테마 목록" className={styles.themeList}>
        <PanelHeader>
          <PanelTitle title="테마" />
          <PanelActions>
            <IconButton
              icon="plus"
              label="새 테마"
              disabled={addReason !== undefined}
              title={addReason}
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
            const theme = choices.find(value => value.id === id);
            if (theme !== undefined) model.chooseTheme(theme.id);
          }}
          canMove={() => reason === undefined}
          onMove={(id, before) => {
            const source = choices.find(theme => theme.id === id);
            const next = choices.find(theme => theme.id === before);
            if (source !== undefined) {
              run({kind: 'move', id: source.id, before: next?.id ?? null});
            }
          }}
          onRename={theme => {
            if (reason === undefined) setRenaming(theme.id);
          }}
          onDelete={requestDelete}
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
                      const theme = choices.find(
                        value => value.id === renaming,
                      );
                      return theme === undefined
                        ? false
                        : execute({kind: 'rename', id: theme.id, name});
                    },
                    onClose: () => setRenaming(null),
                  },
                }
          }
          rowEnd={theme => (
            <span className={styles.tags}>
              {isDefault(theme) ? (
                <span className={styles.tag}>기본</span>
              ) : theme.name === purposeNames[theme.purpose] ? null : (
                <span className={styles.tag}>
                  {purposeNames[theme.purpose]}
                </span>
              )}
            </span>
          )}
        />
      </Panel>
      {menu === null ? null : (
        <ThemeMenu
          theme={menu.theme}
          anchor={menu.anchor}
          actions={{
            isDefault: isDefault(menu.theme),
            reason,
            addReason,
            makeDefault: () => run({kind: 'default', id: menu.theme.id}),
            duplicate: () => duplicate(menu.theme),
            rename: () => renameAfterMenu(menu.theme),
            restore: () => {
              if (model.dirtyThemeId === menu.theme.id) model.discard();
              run({kind: 'restore', id: menu.theme.id});
            },
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
            onSelect: () =>
              run({
                kind: 'add',
                theme: newTheme(list, purpose, newId()),
                after: themeFor(list, purpose).id,
              }),
          }))}
          onClose={() => setAdding(null)}
        />
      )}
    </>
  );
}
