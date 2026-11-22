import type {JSX} from 'react';
import type {ItemRow} from '@core/presentation/model';
import {hasSlides, type ServiceItem} from '@core/schema/service';
import {withMemo, withStartMacro} from '@core/services/itemFields';
import {runEdit, type Report} from '@renderer/session/serviceEdit';
import {editItem} from '@renderer/session/openService';
import {classNames} from '@renderer/ui/classNames';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {resolveMacro, type Macro} from '../details/ItemSettingsRows';
import {CellMenu} from './CellMenu';
import {MemoCell} from './MemoCell';
import styles from './ServiceTable.module.css';

const NONE = '없음';
const MISSING_MACRO = '매크로 없음';
const NO_MACRO_ID = 'none';

function macroEntries({
  current,
  macros,
  choose,
}: {
  readonly current: Macro | undefined;
  readonly macros: readonly Macro[];
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

/** The 슬라이드, 시작할 때, and 메모 cells of an item row. */
export function ServiceTableCells({
  row,
  rowLabel = row.title,
  item,
  macros,
  readOnly,
  report,
}: {
  readonly row: ItemRow;
  readonly rowLabel?: string;
  readonly item: ServiceItem | undefined;
  readonly macros: readonly Macro[];
  readonly readOnly: boolean;
  readonly report: Report;
}): JSX.Element {
  const own = item !== undefined && hasSlides(item) ? item : undefined;
  const reason = readOnly ? NEWER_FILE_REASON : undefined;
  const macro = resolveMacro(macros, own?.macro);
  return (
    <span className={styles.grid}>
      <span className={classNames(styles.cell, styles.slides)}>
        {own === undefined || own.kind === 'media' ? '' : own.slides.length}
      </span>
      {own === undefined ? (
        <>
          <span className={styles.cell} />
          <span className={classNames(styles.cell, styles.memo)} />
        </>
      ) : (
        <>
          <CellMenu
            label={`시작할 때, ${rowLabel}`}
            text={macro?.name ?? (own.macro === undefined ? '' : MISSING_MACRO)}
            dim={macro === undefined}
            reason={reason}
            entries={macroEntries({
              current: macro,
              macros,
              choose: id =>
                runEdit(
                  editItem(own.id, entry => withStartMacro(entry, id)),
                  report,
                ),
            })}
          />
          <MemoCell
            key={own.id}
            label={`메모, ${rowLabel}`}
            memo={own.memo ?? ''}
            reason={reason}
            save={async memo => {
              const result = await editItem(own.id, entry =>
                withMemo(entry, memo),
              );
              return result.ok || result.error.reason === 'write-failed';
            }}
          />
        </>
      )}
    </span>
  );
}
