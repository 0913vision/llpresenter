import {useEffect, useMemo, useRef, useState} from 'react';
import {useShow} from '@renderer/state/show';
import type {Notice} from '@renderer/ui/notices';
import {asServiceId, editApplied, warningNotice} from './serviceEdits';
import {selectedIds, treeRows, type TreeSelection} from './serviceTree';
import {
  listedSource,
  logFailure,
  sourceKey,
  useSourceDocument,
  useSourceLists,
  type ServiceSource,
} from './useServiceSources';

const NOTHING: TreeSelection = new Set();
const NONE_PICKED = '항목을 골라야 가져올 수 있습니다';
const READ_ONLY = '읽기 전용 예배 순서에는 가져올 수 없습니다';
const FAILED = '항목을 가져올 수 없음';

/**
 * The state and actions of the 다른 예배에서 가져오기 dialog. The sources are
 * the 템플릿 and the other services; picking one checks nothing.
 */
export function useImportItems({
  onProblem,
  onDone,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly onDone: () => void;
}) {
  const api = window.llp;
  const currentId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const lists = useSourceLists(api);
  const services = useMemo(
    () => lists.services.filter(entry => entry.id !== currentId),
    [lists.services, currentId],
  );
  const [chosen, setChosen] = useState<ServiceSource | null>(null);
  const firstTemplate = lists.templates[0]?.id;
  const firstService = services[0]?.id;
  const fallback = useMemo<ServiceSource | null>(() => {
    if (!lists.ready) return null;
    if (firstTemplate !== undefined) {
      return {kind: 'template', id: firstTemplate};
    }
    return firstService === undefined
      ? null
      : {kind: 'service', id: firstService};
  }, [lists.ready, firstTemplate, firstService]);
  const {source, version} = listedSource(lists, chosen, fallback);
  if (source !== chosen) setChosen(source);
  const {document, missing} = useSourceDocument(api, source, version);
  const rows = useMemo(
    () => (document === null ? [] : treeRows(document.order, lists.songTitles)),
    [document, lists.songTitles],
  );

  const key = source === null ? null : sourceKey(source);
  const [picked, setPicked] = useState<{
    readonly key: string | null;
    readonly selection: TreeSelection;
  } | null>(null);
  const selection = picked?.key === key ? picked.selection : NOTHING;
  const setSelection = (next: TreeSelection): void =>
    setPicked({key, selection: next});
  // NOTE(0913vision): Changing sources checks nothing (spec 05), also when
  // the operator returns to one they checked items in.
  const choose = (next: ServiceSource): void => {
    if (key === sourceKey(next)) return;
    setChosen(next);
    setPicked(null);
  };
  const itemIds = selectedIds(rows, selection);

  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const serviceId = asServiceId(currentId);
  const reason = readOnly
    ? READ_ONLY
    : itemIds.length === 0
      ? NONE_PICKED
      : undefined;
  const canImport =
    serviceId !== null && document !== null && reason === undefined && !busy;
  const importItems = (): void => {
    if (api === undefined || serviceId === null || !canImport) return;
    if (source === null || source.kind === 'empty') return;
    setBusy(true);
    api.content
      .edit({
        type: 'service.importItems',
        serviceId,
        from: source,
        itemIds: [...itemIds],
      })
      .then(editApplied, (cause: unknown) => {
        logFailure(api, 'Could not import service items', cause);
        return false;
      })
      .then(done => {
        if (!alive.current) return;
        setBusy(false);
        if (done) onDone();
        else onProblem(warningNotice('import-items:failed', FAILED));
      })
      .catch((cause: unknown) => {
        console.error('Failed to finish importing service items:', cause);
      });
  };

  return {
    lists,
    templates: lists.templates,
    services,
    source,
    choose,
    missing,
    rows,
    selection,
    setSelection,
    reason,
    busy,
    canImport,
    importItems,
  };
}
