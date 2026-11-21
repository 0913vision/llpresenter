import {useContext, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {ServiceItem} from '@core/schema/service';
import type {ThemeId} from '@core/schema/ids';
import type {ThemesFile} from '@core/schema/themes';
import {isItemOfKind} from '@core/schema/service';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {itemThemeKind} from '@core/themes/itemKind';
import {canChooseItemTheme} from '@core/themes/sectionThemeChoices';
import {missingSlideElements} from '@core/themes/slideElements';
import {themeElementNames} from '@renderer/rendering/themeNames';
import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {Button} from '@renderer/ui/Button';
import {Icon} from '@renderer/ui/Icon';
import {Tooltip} from '@renderer/ui/Tooltip';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {useItemSettings} from '../items/useItemSources';
import styles from '../items/ItemOverlays.module.css';

export function useItemTheme(
  api: LlpApi['settings'],
  item: ServiceItem | null,
  enabled = true,
) {
  const themes = useItemSettings(api, 'themes', enabled);
  const screens = useItemSettings(api, 'screens', enabled);
  const file =
    themes.document?.name === 'themes' ? themes.document.value : null;
  const targets =
    screens.document?.name === 'screens' ? screens.document.value.screens : [];
  const kind = item === null ? undefined : itemThemeKind(item);
  const inheritedTheme =
    item !== null && isItemOfKind(item, 'liturgy')
      ? CREED_PRAYER_THEME_ID
      : undefined;
  const theme =
    kind === undefined
      ? undefined
      : resolveItemTheme({
          file,
          kind,
          source: 'service',
          ...((item?.theme ?? inheritedTheme) === undefined
            ? {}
            : {theme: item?.theme ?? CREED_PRAYER_THEME_ID}),
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
      : resolveItemTheme({
          file,
          kind,
          source: 'external',
          screens: targets,
          ...(inheritedTheme === undefined ? {} : {theme: inheritedTheme}),
        });
  return {
    file,
    screensFile:
      screens.document?.name === 'screens' ? screens.document.value : undefined,
    screensLoaded: screens.document !== null,
    screensFailed: screens.failed,
    kind,
    theme,
    defaultTheme,
    targets,
    missing,
    missingContent:
      theme === undefined || item === null || !isItemOfKind(item, 'slides')
        ? []
        : missingSlideElements(item, theme, targets),
    loaded: themes.document !== null,
    failed: themes.failed,
    ready:
      (themes.document !== null || themes.failed) &&
      (screens.document !== null || screens.failed),
  };
}

export function EditItemTheme(): JSX.Element {
  const navigate = useContext(WorkspaceNavigation);
  return (
    <Button
      disabled={navigate === undefined}
      title={navigate === undefined ? '테마 편집을 열 수 없습니다' : undefined}
      onClick={() => navigate?.('screens')}
    >
      테마 편집
    </Button>
  );
}

export function OverlayWarning({
  missing,
}: {
  readonly missing: readonly string[];
}): JSX.Element | null {
  if (missing.length === 0) return null;
  const reason = `${missing.join(', ')} 화면에 오버레이 요소 없음`;
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
  themeData,
  setTheme,
}: {
  readonly setTheme?:
    | ((
        theme: ThemeId | undefined,
        file: ThemesFile | null,
      ) => Promise<boolean>)
    | undefined;
  readonly api: LlpApi['settings'];
  readonly items: ServiceItemStore;
  readonly item: ServiceItem;
  readonly reason: string | undefined;
  readonly themeData?: ReturnType<typeof useItemTheme>;
}): JSX.Element {
  const ownTheme = useItemTheme(api, item, themeData === undefined);
  const {file, kind, theme, defaultTheme, loaded, failed, missingContent} =
    themeData ?? ownTheme;
  const defaultId = isItemOfKind(item, 'liturgy')
    ? CREED_PRAYER_THEME_ID
    : kind === undefined
      ? undefined
      : file?.defaults[kind];
  const hasDefault =
    file?.themes.some(entry => entry.id === defaultId) === true;
  const defaultValue = hasDefault ? (defaultId ?? '') : '';
  const deleted = file?.deletedThemes?.find(entry => entry.id === item.theme);
  const hasSelected =
    deleted !== undefined ||
    file?.standby.id === item.theme ||
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
            valueText={
              deleted === undefined
                ? (theme?.name ?? '기본')
                : `(${deleted.name})`
            }
            options={[
              ...(hasDefault || defaultTheme === undefined
                ? []
                : [{value: '', label: defaultTheme.name, meta: '기본'}]),
              ...(file
                ? [{value: file.standby.id, label: file.standby.name}]
                : []),
              ...(deleted === undefined
                ? []
                : [
                    {
                      value: deleted.id,
                      label: `(${deleted.name})`,
                      disabled: true,
                      title: '삭제된 테마',
                    },
                  ]),
              ...(file?.themes ?? [])
                .filter(entry => canChooseItemTheme(item, entry.id))
                .map(entry => ({
                  value: entry.id,
                  label: entry.name,
                  meta: entry.id === defaultId ? '기본' : undefined,
                })),
            ]}
            disabled={lock !== undefined}
            title={lock}
            onChange={value => {
              if (value === '') {
                editorTask(
                  (setTheme ?? items.setTheme.bind(items))(undefined, file),
                );
                return;
              }
              const selected =
                file?.standby.id === value
                  ? file.standby
                  : file?.themes.find(entry => entry.id === value);
              if (selected !== undefined) {
                editorTask(
                  (setTheme ?? items.setTheme.bind(items))(
                    selected.id === defaultId ? undefined : selected.id,
                    file,
                  ),
                );
              }
            }}
          />
          <EditItemTheme />
          {missingContent.length === 0 ? null : (
            <Tooltip
              text={missingContent
                .map(
                  ({screen, kinds}) =>
                    `${screen.name}: ${kinds.map(kind => themeElementNames[kind]).join(', ')} 요소 없음`,
                )
                .join('\n')}
            >
              <span
                role="img"
                aria-label="테마에 필요한 요소 없음"
                tabIndex={0}
                className={styles.warning}
              >
                <Icon name="warning" size={14} />
              </span>
            </Tooltip>
          )}
        </div>
      )}
    </PropertyRow>
  );
}
