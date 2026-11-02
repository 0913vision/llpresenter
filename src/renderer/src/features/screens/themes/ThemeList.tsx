import {limitReason} from '@core/common/limitReason';
import {useEffect, useRef, useState, type JSX} from 'react';
import {createThemeId, type ThemeId} from '@core/schema/ids';
import type {Theme, ThemesFile} from '@core/schema/themes';
import {THEME_LIMITS, themeItemKinds} from '@core/themes/elementRules';
import {editThemeList, type ThemeListEdit} from '@core/themes/themeEdits';
import {countServiceItemUses} from '@renderer/features/service/serviceItemUsage';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {countedMeta} from '@renderer/ui/countedMeta';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';
import {Panel, PanelHeader, PanelTitle, PanelActions} from '@renderer/ui/Panel';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {
  USAGE_LABEL,
  USAGE_LOADING,
  USAGE_UNAVAILABLE,
  usageMeta,
} from '@renderer/ui/usageText';
import {ChoiceRows} from '../ChoiceRows';
import {themeKindNames, themeProblems} from './themeNames';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

/** Where a 테마 is used, for the question before it is deleted. */
function usedMeta(
  theme: Theme,
  uses: number | 'failed',
  file: ThemesFile | null,
): readonly string[] {
  const kinds = themeItemKinds.filter(
    kind => file?.defaults[kind] === theme.id,
  );
  const lines = [
    ...(uses === 'failed'
      ? [USAGE_UNAVAILABLE]
      : usageMeta(uses, '예배 순서 항목')),
    ...countedMeta(
      kinds.length,
      `${USAGE_LABEL}: ${kinds.map(kind => themeKindNames[kind]).join(', ')} 기본`,
    ),
  ];
  return lines.length === 0
    ? lines
    : [...lines, '쓰는 곳은 종류별 기본 테마로 표시됩니다.'];
}

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
  const [confirm, setConfirm] = useState<{
    readonly theme: Theme;
    readonly uses: number | 'failed';
  } | null>(null);
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
    if (checking || model.reason !== undefined || model.file === null) return;
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
      .then(uses => {
        if (!alive.current || controller.signal.aborted) return;
        setConfirm({theme, uses});
      })
      .catch((error: unknown) => {
        if (!alive.current || controller.signal.aborted) return;
        console.error('Could not look up where the theme is used', error);
        setConfirm({theme, uses: 'failed'});
      })
      .finally(() => {
        if (alive.current) setChecking(false);
      });
  };
  const duplicateReason =
    model.reason ??
    (model.file?.themes.length === THEME_LIMITS.themes
      ? limitReason('테마', THEME_LIMITS.themes)
      : undefined);
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
          ...(regular
            ? ([
                {kind: 'separator', id: 'delete-separator'},
                {
                  kind: 'item',
                  id: 'delete',
                  label: '삭제',
                  ...menuAvailability(
                    model.reason ?? (checking ? USAGE_LOADING : undefined),
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
          modified={
            new Set(model.dirtyThemeId === null ? [] : [model.dirtyThemeId])
          }
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
          title={`‘${confirm.theme.name}’ 테마를 삭제할까요?`}
          meta={usedMeta(confirm.theme, confirm.uses, model.file)}
          onCancel={() => setConfirm(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              onSelect: () => {
                run({kind: 'delete', id: confirm.theme.id, confirmed: true});
                setConfirm(null);
              },
            },
          ]}
        />
      )}
    </>
  );
}
