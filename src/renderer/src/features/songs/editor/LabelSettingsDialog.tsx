import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {Dialog} from '@renderer/ui/Dialog';
import {IconButton} from '@renderer/ui/IconButton';
import {LabelColorPicker} from '@renderer/ui/LabelColorPicker';
import {LabelDeleteDialog} from './LabelDeleteDialog';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import styles from './LabelMenu.module.css';

export function LabelSettingsDialog({
  store,
  onClose,
}: {
  readonly store: SongEditorStore;
  readonly onClose: () => void;
}): JSX.Element {
  const {labels: document, busy} = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const labels = document?.value.labels ?? [];
  const locked = busy || document?.access !== 'editable';
  const [deleting, setDeleting] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (deleting === null) {
      body.current
        ?.closest('[role="dialog"]')
        ?.querySelector<HTMLElement>('[data-modal-primary]')
        ?.focus();
    }
  }, [deleting]);
  return (
    <>
      <Dialog
        title="이름표 설정"
        size="m"
        onCancel={onClose}
        cancelLabel="닫기"
        primary={{label: '확인', onSelect: onClose}}
      >
        <div ref={body} className={styles.settings}>
          {labels.map(label => (
            <div
              key={label.name}
              role="group"
              aria-label={label.name}
              className={styles.settingsRow}
            >
              <span className={styles.name}>{label.name}</span>
              <fieldset disabled={locked} className={styles.colors}>
                <LabelColorPicker
                  label={`${label.name} 색`}
                  name={`${label.name} 색`}
                  scope="모든 곡에 적용"
                  value={label.color}
                  disabled={locked}
                  onChange={color =>
                    editorTask(
                      store.updateLabels(
                        labels.map(item =>
                          item.name === label.name ? {...item, color} : item,
                        ),
                      ),
                    )
                  }
                />
              </fieldset>
              <IconButton
                icon="trash"
                label={`${label.name} 삭제`}
                disabled={locked}
                onClick={() => setDeleting(label.name)}
              />
            </div>
          ))}
        </div>
      </Dialog>
      {deleting === null ? null : (
        <LabelDeleteDialog
          name={deleting}
          labels={labels}
          store={store}
          locked={locked}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
