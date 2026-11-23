import {focusHistorySurface} from '@renderer/ui/focusHistorySurface';
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
import {Icon} from '@renderer/ui/Icon';
import {LabelColorControl} from '@renderer/ui/LabelColorPopover';
import {settingsDeleteHistory} from '@renderer/platform/settingsDeleteHistory';
import {useUndoKeys} from '@renderer/platform/useUndoKeys';
import {
  logUndoProblem,
  undoReason,
  undoTimeline,
} from '@renderer/platform/undoTimeline';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import {useReflow} from '@renderer/ui/useReflow';
import {historyKey} from '@renderer/ui/historyKey';
import {LabelNameField} from './LabelNameField';
import {useLabelRows} from './useLabelRows';
import {useLabelReorder} from './useLabelReorder';
import {useLabelActions} from './useLabelActions';
import {editorTask} from '@renderer/platform/editorTask';
import type {LabelCatalog} from './labelCatalog';
import styles from './LabelMenu.module.css';

const EMPTY_LABELS: readonly Label[] = [];

export interface LabelManagerHandle {
  readonly settle: () => Promise<boolean>;
}

type LabelManagerProps = {
  readonly store: LabelCatalog;
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
  const [focusRequest, setFocusRequest] = useState<{
    name: string | null;
  } | null>(null);
  const focused = useRef(focusRequest);
  const body = useRef<HTMLDivElement>(null);
  const pageRoot = useRef<HTMLDivElement>(null);
  const history = settingsDeleteHistory(store.api, 'labels');
  useUndoKeys(frame.placement === 'page' ? pageRoot : body);
  useReflow(body, {
    ids: labels.map(label => label.name),
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: 'labels',
  });
  const addButton = useRef<HTMLButtonElement>(null);
  const actions = useLabelActions(store);
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
  useImperativeHandle(managerRef, () => ({settle: actions.settle}));
  const close = (): void =>
    editorTask(
      actions.run(() => {
        if (frame.placement === 'dialog') frame.onClose();
      }),
    );
  const create = async (): Promise<void> => {
    const name = await actions.create();
    if (name !== null) setFocusRequest({name});
  };
  const reorder = useLabelReorder({
    shown: rows.map(row => row.label.name),
    locked,
    names: () => actions.current().map(label => label.name),
    move: (name, target) => {
      if (!locked) editorTask(actions.move(name, target));
    },
  });
  const add = (
    <Button
      ref={addButton}
      icon="plus"
      size="md"
      variant="ghost"
      disabled={locked}
      title={document?.access !== 'editable' ? NEWER_FILE_REASON : undefined}
      onClick={() => editorTask(actions.run(create))}
    >
      새 이름표
    </Button>
  );
  const content = (
    <div
      ref={body}
      className={styles.settings}
      onKeyDown={event => {
        const kind = historyKey(event);
        if (kind === null || undoReason(kind) !== undefined) return;
        event.preventDefault();
        event.stopPropagation();
        editorTask(undoTimeline.replay(kind, logUndoProblem));
      }}
    >
      {rows.map(({label, key}, index) => (
        <div
          key={key}
          role="group"
          data-reflow-id={label.name}
          aria-label={label.name}
          className={styles.settingsRow}
          data-drop={reorder.dropAt(index)}
          {...reorder.row(index)}
        >
          <button
            type="button"
            className={styles.grip}
            aria-label={`${label.name} 순서 이동`}
            aria-disabled={locked || undefined}
            {...reorder.grip(label.name, index)}
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
              onDraft={save => actions.draft(key, save)}
            />
          </div>
          <LabelColorControl
            label={`${label.name} 색`}
            value={label.color}
            disabled={locked}
            onOpen={open => editorTask(actions.run(open))}
            onPreview={color => store.previewLabelColor(label.name, color)}
            onChange={async color => {
              try {
                return await actions.recolor(label.name, color);
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
                actions.run(async () => {
                  const name = actions.current()[index]?.name;
                  let removal: Promise<boolean> | undefined;
                  deleteSelection(
                    name === undefined ? 0 : 1,
                    () => !locked && name !== undefined,
                    () => {
                      if (name === undefined) return;
                      focusHistorySurface(body.current);
                      removal = store.updateLabels(
                        actions.current().filter(label => label.name !== name),
                        revision => history.record(revision),
                      );
                    },
                  );
                  if (removal && (await removal)) {
                    if (
                      frame.placement === 'page' &&
                      actions.current().length === 0
                    ) {
                      addButton.current?.focus();
                    }
                  }
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
        <div ref={pageRoot} data-label-manager className={styles.page}>
          {content}
          <footer>{add}</footer>
        </div>
      )}
    </>
  );
}
