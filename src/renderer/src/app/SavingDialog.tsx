import {useSyncExternalStore, type JSX} from 'react';
import {AlertDialog, type AlertAction} from '@renderer/ui/AlertDialog';
import type {CloseFlush, CloseFlushView} from './closeFlush';

const TITLES: Readonly<Record<Exclude<CloseFlushView, 'hidden'>, string>> = {
  saving: '저장 중',
  failed: '저장할 수 없음',
};

/**
 * The 저장 중 dialog while a close flush runs, and after a refusal. 다시 시도
 * is the default button and stays disabled while saving, so Enter never
 * drops an edit.
 */
export function SavingDialog({
  closeFlush,
}: {
  readonly closeFlush: CloseFlush;
}): JSX.Element | null {
  const view = useSyncExternalStore(
    closeFlush.subscribe,
    closeFlush.getSnapshot,
  );
  if (view === 'hidden') return null;
  const actions: readonly AlertAction[] = [
    {
      label: '강제로 닫기',
      onSelect: closeFlush.forceClose,
      title: '저장하지 못한 편집은 사라집니다',
    },
    {
      label: '다시 시도',
      onSelect: closeFlush.retry,
      primary: true,
      disabled: view === 'saving',
      title: view === 'saving' ? '저장 중' : undefined,
    },
  ];
  return (
    <AlertDialog
      key={view}
      icon="saved"
      title={TITLES[view]}
      actions={actions}
    />
  );
}
