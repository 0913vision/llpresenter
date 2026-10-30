import type {ReactNode} from 'react';
import type {SongId} from '@core/schema/ids';
import {ReadOnlyMark} from '@renderer/features/presentation/ReadOnlyMark';
import {ServiceQuickAdd} from '@renderer/features/service/items/QuickAdd';
import {ServiceOrderHeader} from '@renderer/features/service/order/ServiceOrderHeader';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import type {Notice} from '@renderer/ui/notices';
import {logPanelProblem, type PanelParts} from '../shell/WorkspacePanel';

/** The title of the 예배 순서 panel, which 진행 and 준비 share. */
export const SERVICE_ORDER = '예배 순서';

/** The 예배 순서 panel as 진행 or 준비 shows it. */
export function serviceOrderParts({
  workspace,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
  onOpenItem,
  actions,
}: {
  readonly workspace: 'show' | 'prep';
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep: ((itemId: string) => void) | undefined;
  readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
  readonly onOpenItem: () => void;
  readonly actions: ReactNode;
}): PanelParts {
  return {
    header: <ServiceOrderHeader onProblem={onProblem} />,
    body: (
      <ServiceOrderList
        workspace={workspace}
        onProblem={onProblem}
        onOpenPrep={onOpenPrep}
        onShowInLibrary={onShowInLibrary}
        onOpenItem={onOpenItem}
      />
    ),
    meta: <ReadOnlyMark />,
    actions: (
      <>
        <ServiceQuickAdd onProblem={onProblem ?? logPanelProblem} />
        {actions}
      </>
    ),
  };
}
