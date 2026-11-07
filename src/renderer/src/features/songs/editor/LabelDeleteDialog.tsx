import type {JSX} from 'react';
import type {Label} from '@core/schema/labels';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import type {SongEditorStore} from './songEditorStore';
import {editorTask} from './editorTask';

export function LabelDeleteDialog({
  name,
  labels,
  store,
  locked,
  onClose,
}: {
  readonly name: string;
  readonly labels: readonly Label[];
  readonly store: SongEditorStore;
  readonly locked: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <AlertDialog
      icon="trash"
      title="이름표 삭제"
      meta={[name, '곡에 붙은 이름표는 남습니다']}
      onCancel={onClose}
      actions={[
        {
          label: '삭제',
          primary: true,
          disabled: locked,
          onSelect: () =>
            editorTask(
              (async () => {
                if (
                  await store.updateLabels(
                    labels.filter(label => label.name !== name),
                  )
                ) {
                  onClose();
                }
              })(),
            ),
        },
      ]}
    />
  );
}
