import type {JSX} from 'react';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import type {TemplateConflict} from './useSaveTemplate';

/** Asks what to do when a 템플릿 with the open service's name already exists. */
export function SaveTemplatePrompt({
  conflict,
  busy,
  onSaveNew,
  onOverwrite,
  onCancel,
}: {
  readonly conflict: TemplateConflict;
  readonly busy: boolean;
  readonly onSaveNew: () => void;
  readonly onOverwrite: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <AlertDialog
      icon="frame"
      title={`‘${conflict.name}’ 템플릿이 이미 있습니다. 덮어쓸까요?`}
      onCancel={onCancel}
      actions={[
        {label: '새 템플릿으로 저장', onSelect: onSaveNew, disabled: busy},
        {
          label: '덮어쓰기',
          onSelect: onOverwrite,
          disabled: busy,
          primary: true,
        },
      ]}
    />
  );
}
