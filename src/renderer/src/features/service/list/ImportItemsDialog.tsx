import {use, useState, type JSX} from 'react';
import {
  PrepItemNavigation,
  WorkspaceNavigation,
} from '@renderer/platform/WorkspaceNavigation';
import {Dialog} from '@renderer/ui/Dialog';
import {openItem} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/notices';
import {SourceList} from './SourceList';
import {SourceTree} from './SourceTree';
import {useSourceActions} from './useSourceActions';
import {useImportItems} from './useImportItems';

const DIALOG_HEIGHT = 700;
const MISSING = '예배 읽기 실패';
const NO_SOURCES = '가져올 템플릿이나 예배가 없습니다';

/**
 * The 다른 예배에서 가져오기 dialog: copy items to the end of the open service.
 * 취소, Esc, and the close button wait while an import is on its way.
 */
export function ImportItemsDialog({
  onClose,
  onProblem,
}: {
  readonly onClose: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const navigate = use(WorkspaceNavigation);
  const openPrepItem = use(PrepItemNavigation);
  const state = useImportItems({
    onProblem,
    onDone: itemId => {
      if (itemId !== undefined && openPrepItem !== undefined) {
        openPrepItem(itemId);
      } else {
        if (itemId !== undefined) openItem(itemId);
        navigate?.('prep');
      }
      onClose();
    },
  });
  const empty = state.missing
    ? MISSING
    : state.lists.ready && state.source === null
      ? NO_SOURCES
      : undefined;
  const actions = useSourceActions({onProblem});
  // NOTE(0913vision): Open once the lists and the chosen source's items have
  // answered, so the dialog never draws empty and then fills in.
  const loaded =
    state.lists.ready &&
    (state.document !== null || state.missing || state.source === null);
  const [opened, setOpened] = useState(false);
  if (loaded && !opened) setOpened(true);
  if (!loaded && !opened) return <></>;
  return (
    <>
      <Dialog
        title="다른 예배에서 가져오기"
        size="l"
        height={DIALOG_HEIGHT}
        onCancel={() => {
          if (!state.busy) onClose();
        }}
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
            onRowMenu={actions.openMenu}
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
      {actions.overlays}
    </>
  );
}
