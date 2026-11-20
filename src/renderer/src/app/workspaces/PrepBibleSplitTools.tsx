import type {JSX} from 'react';
import type {ServiceItemOf} from '@core/schema/service';
import type {Notice} from '@renderer/ui/notices';
import {BibleSplitTools} from '@renderer/features/bible/BibleSplitTools';
import {itemEditorAdapter} from '@renderer/platform/itemEditorAdapter';

/** Uses the same kind capability as the editor's split button. */
export function PrepBibleSplitTools({
  item,
  selectedIndex,
  manualRequest,
  onProblem,
}: {
  readonly item: ServiceItemOf<'bible' | 'sermon'>;
  readonly selectedIndex: number;
  readonly manualRequest: number;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  return (
    <BibleSplitTools
      enableManual={itemEditorAdapter(item).splitVerses}
      selectedIndex={selectedIndex}
      manualRequest={manualRequest}
      onProblem={onProblem}
    />
  );
}
