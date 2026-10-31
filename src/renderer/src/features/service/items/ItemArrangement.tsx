import {useSyncExternalStore, type JSX} from 'react';
import type {Label} from '@core/schema/labels';
import {isGroupedSong} from '@core/schema/groupedSong';
import {isItemOfKind} from '@core/schema/service';
import {editedOrderWithLimit} from '@core/songs/songArrangements';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SongEditorAction} from '@renderer/features/songs/editor/songEditorStore';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {useLive} from '@renderer/session/live';
import {ArrangementStrip} from '@renderer/ui/LabelChip';
import {ArrangementPicker} from '../../songs/editor/ArrangementPicker';
import {Icon} from '@renderer/ui/Icon';
import {Tooltip} from '@renderer/ui/Tooltip';
import type {ServiceItemStore} from './serviceItemStore';
import {
  chipIndexForSlide,
  editedGroupOrder,
  groupRangesFromGroups,
  groupedOrderChips,
  legacyOrderChips,
} from '../../songs/editor/songItemModel';
import styles from './SongItemPanel.module.css';

export const NEWER_FILE_REASON = '새 버전의 파일이라 바꿀 수 없습니다';

export interface ItemArrangementProps {
  readonly items: ServiceItemStore;
  readonly session: SongSession;
  readonly itemId: string;
  readonly labels: readonly Label[];
  readonly selected: number | undefined;
  readonly onSelect: (index: number) => void;
  readonly onEditSong: (action: SongEditorAction) => void;
}

/** Only the arrangement choice changes the item; source edits open the song editor. */
export function ItemArrangement({
  items,
  session,
  itemId,
  labels,
  selected,
  onSelect,
  onEditSong,
}: ItemArrangementProps): JSX.Element {
  const {busy, service, arrangement, item} = useSyncExternalStore(
    items.subscribe,
    items.getSnapshot,
  );
  const live = useLive(view => {
    const slide = view.state?.layers.slide;
    return slide?.itemId === itemId ? slide.position : undefined;
  });
  const {song} = session.history.snapshot;
  const sequence = editedOrderWithLimit(song, arrangement);
  const grouped = isGroupedSong(song);
  const groupOrder =
    grouped && !sequence.capped ? editedGroupOrder(song, arrangement) : [];
  const ranges = grouped ? groupRangesFromGroups(song, groupOrder) : [];
  const chips = grouped
    ? groupedOrderChips(song, groupOrder, labels)
    : legacyOrderChips(song, sequence.slides, labels);
  const chipAt = (position: number | undefined): number | undefined =>
    grouped
      ? chipIndexForSlide(position, ranges, sequence.slides.length)
      : position;
  const serviceReason =
    service?.access === 'readOnly' ? NEWER_FILE_REASON : undefined;
  const sourceReason = session.readOnly ? NEWER_FILE_REASON : undefined;
  const requested =
    item !== null && isItemOfKind(item, 'song') ? item.arrangement : undefined;
  const missingReason =
    requested !== undefined && arrangement === undefined
      ? `‘${requested}’ 구성이 없어 기본 구성을 사용합니다`
      : undefined;
  return (
    <div className={styles.arrangement}>
      <div className={styles.choice}>
        <span className={styles.choiceLabel}>구성</span>
        <ArrangementPicker
          names={song.arrangements?.map(value => value.name) ?? []}
          selected={arrangement}
          disabled={busy || serviceReason !== undefined}
          title={serviceReason ?? missingReason}
          description={missingReason}
          createReason={sourceReason}
          manageReason={sourceReason}
          choose={name => editorTask(items.chooseArrangement(name))}
          create={() => onEditSong('create-arrangement')}
          rename={() => onEditSong('rename-arrangement')}
          remove={() => onEditSong('delete-arrangement')}
          edit={() => onEditSong('edit-arrangement')}
        />
        {missingReason === undefined ? null : (
          <Tooltip text={missingReason}>
            <span
              role="img"
              aria-label={missingReason}
              className={styles.warning}
            >
              <Icon name="warning" size={14} />
            </span>
          </Tooltip>
        )}
      </div>
      <ArrangementStrip
        label="구성 순서"
        mode="select"
        chips={chips}
        selected={chipAt(selected)}
        live={chipAt(live)}
        onSelect={index => {
          const position = grouped ? ranges[index]?.start : index;
          if (position !== undefined) onSelect(position);
        }}
      />
    </div>
  );
}
