import {warningNotice} from '@renderer/ui/popups/notices';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useMemo, useState} from 'react';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/popups/notices';
import {asServiceId, editApplied} from './serviceEdits';
import {selectedIds, type TreeSelection} from './serviceTree';
import {
  logFailure,
  useSourceLists,
  type ServiceSource,
} from './useServiceSources';
import {useSourcePick} from './useSourcePick';
import {useAlive} from '@renderer/ui/useAlive';

const NOTHING: TreeSelection = new Set();
const NONE_PICKED = '항목을 골라야 가져올 수 있습니다.';
const READ_ONLY = NEWER_FILE_REASON;
const FAILED = '항목 가져오기 실패';

/**
 * The state and actions of the 다른 예배에서 가져오기 dialog. The sources are
 * the 템플릿 and the other services; picking one checks nothing.
 */
export function useImportItems({
  onProblem,
  onDone,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly onDone: (itemId?: string) => void;
}) {
  const api = window.llp;
  const currentId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const lists = useSourceLists(api);
  const services = useMemo(
    () => lists.services.filter(entry => entry.id !== currentId),
    [lists.services, currentId],
  );
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
  // NOTE(0913vision): Changing sources checks nothing (spec 05), also when
  // the operator returns to one they checked items in.
  const pick = useSourcePick({api, lists, fallback, fresh: () => NOTHING});
  const {source, document, pending, rows, selection} = pick;
  const itemIds = selectedIds(rows, selection);

  const [busy, setBusy] = useState(false);
  const alive = useAlive();
  const isAlive = (): boolean => alive.current;

  const serviceId = asServiceId(currentId);
  const reason = readOnly
    ? READ_ONLY
    : itemIds.length === 0
      ? NONE_PICKED
      : undefined;
  const canImport =
    serviceId !== null &&
    document !== null &&
    !pending &&
    reason === undefined &&
    !busy;
  const importItems = (): void => {
    if (api === undefined || serviceId === null || !canImport) return;
    if (source === null || source.kind === 'empty') return;
    const previous = new Set(useShow.getState().rows.map(row => row.id));
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
      .then(async done => {
        if (!isAlive()) return;
        let imported: string | undefined;
        if (done) {
          const document = await api.services
            .get(serviceId)
            .catch((cause: unknown) => {
              logFailure(
                api,
                'Could not select the imported service item',
                cause,
              );
              return null;
            });
          if (!isAlive()) return;
          const added = document?.service.order.find(
            item => !previous.has(item.id),
          );
          if (
            added !== undefined &&
            useShow.getState().serviceId === serviceId
          ) {
            imported = added.id;
          }
        }
        setBusy(false);
        if (done) onDone(imported);
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
    ready: pick.ready,
    source: pick.shown,
    choose: pick.choose,
    document,
    missing: pick.missing,
    rows,
    selection,
    setSelection: pick.setSelection,
    reason,
    busy,
    canImport,
    importItems,
  };
}
