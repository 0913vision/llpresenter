import {useEffect, useRef, useState, type JSX} from 'react';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import type {Theme} from '@core/schema/themes';
import {THEME_LIMITS, themeItemKinds} from '@core/themes/elementRules';
import {editThemeList, type ThemeListEdit} from '@core/themes/themeEdits';
import {countServiceItemUses} from '@renderer/features/service/serviceItemUsage';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {Panel, PanelHeader, PanelTitle, PanelActions} from '@renderer/ui/Panel';
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
  const [confirm, setConfirm] = useState<Theme | null>(null);
  const [checking, setChecking] = useState(false);
  const lookup = useRef<AbortController | null>(null);
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
      lookup.current?.abort();
    };
  }, []);
  const renameAfterMenu = useMenuHandoff<Theme>(menu !== null, theme => {
    model.chooseTheme(theme.id);
    setRenaming(theme.id);
  });
  const execute = async (
    edit: ThemeListEdit,
    usedByItems: ReadonlySet<ThemeId> = new Set(),
  ): Promise<boolean> => {
    const unchanged = model.guardInteraction();
    const result = await model.change(
      file => editThemeList(file, edit, usedByItems),
      edit.kind === 'rename' ? 'saved' : 'applied',
    );
    if (!alive.current) return false;
    if (!result.ok) {
      if (result.error === 'confirmation-required' && edit.kind === 'delete') {
        setConfirm(
          model.file?.themes.find(theme => theme.id === edit.id) ?? null,
        );
      } else model.report(themeProblems[result.error]);
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
    if (checking || model.reason !== undefined || model.file === null) return;
    if (Object.values(model.file.defaults).includes(theme.id)) {
      setConfirm(theme);
      return;
    }
    const api = window.llp;
    if (api === undefined) return;
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setChecking(true);
    countServiceItemUses(
      api,
      item => item.theme === theme.id,
      controller.signal,
    )
      .then(async uses => {
        if (!alive.current || controller.signal.aborted) return;
        await execute(
          {kind: 'delete', id: theme.id},
          uses > 0 ? new Set([theme.id]) : new Set(),
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) model.reportError(error);
      })
      .finally(() => {
        if (alive.current) setChecking(false);
      });
  };
  const target = menu?.theme;
  const regular = target !== undefined && target.id !== model.file?.standby.id;
  const available = menuAvailability(model.reason);
  const entries: readonly MenuEntry[] =
    target === undefined
      ? []
      : [
          ...(regular
            ? ([
                {
                  kind: 'item',
                  id: 'default',
                  label: '기본으로 쓰기',
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
            label: '복제',
            ...menuAvailability(
              model.reason ??
                (model.file?.themes.length === THEME_LIMITS.themes
                  ? '테마는 200개까지 추가할 수 있음'
                  : undefined),
            ),
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
          ...(regular
            ? ([
                {kind: 'separator', id: 'delete-separator'},
                {
                  kind: 'item',
                  id: 'delete',
                  label: '삭제',
                  ...menuAvailability(
                    model.reason ??
                      (checking ? '사용 항목 확인 중' : undefined),
                  ),
                  onSelect: () => requestDelete(target),
                },
              ] as const)
            : []),
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
              disabled={
                model.reason !== undefined ||
                (model.file?.themes.length ?? 0) >= THEME_LIMITS.themes
              }
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
          label="테마"
          onSelect={id => {
            const theme = choices.find(value => value.id === id);
            if (theme !== undefined) model.chooseTheme(theme.id);
          }}
          onMenu={(theme, anchor) => setMenu({theme, anchor})}
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
          label="테마"
          anchor={menu.anchor}
          entries={entries}
          onClose={() => setMenu(null)}
        />
      )}
      {confirm === null ? null : (
        <AlertDialog
          icon="layers"
          title={`‘${confirm.name}’ 삭제`}
          meta={['사용 항목은 종류별 기본 테마로 표시됩니다.']}
          onCancel={() => setConfirm(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              onSelect: () => {
                run({kind: 'delete', id: confirm.id, confirmed: true});
                setConfirm(null);
              },
            },
          ]}
        />
      )}
    </>
  );
}
