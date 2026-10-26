import {useEffect, useMemo, useRef, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {serviceIdSchema, type ServiceId} from '@shared/schema/ids';
import {parsePayload} from '@shared/schema/payload';
import {applyService} from '@renderer/state/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {localDate} from './serviceDates';
import {
  checkAll,
  selectedIds,
  treeRows,
  type TreeSelection,
} from './serviceTree';
import {
  EMPTY_SOURCE,
  logFailure,
  sourceKey,
  useSourceDocument,
  useSourceLists,
  type ServiceSource,
  type SourceDocument,
} from './useServiceSources';

const DEFAULT_NAME = '새 예배';
const problemTitles = {
  create: '새 예배를 만들 수 없음',
  open: '새 예배를 열 수 없음',
};

type NewServiceApi = Pick<
  LlpApi,
  'content' | 'service' | 'services' | 'templates' | 'songs' | 'log'
>;

function problemNotice(cause: keyof typeof problemTitles): Notice {
  return {
    key: `new-service:${cause}`,
    kind: 'warning',
    icon: 'warning',
    title: problemTitles[cause],
    time: noticeTime(),
  };
}

// NOTE(0913vision): A failed save still made the service; main saves it later.
function createdId(result: EditResult): ServiceId | null {
  const id = result.ok
    ? result.value.id
    : result.error.reason === 'write-failed'
      ? result.error.applied.id
      : null;
  if (id === null) return null;
  const parsed = parsePayload(serviceIdSchema, id);
  return parsed.ok ? parsed.value : null;
}

function succeeded(result: EditResult): boolean {
  return result.ok || result.error.reason === 'write-failed';
}

function currentHour(): string {
  return `${String(new Date().getHours()).padStart(2, '0')}:00`;
}

function defaultName(document: SourceDocument | null): string {
  if (document === null) return '';
  return document.source.kind === 'empty' ? DEFAULT_NAME : document.name;
}

// NOTE(0913vision): Opening the new service doesn't touch the output. When the
// items can't be copied, the empty service is deleted again, so a refusal
// leaves nothing behind.
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
}): Promise<keyof typeof problemTitles | null> {
  const id = createdId(
    await api.content.edit({
      type: 'service.create',
      name,
      date,
      templateId: null,
    }),
  );
  if (id === null) return 'create';
  const {source} = document;
  if (source.kind !== 'empty' && itemIds.length > 0) {
    const imported = await api.content.edit({
      type: 'service.importItems',
      serviceId: id,
      from: source,
      itemIds: [...itemIds],
    });
    if (!succeeded(imported)) {
      await api.content.edit({type: 'service.delete', serviceId: id});
      return 'create';
    }
  }
  const opened = await api.service.open({serviceId: id});
  if (opened?.id !== id) return 'open';
  applyService(opened);
  return null;
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
  const source = chosen ?? fallback;
  const {document, missing} = useSourceDocument(api, source);
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
      .catch((cause: unknown) => {
        logFailure(api, 'Could not create a service', cause);
        return 'create' as const;
      })
      .then(problem => {
        if (!alive.current) return;
        setBusy(false);
        if (problem !== null) onProblem(problemNotice(problem));
        if (problem !== 'create') onDone();
      })
      .catch((cause: unknown) => {
        console.error('Failed to finish creating a service:', cause);
      });
  };

  return {
    lists,
    source,
    choose: setChosen,
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
