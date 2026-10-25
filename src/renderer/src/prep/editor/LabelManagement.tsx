import {useState, type JSX} from 'react';
import type {Label} from '@shared/schema/labels';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {Menu} from '@renderer/ui/Menu';
import {LabelDialog} from './LabelDialog';
import type {LabelContext} from './LabelChoices';
import type {SongEditorStore} from './songEditorStore';
import {editorTask} from './editorTask';

interface ManagementProps {
  readonly context: LabelContext;
  readonly store: SongEditorStore;
  readonly labels: readonly Label[];
  readonly locked: boolean;
  readonly onClose: () => void;
}

/** One management flow keeps the parent label popup and its anchor alive. */
export function LabelManagement({
  context,
  store,
  labels,
  locked,
  onClose,
}: ManagementProps): JSX.Element {
  const [action, setAction] = useState<'rename' | 'key' | 'delete' | null>(
    null,
  );
  if (action === 'delete') {
    return (
      <AlertDialog
        icon="trash"
        title="이름표 삭제"
        meta={[context.label.name]}
        onCancel={onClose}
        actions={[
          {
            label: '삭제',
            primary: true,
            disabled: locked,
            onSelect: () => {
              const remove = async (): Promise<void> => {
                if (
                  await store.updateLabels(
                    labels.filter(label => label.name !== context.label.name),
                  )
                ) {
                  onClose();
                }
              };
              editorTask(remove());
            },
          },
        ]}
      />
    );
  }
  if (action !== null) {
    return (
      <LabelDialog
        kind={action}
        label={context.label}
        labels={labels}
        store={store}
        busy={locked}
        onClose={onClose}
      />
    );
  }
  return (
    <Menu
      label={`${context.label.name} 관리`}
      anchor={context.anchor}
      onClose={reason => {
        if (reason !== 'select') onClose();
      }}
      entries={[
        {
          kind: 'item',
          id: 'rename',
          label: '이름 바꾸기',
          disabled: locked,
          onSelect: () => setAction('rename'),
        },
        {
          kind: 'item',
          id: 'key',
          label: '바로 가기 키',
          disabled: locked,
          onSelect: () => setAction('key'),
        },
        {kind: 'separator', id: 'separator'},
        {
          kind: 'item',
          id: 'delete',
          label: '삭제',
          disabled: locked,
          onSelect: () => setAction('delete'),
        },
      ]}
    />
  );
}
