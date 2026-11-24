import {useMemo, useState} from 'react';
import {treeRows, type TreeRow, type TreeSelection} from './serviceTree';
import {
  listedSource,
  sourceKey,
  useSourceDocument,
  type SourceLists,
  type SourcesApi,
} from './useServiceSources';
import {type ServiceSource} from './serviceSource';

/**
 * The source a dialog copies items from, its items as tree rows, and the
 * items checked in it. A source that is chosen starts with `fresh(rows)`
 * checked, also when the operator returns to one they changed (spec 05).
 * While its items are read, the last source and checks stay on screen.
 */
export function useSourcePick({
  api,
  lists,
  fallback,
  fresh,
}: {
  readonly api: SourcesApi | undefined;
  readonly lists: SourceLists;
  /** The source shown first, and when the chosen one leaves the lists. */
  readonly fallback: ServiceSource | null;
  readonly fresh: (rows: readonly TreeRow[]) => TreeSelection;
}) {
  const [chosen, setChosen] = useState<ServiceSource | null>(null);
  const {source, version} = listedSource(lists, chosen, fallback);
  if (source !== chosen) setChosen(source);
  const {document, missing, pending} = useSourceDocument(api, source, version);
  const rows = useMemo(
    () => (document === null ? [] : treeRows(document.order, lists.songTitles)),
    [document, lists.songTitles],
  );

  const key = source === null ? null : sourceKey(source);
  const [picked, setPicked] = useState<{
    readonly key: string | null;
    readonly selection: TreeSelection;
  } | null>(null);
  const [previousSelection, setPreviousSelection] =
    useState<TreeSelection | null>(null);
  const selection =
    pending && previousSelection !== null
      ? previousSelection
      : picked?.key === key
        ? picked.selection
        : fresh(rows);
  // NOTE(0913vision): The dialog opens once the lists and the chosen source's
  // items have answered, so it never draws empty and then fills in.
  const answered =
    lists.ready && (document !== null || missing || source === null);
  const [opened, setOpened] = useState(false);
  if (answered && !opened) setOpened(true);
  return {
    /** The dialog may be drawn: everything it shows first has answered. */
    ready: answered || opened,
    /** The chosen source, whose items may still be on their way. */
    source,
    /** The source the list shows as chosen: the last one until its items came. */
    shown: pending ? (document?.source ?? source) : source,
    document,
    missing,
    pending,
    rows,
    selection,
    setSelection: (next: TreeSelection): void => {
      if (!pending) setPicked({key, selection: next});
    },
    choose: (next: ServiceSource): void => {
      if (key === sourceKey(next)) return;
      setPreviousSelection(selection);
      setChosen(next);
      setPicked(null);
    },
  };
}
