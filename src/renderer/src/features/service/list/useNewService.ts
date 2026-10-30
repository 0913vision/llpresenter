import {useEffect, useMemo, useRef, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {applyService} from '@renderer/features/presentation/state/show';
import type {Notice} from '@renderer/ui/notices';
import {localDate} from './serviceDates';
import {
  appliedId,
  asServiceId,
  editApplied,
  settle,
  warningNotice,
} from './serviceEdits';
import {
  checkAll,
  selectedIds,
  treeRows,
  type TreeSelection,
} from './serviceTree';
import {
  EMPTY_SOURCE,
  listedSource,
  sourceKey,
  useSourceDocument,
  useSourceLists,
  type ServiceSource,
  type SourceDocument,
} from './useServiceSources';

const DEFAULT_NAME = '새 예배';
type CreateProblem = 'not-made' | 'not-copied' | 'not-opened';

const problemTitles: Readonly<Record<CreateProblem, string>> = {
  'not-made': '새 예배를 만들 수 없음',
  'not-copied': '새 예배에 항목을 가져올 수 없음',
  'not-opened': '새 예배를 열 수 없음',
};

type NewServiceApi = Pick<
  LlpApi,
  'content' | 'service' | 'services' | 'templates' | 'songs' | 'log'
>;

function currentHour(): string {
  return `${String(new Date().getHours()).padStart(2, '0')}:00`;
}

function defaultName(document: SourceDocument | null): string {
  if (document === null) return '';
  return document.source.kind === 'empty' ? DEFAULT_NAME : document.name;
}

// NOTE(0913vision): Each step fails on its own. Nothing is made when the
// create fails. When the items can't be copied, the empty service is deleted
// again; if that fails too, it is opened, so the operator lands on it. A
// service that is made is never made twice: every failure after the create
// closes the dialog. Opening it doesn't touch the output.
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
  const [chosen, setChosen] = useState<ServiceSource | null>(null);
  const firstTemplate = lists.templates[0]?.id;
  const fallback = useMemo<ServiceSource | null>(() => {
    if (!lists.ready) return null;
    return firstTemplate === undefined
      ? EMPTY_SOURCE
      : {kind: 'template', id: firstTemplate};
  }, [lists.ready, firstTemplate]);
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
  const selection =
    picked?.key === key ? picked.selection : checkAll(rows, true);
  const setSelection = (next: TreeSelection): void =>
    setPicked({key, selection: next});
  // NOTE(0913vision): Changing sources checks every item again (spec 05),
  // also when the operator returns to a source they changed.
  const choose = (next: ServiceSource): void => {
    if (key === sourceKey(next)) return;
    setChosen(next);
    setPicked(null);
  };

  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? defaultName(document);
  const [today] = useState(() => new Date());
  const [date, setDate] = useState(() => localDate(today));
  const [hour] = useState(currentHour);
  const [typedTime, setTime] = useState<string | null>(null);
  const time = typedTime ?? document?.time ?? hour;

  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const trimmed = name.trim();
  const canCreate = document !== null && trimmed !== '' && !busy;
  const create = (): void => {
    if (api === undefined || document === null || !canCreate) return;
    setBusy(true);
    createService({
      api,
      name: trimmed,
      date: `${date}T${time}`,
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
    source,
    choose,
    document,
    missing,
    rows,
    selection,
    setSelection,
    name,
    setName,
    today,
    date,
    setDate,
    time,
    setTime,
    busy,
    canCreate,
    create,
  };
}
