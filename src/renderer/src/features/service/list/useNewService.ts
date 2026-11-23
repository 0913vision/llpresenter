import {useMemo, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {applyService} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/notices';
import {localDate} from './serviceDates';
import {
  appliedId,
  asServiceId,
  editApplied,
  settle,
  warningNotice,
} from './serviceEdits';
import {checkAll, selectedIds} from './serviceTree';
import {
  EMPTY_SOURCE,
  useSourceLists,
  type ServiceSource,
  type SourceDocument,
} from './useServiceSources';
import {useSourcePick} from './useSourcePick';
import {useAlive} from '@renderer/ui/useAlive';

const DEFAULT_NAME = '새 예배';
type CreateProblem = 'not-made' | 'not-copied' | 'not-opened';

const problemTitles: Readonly<Record<CreateProblem, string>> = {
  'not-made': '새 예배 만들기 실패',
  'not-copied': '항목 가져오기 실패',
  'not-opened': '새 예배 열기 실패',
};

type NewServiceApi = Pick<
  LlpApi,
  'content' | 'service' | 'services' | 'templates' | 'songs' | 'log'
>;

function defaultName(document: SourceDocument | null): string {
  if (document === null) return '';
  return document.source.kind === 'empty' ? DEFAULT_NAME : document.name;
}

// NOTE(0913vision): Each step fails on its own. Nothing is made when the
// create fails. When the items can't be copied, the empty service is deleted
// again; if that fails too, it is opened, so the operator lands on it. A
// service that is made is never made twice: every failure after the create
// closes the dialog. Opening a different service returns output to standby.
async function createService({
  api,
  name,
  date,
  document,
  itemIds,
}: {
  readonly api: NewServiceApi;
  readonly name: string;
  readonly date: string;
  readonly document: SourceDocument;
  readonly itemIds: ReturnType<typeof selectedIds>;
}): Promise<CreateProblem | null> {
  const made = await settle(api, 'Could not create a service', () =>
    api.content.edit({type: 'service.create', name, date, templateId: null}),
  );
  const id = made === undefined ? null : asServiceId(appliedId(made));
  if (id === null) return 'not-made';
  let problem: CreateProblem | null = null;
  const {source} = document;
  if (source.kind !== 'empty' && itemIds.length > 0) {
    const copied = await settle(api, 'Could not copy items to a service', () =>
      api.content.edit({
        type: 'service.importItems',
        serviceId: id,
        from: source,
        itemIds: [...itemIds],
      }),
    );
    if (copied === undefined || !editApplied(copied)) {
      const removed = await settle(api, 'Could not delete a service', () =>
        api.content.edit({type: 'service.delete', serviceId: id}),
      );
      if (removed !== undefined && editApplied(removed)) return 'not-made';
      problem = 'not-copied';
    }
  }
  const opened = await settle(api, 'Could not open a service', () =>
    api.service.open({serviceId: id}),
  );
  if (opened?.id !== id) return problem ?? 'not-opened';
  applyService(opened);
  return problem;
}

/** The state and actions of the 새 예배 dialog. */
export function useNewService({
  onProblem,
  onDone,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly onDone: () => void;
}) {
  const api = window.llp;
  const lists = useSourceLists(api);
  const firstTemplate = lists.templates[0]?.id;
  const fallback = useMemo<ServiceSource | null>(() => {
    if (!lists.ready) return null;
    return firstTemplate === undefined
      ? EMPTY_SOURCE
      : {kind: 'template', id: firstTemplate};
  }, [lists.ready, firstTemplate]);
  // NOTE(0913vision): Changing sources checks every item again (spec 05),
  // also when the operator returns to a source they changed.
  const pick = useSourcePick({
    api,
    lists,
    fallback,
    fresh: rows => checkAll(rows, true),
  });
  const {document, pending, rows, selection} = pick;

  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? defaultName(document);
  const [today] = useState(() => new Date());
  const [date, setDate] = useState(() => localDate(today));

  const [busy, setBusy] = useState(false);
  const alive = useAlive();

  const trimmed = name.trim();
  const canCreate = document !== null && !pending && trimmed !== '' && !busy;
  const create = (): void => {
    if (api === undefined || document === null || !canCreate) return;
    setBusy(true);
    createService({
      api,
      name: trimmed,
      date: `${date}T00:00`,
      document,
      itemIds: selectedIds(rows, selection),
    })
      .then(problem => {
        if (!alive.current) return;
        setBusy(false);
        if (problem !== null) {
          onProblem(
            warningNotice(`new-service:${problem}`, problemTitles[problem]),
          );
        }
        if (problem !== 'not-made') onDone();
      })
      .catch((cause: unknown) => {
        console.error('Failed to finish creating a service:', cause);
      });
  };

  return {
    lists,
    ready: pick.ready,
    source: pick.shown,
    choose: pick.choose,
    document,
    missing: pick.missing,
    rows,
    selection,
    setSelection: pick.setSelection,
    name,
    setName,
    date,
    setDate,
    busy,
    canCreate,
    create,
  };
}
