import type {JSX} from 'react';
import type {ItemRow} from '@core/presentation/model';
import type {MediaId, SongId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import {isItemOfKind} from '@core/schema/service';
import {isStartItem} from '@core/services/itemFieldChanges';
import type {ThemesFile} from '@core/schema/themes';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {classNames} from '@renderer/ui/classNames';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  backgroundRequest,
  memoRequest,
  startMacroRequest,
} from '../items/itemPlaybackCommands';
import {resolveMacro} from '../items/ItemSettingsRows';
import type {ServiceItemStore} from '../items/serviceItemStore';
import {ThemeCell} from './ThemeCell';
import {BackgroundCell} from './BackgroundCell';
import {CellMenu} from './CellMenu';
import {MemoCell} from './MemoCell';
import type {SongFacts} from './useServiceTableData';
import styles from './ServiceTable.module.css';

const NONE = '없음';
const MISSING_MACRO = '매크로 없음';
const NO_MACRO_ID = 'none';

type Macro = ReturnType<typeof resolveMacro>;

/** What the cells of one item row read and write. */
export interface ServiceTableCellsProps {
  readonly row: ItemRow;
  readonly rowLabel?: string;
  readonly item: ServiceItem | undefined;
  /** The 슬라이드 count of the item; media has none, its length shows on its tile. */
  readonly detail: string | undefined;
  readonly themes: ThemesFile | null;
  readonly macros: ReadonlyArray<NonNullable<Macro>>;
  readonly media: readonly MediaItem[];
  readonly songs: ReadonlyMap<SongId, SongFacts>;
  readonly items: Pick<ServiceItemStore, 'submitItemEdit'>;
  readonly serviceId: string | null;
  readonly readOnly: boolean;
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
  rowLabel = row.title,
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
  const macro =
    item !== undefined && isStartItem(item)
      ? resolveMacro(macros, item.macro)
      : undefined;
  const reason = readOnly ? NEWER_FILE_REASON : undefined;
  return (
    <span className={styles.grid}>
      <span className={classNames(styles.cell, styles.slides)}>
        {item !== undefined && isItemOfKind(item, 'slides')
          ? item.slides.slides.length
          : row.kind === 'media'
            ? ''
            : (detail ?? '')}
      </span>
      {item === undefined ? (
        <span className={classNames(styles.cell, styles.theme)} />
      ) : (
        <ThemeCell
          item={item}
          themes={themes}
          target={target}
          items={items}
          label={`테마, ${rowLabel}`}
          reason={reason}
        />
      )}
      <BackgroundCell
        row={row}
        rowLabel={rowLabel}
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
          label={`시작할 때, ${rowLabel}`}
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
          key={`${serviceId}:${item.id}`}
          label={`메모, ${rowLabel}`}
          memo={item.memo ?? ''}
          reason={reason}
          save={memo => items.submitItemEdit(memoRequest(target, memo))}
        />
      )}
    </span>
  );
}
