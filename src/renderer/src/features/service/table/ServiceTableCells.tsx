import type {JSX} from 'react';
import type {ItemRow} from '@core/presentation/model';
import type {MediaId, SongId, ThemeId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import {isStartItem} from '@core/services/itemFieldChanges';
import {ORDER_CHANGED_LABEL} from '@core/songs/itemOrder';
import type {ThemesFile} from '@core/schema/themes';
import {itemThemeCell} from '@core/themes/itemThemeCell';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {classNames} from '@renderer/ui/classNames';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {NEWER_FILE_REASON} from '../items/ItemArrangement';
import {themeRequest} from '../items/itemAppearanceCommands';
import {
  arrangementRequest,
  backgroundRequest,
  memoRequest,
  startMacroRequest,
} from '../items/itemPlaybackCommands';
import {resolveMacro} from '../items/ItemSettingsRows';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {BackgroundCell} from './BackgroundCell';
import {CellMenu} from './CellMenu';
import {MemoCell} from './MemoCell';
import type {SongFacts} from './useServiceTableData';
import styles from './ServiceTable.module.css';

const NONE = '없음';
const DEFAULT_ARRANGEMENT = '기본';
const DEFAULT_THEME = '기본';
const MISSING_MACRO = '매크로 없음';
const NO_MACRO_ID = 'none';
const DEFAULT_THEME_ID = 'default';

type Macro = ReturnType<typeof resolveMacro>;

/** What the cells of one item row read and write. */
export interface ServiceTableCellsProps {
  readonly row: ItemRow;
  readonly item: ServiceItem | undefined;
  /** The 슬라이드 count of the item, or its duration for media. */
  readonly detail: string | undefined;
  readonly themes: ThemesFile | null;
  readonly macros: ReadonlyArray<NonNullable<Macro>>;
  readonly media: readonly MediaItem[];
  readonly songs: ReadonlyMap<SongId, SongFacts>;
  readonly items: Pick<ServiceItemStore, 'submitItemEdit'>;
  readonly serviceId: string | null;
  readonly readOnly: boolean;
}

function themeEntries({
  item,
  followsDefault,
  themes,
  choose,
}: {
  readonly item: ServiceItem;
  readonly followsDefault: boolean;
  readonly themes: ThemesFile | null;
  readonly choose: (theme: ThemeId | undefined) => void;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: DEFAULT_THEME_ID,
      label: DEFAULT_THEME,
      check: 'radio',
      checked: followsDefault,
      onSelect: () => choose(undefined),
    },
    ...(themes?.themes ?? []).map((theme): MenuEntry => ({
      kind: 'item',
      id: theme.id,
      label: theme.name,
      check: 'radio',
      checked: !followsDefault && item.theme === theme.id,
      onSelect: () => choose(theme.id),
    })),
  ];
}

function arrangementEntries({
  current,
  names,
  choose,
}: {
  readonly current: string | undefined;
  readonly names: readonly string[];
  readonly choose: (name: string | undefined) => void;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'default',
      label: DEFAULT_ARRANGEMENT,
      check: 'radio',
      checked: current === undefined,
      onSelect: () => choose(undefined),
    },
    ...names.map((name): MenuEntry => ({
      kind: 'item',
      id: `arrangement:${name}`,
      label: name,
      check: 'radio',
      checked: current === name,
      onSelect: () => choose(name),
    })),
  ];
}

function macroEntries({
  current,
  macros,
  choose,
}: {
  readonly current: Macro;
  readonly macros: ServiceTableCellsProps['macros'];
  readonly choose: (macroId: string | undefined) => void;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: NO_MACRO_ID,
      label: NONE,
      check: 'radio',
      checked: current === undefined,
      onSelect: () => choose(undefined),
    },
    ...macros.map((macro): MenuEntry => ({
      kind: 'item',
      id: macro.id,
      label: macro.name,
      check: 'radio',
      checked: current?.id === macro.id,
      onSelect: () => choose(macro.id),
    })),
  ];
}

/** The 구성, 슬라이드, 테마, 배경, 시작할 때, and 메모 cells of an item row. */
export function ServiceTableCells({
  row,
  item,
  detail,
  themes,
  macros,
  media,
  songs,
  items,
  serviceId,
  readOnly,
}: ServiceTableCellsProps): JSX.Element {
  const target = serviceId === null ? null : {serviceId, itemId: row.id};
  const song = item !== undefined && 'song' in item ? item : undefined;
  const themeCell =
    item === undefined ? undefined : itemThemeCell(item, themes);
  const macro =
    item !== undefined && isStartItem(item)
      ? resolveMacro(macros, item.macro)
      : undefined;
  const reason = readOnly ? NEWER_FILE_REASON : undefined;
  return (
    <span className={styles.grid}>
      {song === undefined ? (
        <span className={classNames(styles.cell, styles.arrangement)} />
      ) : (
        <CellMenu
          label={`구성, ${row.title}`}
          text={song.arrangement ?? DEFAULT_ARRANGEMENT}
          dim={false}
          width={styles.arrangement}
          reason={reason}
          mark={
            song.customOrder === undefined ? undefined : ORDER_CHANGED_LABEL
          }
          entries={arrangementEntries({
            current: song.arrangement,
            names: songs.get(song.song)?.arrangements ?? [],
            choose: name =>
              editorTask(
                items.submitItemEdit(arrangementRequest(target, name)),
              ),
          })}
        />
      )}
      <span className={classNames(styles.cell, styles.slides)}>
        {item !== undefined && isItemOfKind(item, 'slides')
          ? item.slides.slides.length
          : (detail ?? '')}
      </span>
      {item === undefined || themeCell === undefined ? (
        <span className={classNames(styles.cell, styles.theme)} />
      ) : (
        <CellMenu
          label={`테마, ${row.title}`}
          text={themeCell.name}
          dim={themeCell.followsDefault}
          width={styles.theme}
          reason={reason}
          entries={themeEntries({
            item,
            followsDefault: themeCell.followsDefault,
            themes,
            choose: theme =>
              editorTask(items.submitItemEdit(themeRequest(target, theme))),
          })}
        />
      )}
      <BackgroundCell
        row={row}
        item={item}
        media={media}
        songBackground={
          song === undefined ? undefined : songs.get(song.song)?.background
        }
        reason={reason}
        choose={
          song === undefined &&
          !(item !== undefined && isItemOfKind(item, 'slides'))
            ? undefined
            : (mediaId: MediaId | null) =>
                editorTask(
                  items.submitItemEdit(backgroundRequest(target, mediaId)),
                )
        }
      />
      {item === undefined || !isStartItem(item) ? (
        <span className={classNames(styles.cell, styles.start)} />
      ) : (
        <CellMenu
          label={`시작할 때, ${row.title}`}
          text={macro?.name ?? (item.macro === undefined ? '' : MISSING_MACRO)}
          dim={macro === undefined}
          width={styles.start}
          reason={reason}
          entries={macroEntries({
            current: macro,
            macros,
            choose: macroId =>
              editorTask(
                items.submitItemEdit(startMacroRequest(target, macroId)),
              ),
          })}
        />
      )}
      {item === undefined || !isStartItem(item) ? (
        <span className={classNames(styles.cell, styles.memo)} />
      ) : (
        <MemoCell
          label={`메모, ${row.title}`}
          key={item.memo ?? ''}
          memo={item.memo ?? ''}
          reason={reason}
          save={memo => items.submitItemEdit(memoRequest(target, memo))}
        />
      )}
    </span>
  );
}
