import type {JSX} from 'react';
import {Dialog} from '@renderer/ui/Dialog';
import type {Notice} from '@renderer/ui/notices';
import {SourceList} from './SourceList';
import {SourceTree} from './SourceTree';
import {useImportItems} from './useImportItems';

const DIALOG_HEIGHT = 700;
const MISSING = '예배 순서를 읽을 수 없습니다';
const NO_SOURCES = '가져올 틀이나 예배 순서가 없습니다';

/** The 다른 예배에서 가져오기 dialog: copy items to the end of the open service. */
export function ImportItemsDialog({
  onClose,
  onProblem,
}: {
  readonly onClose: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const state = useImportItems({onProblem, onDone: onClose});
  const empty = state.missing
    ? MISSING
    : state.lists.ready && state.source === null
      ? NO_SOURCES
      : undefined;
  return (
    <Dialog
      title="다른 예배에서 가져오기"
      size="l"
      height={DIALOG_HEIGHT}
      onCancel={onClose}
      primary={{
        label: '가져오기',
        onSelect: state.importItems,
        disabled: !state.canImport,
        title: state.reason,
      }}
      aside={
        <SourceList
          templates={state.templates}
          services={state.services}
          selected={state.source}
          onSelect={state.choose}
          withEmpty={false}
          onRetry={state.lists.failed ? state.lists.retry : undefined}
        />
      }
    >
      <SourceTree
        rows={state.rows}
        selection={state.selection}
        onChange={state.setSelection}
        empty={empty}
      />
    </Dialog>
  );
}
