import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {Label} from '@core/schema/labels';
import {isItemOfKind} from '@core/schema/service';
import {playedGroupIds, playedOrderWithLimit} from '@core/songs/itemOrder';
import {editedOrderWithLimit} from '@core/songs/songArrangements';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SongEditorAction} from '@renderer/features/songs/editor/songEditorStore';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {useLive} from '@renderer/session/live';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {USAGE_UNAVAILABLE, usageMeta} from '@renderer/ui/usageText';
import {countServiceItemUses} from '../serviceItemUsage';
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
} from '../../songs/editor/songItemModel';
import styles from './SongItemPanel.module.css';

export {NEWER_FILE_REASON};

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
  const customOrder =
    item !== null && isItemOfKind(item, 'song') ? item.customOrder : undefined;
  const own =
    customOrder === undefined ? undefined : {arrangement, customOrder};
  const sequence =
    own === undefined
      ? editedOrderWithLimit(song, arrangement)
      : playedOrderWithLimit(song, own);
  const groupOrder = sequence.capped
    ? []
    : own === undefined
      ? editedGroupOrder(song, arrangement)
      : playedGroupIds(song, own);
  const ranges = groupRangesFromGroups(song, groupOrder);
  const chips = groupedOrderChips(song, groupOrder, labels);
  const chipAt = (position: number | undefined): number | undefined =>
    chipIndexForSlide(position, ranges, sequence.slides.length);
  const [deleting, setDeleting] = useState<{
    readonly name: string;
    readonly uses: number | 'failed';
  } | null>(null);
  const lookup = useRef<AbortController | null>(null);
  useEffect(() => () => lookup.current?.abort(), []);
  const askToDelete = (name: string): void => {
    const api = window.llp;
    if (api === undefined) return;
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    countServiceItemUses(
      api,
      other =>
        isItemOfKind(other, 'song') &&
        other.song === session.document.song.id &&
        other.arrangement === name,
      controller.signal,
    )
      .then(uses => {
        if (!controller.signal.aborted) setDeleting({name, uses});
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error(
            'Could not look up where the arrangement is used',
            error,
          );
          setDeleting({name, uses: 'failed'});
        }
      });
  };
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
          orderChanged={customOrder !== undefined}
          createReason={sourceReason}
          manageReason={sourceReason}
          choose={name => editorTask(items.chooseArrangement(name))}
          create={() => onEditSong('create-arrangement')}
          rename={() => onEditSong('rename-arrangement')}
          remove={() => {
            if (arrangement !== undefined) askToDelete(arrangement);
          }}
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
      {deleting !== null ? (
        <AlertDialog
          icon="trash"
          title={`‘${deleting.name}’ 구성을 삭제할까요?`}
          meta={[
            ...(deleting.uses === 'failed'
              ? [USAGE_UNAVAILABLE]
              : usageMeta(deleting.uses, '예배 순서 항목')),
            '곡의 구성만 지우며, 쓰던 항목은 기본 구성으로 바뀝니다',
          ]}
          onCancel={() => setDeleting(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: arrangement !== deleting.name,
              title:
                arrangement !== deleting.name
                  ? '구성이 바뀌었습니다'
                  : undefined,
              onSelect: () => {
                setDeleting(null);
                onEditSong('delete-arrangement');
              },
            },
          ]}
        />
      ) : null}
      <ArrangementStrip
        label="구성 순서"
        mode="select"
        chips={chips}
        selected={chipAt(selected)}
        live={chipAt(live)}
        onSelect={index => {
          const position = ranges[index]?.start;
          if (position !== undefined) onSelect(position);
        }}
      />
    </div>
  );
}
