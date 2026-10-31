import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import {Button} from '@renderer/ui/Button';
import type {Label} from '@core/schema/labels';
import {Dialog} from '@renderer/ui/Dialog';
import {IconButton} from '@renderer/ui/IconButton';
import {LabelColorPicker} from '@renderer/ui/LabelColorPicker';
import {LabelDeleteDialog} from './LabelDeleteDialog';
import {LabelNameField} from './LabelNameField';
import {useLabelRows} from './useLabelRows';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import styles from './LabelMenu.module.css';

const DELETE_SCOPE = '공유 목록에서만 삭제하며 곡의 이름표는 유지합니다';
const EMPTY_LABELS: readonly Label[] = [];

export function LabelManagerDialog({
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
  const labels = document?.value.labels ?? EMPTY_LABELS;
  const locked = busy || document?.access !== 'editable';
  const [deleting, setDeleting] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    name: string | null;
  } | null>(null);
  const focused = useRef(focusRequest);
  const body = useRef<HTMLDivElement>(null);
  const drafts = useRef(new Map<number, () => Promise<boolean>>());
  const acting = useRef(false);
  const {rows, prepareRename} = useLabelRows(labels);
  useEffect(() => {
    if (focusRequest === null || focused.current === focusRequest || busy) {
      return;
    }
    focused.current = focusRequest;
    const row = [
      ...(body.current?.querySelectorAll<HTMLElement>('[role="group"]') ?? []),
    ].find(element => element.getAttribute('aria-label') === focusRequest.name);
    const field = row?.querySelector('input');
    field?.focus();
    field?.select();
    if (field === undefined) {
      body.current
        ?.closest('[role="dialog"]')
        ?.querySelector<HTMLElement>('[data-modal-primary]')
        ?.focus();
    }
  }, [focusRequest, busy]);
  const currentLabels = (): readonly Label[] =>
    store.getSnapshot().labels?.value.labels ?? EMPTY_LABELS;
  const runAction = async (action: () => unknown): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    try {
      for (const save of [...drafts.current.values()]) {
        if (!(await save())) return;
      }
      await action();
    } finally {
      acting.current = false;
    }
  };
  const close = (): void => editorTask(runAction(onClose));
  const create = async (): Promise<void> => {
    const state = store.getSnapshot();
    if (state.busy || state.labels?.access !== 'editable') return;
    const labels = currentLabels();
    let name = '새 이름표';
    let suffix = 2;
    while (labels.some(label => label.name === name)) {
      name = `새 이름표 ${suffix++}`;
    }
    if (
      await store.updateLabels([...labels, {name, color: 'none', key: null}])
    ) {
      setFocusRequest({name});
    }
  };
  return (
    <>
      <Dialog
        title="이름표 관리"
        initialFocus="surface"
        size="m"
        onCancel={close}
        cancelLabel={null}
        primary={{label: '닫기', onSelect: close}}
        footerStart={
          <Button
            icon="plus"
            size="md"
            variant="ghost"
            disabled={locked}
            title={
              document?.access !== 'editable'
                ? '읽기 전용 이름표 목록'
                : undefined
            }
            onClick={() => editorTask(runAction(create))}
          >
            새 이름표
          </Button>
        }
      >
        <div ref={body} className={styles.settings}>
          {rows.map(({label, key}, index) => (
            <div
              key={key}
              role="group"
              aria-label={label.name}
              className={styles.settingsRow}
            >
              <div className={styles.name}>
                <LabelNameField
                  label={label}
                  labels={labels}
                  store={store}
                  locked={locked}
                  onRename={(_from, to) => prepareRename(key, to)}
                  onDraft={save => {
                    if (save === null) drafts.current.delete(key);
                    else drafts.current.set(key, save);
                  }}
                />
              </div>
              <LabelColorPicker
                label={`${label.name} 색`}
                scope="모든 곡에 적용"
                value={label.color}
                disabled={locked}
                onChange={color =>
                  editorTask(
                    runAction(() =>
                      store.updateLabels(
                        currentLabels().map((item, itemIndex) =>
                          itemIndex === index ? {...item, color} : item,
                        ),
                      ),
                    ),
                  )
                }
              />
              <IconButton
                icon="trash"
                label={`${label.name} 삭제`}
                title={DELETE_SCOPE}
                disabled={locked}
                onClick={() =>
                  editorTask(
                    runAction(() => {
                      const name = currentLabels()[index]?.name;
                      if (name !== undefined) setDeleting(name);
                    }),
                  )
                }
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
          onClose={() => {
            setDeleting(null);
            const labels = currentLabels();
            setFocusRequest({
              name: labels.some(label => label.name === deleting)
                ? deleting
                : (labels[0]?.name ?? null),
            });
          }}
        />
      )}
    </>
  );
}
