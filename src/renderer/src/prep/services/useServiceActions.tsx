import {useState, type ReactNode} from 'react';
import {useShow} from '@renderer/state/show';
import type {MenuItem} from '@renderer/ui/menuModel';
import type {Notice} from '@renderer/ui/notices';
import {ImportItemsDialog} from './ImportItemsDialog';
import {NewServiceDialog} from './NewServiceDialog';
import {SaveTemplatePrompt} from './SaveTemplatePrompt';
import {useSaveTemplate} from './useSaveTemplate';

type ServiceDialog = 'new' | 'import';

const NO_SERVICE = '열린 예배 순서가 없습니다';

/**
 * The service commands at the end of the service picker, and the dialog the
 * chosen one opens. `onOpen` runs first, such as closing the picker.
 * 지금 예배를 틀로 저장 opens nothing unless a 틀 has the service's name.
 */
export function useServiceActions({
  onProblem,
  onOpen,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly onOpen: () => void;
}): {readonly entries: readonly MenuItem[]; readonly dialogs: ReactNode} {
  const [dialog, setDialog] = useState<ServiceDialog | null>(null);
  const hasService = useShow(view => view.serviceId !== null);
  const saver = useSaveTemplate({onProblem});
  const open = (next: ServiceDialog): void => {
    onOpen();
    setDialog(next);
  };
  const close = (): void => setDialog(null);
  const entries: readonly MenuItem[] = [
    {
      kind: 'item',
      id: 'new-service',
      label: '새 예배',
      icon: 'plus',
      onSelect: () => open('new'),
    },
    {
      kind: 'item',
      id: 'import-items',
      label: '다른 예배에서 가져오기',
      icon: 'listplus',
      disabled: !hasService,
      title: hasService ? undefined : NO_SERVICE,
      onSelect: () => open('import'),
    },
    {
      kind: 'item',
      id: 'save-template',
      label: '지금 예배를 틀로 저장',
      icon: 'frame',
      disabled: !saver.canSave,
      title: hasService ? undefined : NO_SERVICE,
      onSelect: () => {
        onOpen();
        saver.save();
      },
    },
  ];
  const dialogs = (
    <>
      {dialog === 'new' ? (
        <NewServiceDialog
          onClose={close}
          onProblem={onProblem}
          saveTemplate={{
            disabled: !saver.canSave,
            reason: hasService ? undefined : NO_SERVICE,
            onSave: saver.save,
          }}
        />
      ) : dialog === 'import' ? (
        <ImportItemsDialog onClose={close} onProblem={onProblem} />
      ) : null}
      {saver.conflict === null ? null : (
        <SaveTemplatePrompt
          conflict={saver.conflict}
          busy={saver.busy}
          onSaveNew={saver.saveNew}
          onOverwrite={saver.overwrite}
          onCancel={saver.cancel}
        />
      )}
    </>
  );
  return {entries, dialogs};
}
