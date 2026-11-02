import {useState, type JSX} from 'react';
import type {GroupedSong} from '@core/schema/groupedSong';
import type {SongGroupId} from '@core/schema/ids';
import type {Label} from '@core/schema/labels';
import type {SongEditorWindowAction} from '@core/schema/ipcPayloads';
import {ArrangementPicker} from '@renderer/features/songs/editor/ArrangementPicker';
import {NewArrangementDialog} from '@renderer/features/songs/editor/NewArrangementDialog';
import {
  groupedOrderChips,
  movedOrder,
  withoutPosition,
} from '@renderer/features/songs/editor/songItemModel';
import {useChipDrag} from '@renderer/features/songs/editor/useChipDrag';
import {Button} from '@renderer/ui/Button';
import {ArrangementStrip} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {groupChoices} from './orderEditorModel';
import type {OrderEdits} from './useOrderEdits';
import styles from './OrderEditor.module.css';

const STRIP_ADD_LABEL = '이름표 넣기';

export interface OrderRowsProps {
  readonly song: GroupedSong;
  readonly labels: readonly Label[];
  readonly order: readonly SongGroupId[];
  /** The 구성 the order started from; undefined for 기본. */
  readonly arrangement: string | undefined;
  /** Whether the item plays its own order, which the 구성 only started. */
  readonly orderChanged: boolean;
  readonly selected: number | undefined;
  readonly onSelect: (chip: number) => void;
  readonly edits: OrderEdits;
  readonly locked: boolean;
  /** Why nothing can change, such as a file of a newer version. */
  readonly lockedReason: string | undefined;
  readonly onEditSong: (action: SongEditorWindowAction) => void;
}

function addEntries(
  song: GroupedSong,
  labels: readonly Label[],
  add: (id: SongGroupId) => void,
): readonly MenuEntry[] {
  return song.groups.map((group, index) => ({
    kind: 'item',
    id: group.id,
    label: group.name === '' ? `이름표 없음 ${index + 1}` : group.name,
    swatch: labels.find(label => label.name === group.name)?.color ?? 'none',
    onSelect: () => add(group.id),
  }));
}

/** The 이름표 row, the 순서 row, the 구성 picker, and 구성으로 저장…. */
export function OrderRows({
  song,
  labels,
  order,
  arrangement,
  orderChanged,
  selected,
  onSelect,
  edits,
  locked,
  lockedReason,
  onEditSong,
}: OrderRowsProps): JSX.Element {
  const [insertAnchor, setInsertAnchor] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const add = (id: SongGroupId): void => {
    edits.setOrder([...order, id]).catch(logFailure);
  };
  const drag = useChipDrag({
    enabled: !locked,
    onMove: (from, to) => {
      edits.setOrder(movedOrder(order, from, to)).catch(logFailure);
    },
  });
  const choices = groupChoices(song, labels);
  return (
    <div className={styles.rows}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>이름표</span>
        <div className={styles.strip}>
          <ArrangementStrip
            mode="select"
            label="이름표"
            chips={choices}
            selected={undefined}
            readOnlyReason={lockedReason}
            onSelect={index => {
              const group = song.groups[index];
              if (group !== undefined && !locked) add(group.id);
            }}
          />
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>순서</span>
        <div className={styles.strip} {...drag.stripProps}>
          <ArrangementStrip
            label="순서"
            chips={groupedOrderChips(song, order, labels)}
            selected={selected}
            readOnlyReason={lockedReason}
            insertLabel={STRIP_ADD_LABEL}
            onSelect={onSelect}
            onMove={(from, to) => {
              edits.setOrder(movedOrder(order, from, to)).catch(logFailure);
            }}
            onRemove={index => {
              edits.setOrder(withoutPosition(order, index)).catch(logFailure);
            }}
            onInsert={setInsertAnchor}
            dropIndex={drag.dropIndex}
            draggingIndex={drag.draggingIndex}
          />
        </div>
        <ArrangementPicker
          names={song.arrangements?.map(entry => entry.name) ?? []}
          selected={arrangement}
          orderChanged={orderChanged}
          disabled={locked}
          title={lockedReason}
          createReason={lockedReason}
          manageReason={lockedReason}
          choose={name => {
            edits.pickArrangement(name).catch(logFailure);
          }}
          create={() => onEditSong('create-arrangement')}
          rename={() => onEditSong('rename-arrangement')}
          remove={() => onEditSong('delete-arrangement')}
          edit={() => onEditSong('edit-arrangement')}
        />
        <Button
          disabled={locked}
          title={lockedReason}
          onClick={() => setSaving(true)}
        >
          구성으로 저장…
        </Button>
      </div>
      {insertAnchor !== null && !locked ? (
        <Menu
          label={STRIP_ADD_LABEL}
          anchor={{kind: 'element', element: insertAnchor}}
          entries={addEntries(song, labels, add)}
          onClose={() => setInsertAnchor(null)}
        />
      ) : null}
      {saving ? (
        <NewArrangementDialog
          names={song.arrangements?.map(entry => entry.name) ?? []}
          locked={locked}
          create={name => edits.saveAsArrangement(name, order)}
          onClose={() => setSaving(false)}
        />
      ) : null}
    </div>
  );
}

function logFailure(error: unknown): void {
  console.error('Could not change the order', error);
}
