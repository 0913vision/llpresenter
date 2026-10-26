import type {BibleLookupPassage} from '@shared/schema/bibleLookup';
import {outputTile, useShow} from '@renderer/state/show';
import {beginOutputRequest} from '@renderer/state/showOutput';
import {bibleSource} from './source';

export function openBiblePassage(passage: BibleLookupPassage): void {
  const source = bibleSource(passage);
  const view = useShow.getState();
  beginOutputRequest();
  useShow.setState({
    bibleSource: source,
    openItemId: source.id,
    selectedTile:
      view.openItemId === source.id
        ? Math.min(view.selectedTile, source.tiles.length - 1)
        : 0,
  });
}

/** Outputs the selected Bible tile through the standard slide command path. */
export function showBiblePassage(passage: BibleLookupPassage): void {
  openBiblePassage(passage);
  const view = useShow.getState();
  if (view.openItemId !== null) {
    outputTile({itemId: view.openItemId, index: view.selectedTile});
  }
}
