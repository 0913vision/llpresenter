import {useState, type ReactNode} from 'react';
import {useShow} from '@renderer/state/show';
import type {MenuItem} from '@renderer/ui/menuModel';
import type {Notice} from '@renderer/ui/notices';
import {ImportItemsDialog} from './ImportItemsDialog';
import {NewServiceDialog} from './NewServiceDialog';

type ServiceDialog = 'new' | 'import';

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
}): {readonly entries: readonly MenuItem[]; readonly dialogs: ReactNode} {
  const [dialog, setDialog] = useState<ServiceDialog | null>(null);
  const hasService = useShow(view => view.serviceId !== null);
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
  ];
  const dialogs =
    dialog === 'new' ? (
      <NewServiceDialog onClose={close} onProblem={onProblem} />
    ) : dialog === 'import' ? (
      <ImportItemsDialog onClose={close} onProblem={onProblem} />
    ) : null;
  return {entries, dialogs};
}
