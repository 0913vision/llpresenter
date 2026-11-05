import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type Ref,
} from 'react';
import {Button} from '@renderer/ui/Button';
import type {Label} from '@core/schema/labels';
import {Dialog} from '@renderer/ui/Dialog';
import {IconButton} from '@renderer/ui/IconButton';
import {
  LabelColorPicker,
  paletteColorScopes,
} from '@renderer/ui/LabelColorPicker';
import {LabelDeleteDialog} from './LabelDeleteDialog';
import {LabelNameField} from './LabelNameField';
import {useLabelRows} from './useLabelRows';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import styles from './LabelMenu.module.css';

const DELETE_SCOPE = '공유 목록에서만 삭제하며 곡의 이름표는 유지합니다';
const EMPTY_LABELS: readonly Label[] = [];

export interface LabelManagerHandle {
  readonly settle: () => Promise<boolean>;
}

type LabelManagerProps = {
  readonly store: SongEditorStore;
  readonly ref?: Ref<LabelManagerHandle> | undefined;
} & (
  | {readonly placement: 'dialog'; readonly onClose: () => void}
  | {readonly placement: 'page'}
);

/** Edits one shared catalog in either its dialog or the preferences page. */
export function LabelManager({
  store,
  ref: managerRef,
  ...frame
}: LabelManagerProps): JSX.Element {
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
  const addButton = useRef<HTMLButtonElement>(null);
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
      if (frame.placement === 'page') {
        addButton.current?.focus();
        return;
      }
      body.current
        ?.closest('[role="dialog"]')
        ?.querySelector<HTMLElement>('[data-modal-primary]')
        ?.focus();
    }
  }, [focusRequest, busy, frame.placement]);
  const currentLabels = (): readonly Label[] =>
    store.getSnapshot().labels?.value.labels ?? EMPTY_LABELS;
  const settleDrafts = async (): Promise<boolean> => {
    for (const save of [...drafts.current.values()]) {
      if (!(await save())) return false;
    }
    return true;
  };
  useImperativeHandle(managerRef, () => ({settle: settleDrafts}));
  const runAction = async (action: () => unknown): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    try {
      if (!(await settleDrafts())) return;
      await action();
    } finally {
      acting.current = false;
    }
  };
  const close = (): void =>
    editorTask(
      runAction(() => {
        if (frame.placement === 'dialog') frame.onClose();
      }),
    );
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
  const add = (
    <Button
      ref={addButton}
      icon="plus"
      size="md"
      variant="ghost"
      disabled={locked}
      title={document?.access !== 'editable' ? NEWER_FILE_REASON : undefined}
      onClick={() => editorTask(runAction(create))}
    >
      새 이름표
    </Button>
  );
  const content = (
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
            scope={paletteColorScopes.label}
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
  );
  return (
    <>
      {frame.placement === 'dialog' ? (
        <Dialog
          title="이름표 관리"
          initialFocus="surface"
          size="m"
          onCancel={close}
          cancelLabel={null}
          primary={{label: '닫기', onSelect: close}}
          footerStart={add}
        >
          {content}
        </Dialog>
      ) : (
        <div data-label-manager className={styles.page}>
          {content}
          <footer>{add}</footer>
        </div>
      )}
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
