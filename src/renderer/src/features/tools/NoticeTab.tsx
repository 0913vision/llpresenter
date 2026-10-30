import {useRef, useState, type JSX} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {IconButton, SelectMenu} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {NoticeCreateDialog} from './NoticeCreateDialog';
import {NoticePlayback} from './NoticePlayback';
import {NoticeSettings} from './NoticeSettings';
import {NoticeEditing} from './NoticeEditing';
import {MAX_NOTICE_SETS, saveNoticeEdit, type NoticeEdit} from './noticeEdits';
import {useNoticeMedia} from './useNoticeMedia';
import {useToolEditing} from './useToolEditing';
import styles from './NoticeTab.module.css';

export function NoticeTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('notices', '공지', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const media = useNoticeMedia(onProblem);
  const [selectedId, setSelectedId] = useState<string>();
  const [adding, setAdding] = useState(false);
  const selectionRevision = useRef(0);
  const {busy, run} = useToolEditing({
    api: window.llp,
    write: saveNoticeEdit,
    onProblem,
    area: {key: 'notice', label: '공지', log: 'Could not edit notices'},
  });
  const selected =
    document?.value.sets.find(item => item.id === selectedId) ??
    document?.value.sets[0];
  const current =
    selected && screens
      ? {
          ...selected,
          targets: selected.targets.filter(id =>
            screens.value.screens.some(screen => screen.id === id),
          ),
        }
      : selected;
  const locked = busy || document?.access !== 'editable' || !screens || !media;
  const add = (edit: NoticeEdit): void => {
    const revision = selectionRevision.current;
    run(edit).then(
      saved => {
        if (!saved || revision !== selectionRevision.current) return;
        setAdding(false);
        if (edit.kind === 'add') setSelectedId(edit.item.id);
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Notice edit callback failed',
          detail: String(cause),
        }),
    );
  };
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.selector}>
          <NoticeEditing item={current} locked={locked} save={run}>
            <SelectMenu
              aria-label="공지 세트"
              block
              value={selected?.id}
              disabled={!document?.value.sets.length}
              options={
                document?.value.sets.map(item => ({
                  value: item.id,
                  label: item.name,
                })) ?? []
              }
              onChange={id => {
                selectionRevision.current++;
                setSelectedId(id);
              }}
            />
          </NoticeEditing>
        </div>
        <IconButton
          icon="plus"
          label="공지 추가"
          disabled={locked || document.value.sets.length >= MAX_NOTICE_SETS}
          onClick={() => {
            selectionRevision.current++;
            setAdding(true);
          }}
        />
      </div>
      {current ? (
        <>
          <NoticeSettings
            key={current.id}
            item={current}
            screens={screens?.value.screens ?? []}
            locked={locked}
            save={changes => run({kind: 'update', id: current.id, changes})}
          >
            <NoticePlayback item={current} media={media?.value.items ?? []} />
          </NoticeSettings>
        </>
      ) : null}
      {adding && media ? (
        <NoticeCreateDialog
          media={media.value}
          screens={screens?.value.screens ?? []}
          locked={locked}
          onCancel={() => {
            selectionRevision.current++;
            setAdding(false);
          }}
          onSave={item => add({kind: 'add', item})}
        />
      ) : null}
    </div>
  );
}
