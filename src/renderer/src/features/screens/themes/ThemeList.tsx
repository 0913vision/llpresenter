import {limitReason} from '@core/common/limitReason';
import {useEffect, useRef, useState, type JSX} from 'react';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import type {Theme} from '@core/schema/themes';
import {THEME_LIMITS, themeItemKinds} from '@core/themes/elementRules';
import {isBuiltInThemeId, userThemeCount} from '@core/themes/builtInIds';
import {isSectionTheme} from '@core/themes/sundaySections';
import {editThemeList, type ThemeListEdit} from '@core/themes/themeEdits';
import {deleteSelection} from '@renderer/ui/useSelectionDelete';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {Panel, PanelHeader, PanelTitle, PanelActions} from '@renderer/ui/Panel';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {ChoiceRows} from '../ChoiceRows';
import {themeKindNames, themeProblems} from './themeNames';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

export function ThemeList({
  model,
  liveId,
}: {
  readonly model: ThemeModel;
  readonly liveId: string | undefined;
}): JSX.Element {
  const [menu, setMenu] = useState<{theme: Theme; anchor: MenuAnchor} | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const alive = useRef(true);
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
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const renameAfterMenu = useMenuHandoff<Theme>(menu !== null, theme => {
    model.chooseTheme(theme.id);
    setRenaming(theme.id);
  });
  const execute = async (edit: ThemeListEdit): Promise<boolean> => {
    const unchanged = model.guardInteraction();
    const result = await model.change(
      file => editThemeList(file, edit, new Set()),
      edit.kind === 'rename' ? 'saved' : 'applied',
    );
    if (!alive.current) return false;
    if (!result.ok) {
      model.report(themeProblems[result.error]);
      return false;
    }
    if (
      result.value &&
      unchanged() &&
      (edit.kind === 'add' || edit.kind === 'duplicate')
    ) {
      model.chooseTheme(edit.id);
      focusCreated.current = edit.id;
    }
    return result.value;
  };
  const run = (edit: ThemeListEdit): void => {
    execute(edit).catch(model.reportError);
  };
  const requestDelete = (theme: Theme): void => {
    deleteSelection(
      1,
      () =>
        model.reason === undefined &&
        model.file !== null &&
        theme.id !== model.file.standby.id &&
        !isBuiltInThemeId(theme.id),
      () => run({kind: 'delete', id: theme.id, confirmed: true}),
    );
  };
  const deleteAfterMenu = useMenuHandoff<Theme>(menu !== null, requestDelete);
  const full = userThemeCount(model.file?.themes ?? []) >= THEME_LIMITS.themes;
  const duplicateReason =
    model.reason ??
    (full ? limitReason('테마', THEME_LIMITS.themes) : undefined);
  const duplicateSelected = (): void => {
    if (model.theme === undefined) return;
    run({
      kind: 'duplicate',
      source: model.theme.id,
      id: createThemeId(crypto.randomUUID()),
    });
  };
  useWindowShortcuts([
    {
      id: 'edit.duplicate',
      when: event =>
        event.target instanceof Element &&
        event.target.closest('[role="listbox"][aria-label="테마"]') !== null &&
        model.theme !== undefined,
      unavailable: () => duplicateReason,
      run: () => {
        if (duplicateReason === undefined) duplicateSelected();
      },
    },
  ]);
  const target = menu?.theme;
  const regular = target !== undefined && target.id !== model.file?.standby.id;
  const available = menuAvailability(model.reason);
  const entries: readonly MenuEntry[] =
    target === undefined
      ? []
      : [
          ...(regular && !isSectionTheme(target.id)
            ? ([
                {
                  kind: 'item',
                  id: 'default',
                  label: '기본으로 지정',
                  ...available,
                  submenu: themeItemKinds.map(
                    itemKind =>
                      ({
                        kind: 'item',
                        id: itemKind,
                        label: themeKindNames[itemKind],
                        check: 'checkbox',
                        keepsOpen: true,
                        checked: model.file?.defaults[itemKind] === target.id,
                        ...available,
                        onSelect: () =>
                          run({kind: 'default', id: target.id, itemKind}),
                      }) as const,
                  ),
                },
                {kind: 'separator', id: 'default-separator'},
              ] as const)
            : []),
          {
            kind: 'item',
            id: 'duplicate',
            contextGroup: 'clipboard',
            label: '복제',
            ...menuAvailability(duplicateReason),
            onSelect: () =>
              run({
                kind: 'duplicate',
                source: target.id,
                id: createThemeId(crypto.randomUUID()),
              }),
          },
          {
            kind: 'item',
            id: 'rename',
            label: '이름 바꾸기',
            ...available,
            onSelect: () => renameAfterMenu(target),
          },
          {kind: 'separator', id: 'delete-separator'},
          {
            kind: 'item',
            id: 'delete',
            contextGroup: 'delete',
            label: '삭제',
            ...menuAvailability(
              model.reason ??
                (!regular || isBuiltInThemeId(target.id)
                  ? themeProblems['built-in']
                  : undefined),
            ),
            onSelect: () => {
              deleteAfterMenu(target);
              setMenu(null);
            },
          },
        ];
  const choices =
    model.file === null ? [] : [model.file.standby, ...model.file.themes];
  return (
    <>
      <Panel label="테마 목록" className={styles.themeList}>
        <PanelHeader>
          <PanelTitle title="테마" />
          <PanelActions>
            <IconButton
              icon="plus"
              label="새 테마"
              disabled={model.reason !== undefined || full}
              title={model.reason}
              onClick={() =>
                run({
                  kind: 'add',
                  id: createThemeId(crypto.randomUUID()),
                  screens: model.screens,
                })
              }
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
          canMove={theme =>
            model.reason === undefined && theme.id !== model.file?.standby.id
          }
          onMove={(id, before) => {
            const source = choices.find(theme => theme.id === id);
            const target =
              before === null
                ? null
                : choices.find(theme => theme.id === before);
            if (source && target !== undefined) {
              run({kind: 'move', id: source.id, before: target?.id ?? null});
            }
          }}
          onRename={theme => {
            if (model.reason === undefined) setRenaming(theme.id);
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
              {themeItemKinds
                .filter(kind => model.file?.defaults[kind] === theme.id)
                .map(kind => (
                  <span key={kind} className={styles.tag}>
                    {themeKindNames[kind]}
                  </span>
                ))}
            </span>
          )}
        />
      </Panel>
      {menu === null ? null : (
        <Menu
          context
          label="테마"
          anchor={menu.anchor}
          entries={entries}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
