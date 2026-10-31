import {useState, type ReactNode} from 'react';
import {useShow} from '@renderer/session/show';
import {menuAvailability, type MenuItem} from '@renderer/ui/menuModel';
import type {Notice} from '@renderer/ui/notices';
import {ImportItemsDialog} from './ImportItemsDialog';
import {NewServiceDialog} from './NewServiceDialog';
import {SaveTemplatePrompt} from './SaveTemplatePrompt';
import {SaveTemplateDialog} from './SaveTemplateDialog';
import {useSaveTemplate} from './useSaveTemplate';

type ServiceDialog = 'new' | 'import';
export type ServiceActionEntries = Readonly<
  Record<'newService' | 'importItems' | 'saveTemplate', MenuItem>
>;

const NO_SERVICE = '열린 예배 순서가 없습니다';

/**
 * The service commands at the end of the service picker, and the dialog the
 * chosen one opens. `onOpen` runs first, such as closing the picker.
 */
export function useServiceActions({
  onProblem,
  onOpen,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly onOpen: () => void;
}): {readonly entries: ServiceActionEntries; readonly dialogs: ReactNode} {
  const [dialog, setDialog] = useState<ServiceDialog | null>(null);
  const hasService = useShow(view => view.serviceId !== null);
  const saver = useSaveTemplate({onProblem});
  const open = (next: ServiceDialog): void => {
    onOpen();
    setDialog(next);
  };
  const close = (): void => setDialog(null);
  const entries: ServiceActionEntries = {
    newService: {
      kind: 'item',
      id: 'new-service',
      label: '새 예배',
      icon: 'plus',
      onSelect: () => open('new'),
    },
    importItems: {
      kind: 'item',
      id: 'import-items',
      label: '다른 예배에서 가져오기',
      icon: 'listplus',
      ...menuAvailability(hasService ? undefined : NO_SERVICE),
      onSelect: () => open('import'),
    },
    saveTemplate: {
      kind: 'item',
      id: 'save-template',
      label: '지금 예배를 템플릿으로 저장',
      icon: 'frame',
      ...menuAvailability(
        !hasService
          ? NO_SERVICE
          : window.llp === undefined
            ? '예배 순서 연결 안 됨'
            : !saver.canSave
              ? '템플릿 저장 진행 중'
              : undefined,
      ),
      onSelect: () => {
        onOpen();
        saver.save();
      },
    },
  };
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
      {saver.naming === null ? null : (
        <SaveTemplateDialog
          name={saver.naming.name}
          busy={saver.busy}
          onSave={saver.saveNamed}
          onCancel={saver.cancel}
        />
      )}
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
