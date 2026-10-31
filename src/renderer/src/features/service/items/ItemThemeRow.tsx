import {useContext, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceItem} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import {themeItemKinds} from '@core/themes/elementRules';
import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {Button} from '@renderer/ui/Button';
import {Icon} from '@renderer/ui/Icon';
import {Tooltip} from '@renderer/ui/Tooltip';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {ServiceItemStore} from './serviceItemStore';
import {useItemSettings} from './useItemSources';
import styles from './ItemOverlays.module.css';

export function useItemTheme(
  api: LlpApi['settings'],
  item: ServiceItem | null,
) {
  const themes = useItemSettings(api, 'themes');
  const screens = useItemSettings(api, 'screens');
  const file =
    themes.document?.name === 'themes' ? themes.document.value : null;
  const targets =
    screens.document?.name === 'screens' ? screens.document.value.screens : [];
  const kind =
    item === null
      ? undefined
      : themeItemKinds.find(kind => isItemOfKind(item, kind));
  const theme =
    kind === undefined
      ? undefined
      : resolveItemTheme({
          file,
          kind,
          source: 'service',
          ...(item?.theme === undefined ? {} : {theme: item.theme}),
          screens: targets,
        });
  const missing =
    theme === undefined || themes.document === null || screens.document === null
      ? []
      : [...new Set(item?.overlays?.flatMap(overlay => overlay.screens) ?? [])]
          .filter(
            id =>
              !resolveThemeScreen(theme, id, targets).layout.elements.some(
                element => element.kind === 'overlay',
              ),
          )
          .map(
            id =>
              targets.find(screen => screen.id === id)?.name ?? '삭제된 화면',
          );
  const defaultTheme =
    kind === undefined
      ? undefined
      : resolveItemTheme({file, kind, source: 'external', screens: targets});
  return {
    file,
    kind,
    theme,
    defaultTheme,
    targets,
    missing,
    loaded: themes.document !== null,
    failed: themes.failed,
  };
}

export function EditItemTheme(): JSX.Element {
  const navigate = useContext(WorkspaceNavigation);
  return (
    <Button
      disabled={navigate === undefined}
      title={
        navigate === undefined ? '테마 작업 공간을 열 수 없습니다' : undefined
      }
      onClick={() => navigate?.('screens')}
    >
      테마 편집…
    </Button>
  );
}

export function OverlayWarning({
  missing,
}: {
  readonly missing: readonly string[];
}): JSX.Element | null {
  if (missing.length === 0) return null;
  const reason = `오버레이 요소가 없는 화면: ${missing.join(', ')}`;
  return (
    <>
      <Tooltip text={reason}>
        <span
          role="img"
          aria-label={reason}
          tabIndex={0}
          className={styles.warning}
        >
          <Icon name="warning" size={14} />
        </span>
      </Tooltip>
      <EditItemTheme />
    </>
  );
}

export function ItemThemeRow({
  api,
  items,
  item,
  reason,
}: {
  readonly api: LlpApi['settings'];
  readonly items: ServiceItemStore;
  readonly item: ServiceItem;
  readonly reason: string | undefined;
}): JSX.Element {
  const {file, kind, theme, defaultTheme, loaded, failed} = useItemTheme(
    api,
    item,
  );
  const defaultId = kind === undefined ? undefined : file?.defaults[kind];
  const hasDefault =
    file?.themes.some(entry => entry.id === defaultId) === true;
  const defaultValue = hasDefault ? (defaultId ?? '') : '';
  const hasSelected =
    file?.themes.some(entry => entry.id === item.theme) === true;
  const lock =
    reason ??
    (!loaded
      ? failed
        ? '테마 불러오기 실패'
        : '테마 불러오는 중'
      : undefined);
  return (
    <PropertyRow label="테마">
      {({controlId}) => (
        <div className={`${styles.controls} ${styles.theme}`}>
          <SelectMenu
            id={controlId}
            block
            menuLabel="항목 테마"
            value={hasSelected ? (item.theme ?? defaultValue) : defaultValue}
            valueText={theme?.name ?? '기본'}
            options={[
              ...(hasDefault || defaultTheme === undefined
                ? []
                : [{value: '', label: defaultTheme.name, meta: '기본'}]),
              ...(file?.themes ?? []).map(entry => ({
                value: entry.id,
                label: entry.name,
                meta: entry.id === defaultId ? '기본' : undefined,
              })),
            ]}
            disabled={lock !== undefined}
            title={lock}
            onChange={value => {
              if (value === '') {
                editorTask(items.setTheme(undefined));
                return;
              }
              const selected = file?.themes.find(entry => entry.id === value);
              if (selected !== undefined) {
                editorTask(
                  items.setTheme(
                    selected.id === defaultId ? undefined : selected.id,
                  ),
                );
              }
            }}
          />
          <EditItemTheme />
        </div>
      )}
    </PropertyRow>
  );
}
