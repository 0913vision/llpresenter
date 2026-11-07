import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type Ref,
  type DragEvent,
} from 'react';
import {Button} from '@renderer/ui/Button';
import type {Label} from '@core/schema/labels';
import {Dialog} from '@renderer/ui/Dialog';
import {IconButton} from '@renderer/ui/IconButton';
import {Icon} from '@renderer/ui/Icon';
import {LabelColorControl} from '@renderer/ui/LabelColorPopover';
import {LabelDeleteDialog} from './LabelDeleteDialog';
import {LabelNameField} from './LabelNameField';
import {useLabelRows} from './useLabelRows';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import styles from './LabelMenu.module.css';

const EMPTY_LABELS: readonly Label[] = [];
const LABEL_DRAG = 'application/x-llp-label';

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
  const dragging = useRef<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
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
  const currentLabels = (): readonly Label[] => store.getStoredLabels();
  const settleDrafts = async (): Promise<boolean> => {
    for (const save of [...drafts.current.values()]) {
      if (!(await save())) return false;
    }
    return true;
  };
  useImperativeHandle(managerRef, () => ({settle: settleDrafts}));
  const runAction = async (action: () => unknown): Promise<unknown> => {
    if (acting.current) return;
    acting.current = true;
    try {
      if (!(await settleDrafts())) return;
      return await action();
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
  const move = (name: string, target: number): void => {
    const source = currentLabels().findIndex(label => label.name === name);
    editorTask(
      runAction(async () => {
        const labels = [...currentLabels()];
        const index = source;
        if (
          locked ||
          index < 0 ||
          index === target ||
          target < 0 ||
          target >= labels.length
        ) {
          return;
        }
        const [label] = labels.splice(index, 1);
        if (label === undefined) return;
        labels.splice(target, 0, label);
        await store.updateLabels(labels);
      }),
    );
  };
  const dropPosition = (
    event: DragEvent<HTMLDivElement>,
    index: number,
  ): number => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0);
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
          data-drop={
            dropIndex === index
              ? 'before'
              : index === rows.length - 1 && dropIndex === rows.length
                ? 'after'
                : undefined
          }
          onDragOver={event => {
            if (
              locked ||
              dragging.current === null ||
              !event.dataTransfer.types.includes(LABEL_DRAG)
            ) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDropIndex(dropPosition(event, index));
          }}
          onDragLeave={event => {
            if (!(
              event.relatedTarget instanceof Node &&
              event.currentTarget.contains(event.relatedTarget)
            )) {
              setDropIndex(null);
            }
          }}
          onDrop={event => {
            event.preventDefault();
            const name = dragging.current;
            dragging.current = null;
            setDropIndex(null);
            if (
              locked ||
              name === null ||
              event.dataTransfer.getData(LABEL_DRAG) !== name
            ) {
              return;
            }
            const source = currentLabels().findIndex(
              label => label.name === name,
            );
            const insertion = dropPosition(event, index);
            move(name, insertion - (source < insertion ? 1 : 0));
          }}
        >
          <button
            type="button"
            className={styles.grip}
            aria-label={`${label.name} 순서 이동`}
            aria-disabled={locked || undefined}
            draggable={!locked}
            onDragStart={event => {
              if (locked) {
                event.preventDefault();
                return;
              }
              dragging.current = label.name;
              event.dataTransfer.setData(LABEL_DRAG, label.name);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              dragging.current = null;
              setDropIndex(null);
            }}
            onKeyDown={event => {
              if (
                locked ||
                !event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                !['ArrowUp', 'ArrowDown'].includes(event.key)
              ) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              move(label.name, index + (event.key === 'ArrowUp' ? -1 : 1));
            }}
          >
            <Icon name="grip" size={16} />
          </button>
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
          <LabelColorControl
            label={`${label.name} 색`}
            value={label.color}
            disabled={locked}
            onOpen={open => editorTask(runAction(open))}
            onPreview={color => store.previewLabelColor(label.name, color)}
            onChange={async color => {
              try {
                return (
                  (await runAction(() => {
                    const labels = currentLabels();
                    if (!labels.some(item => item.name === label.name)) {
                      return false;
                    }
                    return store.updateLabels(
                      labels.map(item =>
                        item.name === label.name ? {...item, color} : item,
                      ),
                    );
                  })) === true
                );
              } finally {
                store.previewLabelColor(label.name, null);
              }
            }}
          />
          <IconButton
            icon="trash"
            label={`${label.name} 삭제`}
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
