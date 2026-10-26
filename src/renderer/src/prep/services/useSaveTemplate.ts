import {useEffect, useRef, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {ServiceId, TemplateId} from '@shared/schema/ids';
import {useShow} from '@renderer/state/show';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {
  appliedId,
  asServiceId,
  editApplied,
  settle,
  warningNotice,
} from './serviceEdits';

type SaveTemplateApi = Pick<LlpApi, 'content' | 'templates' | 'log'>;

/** A 틀 with the open service's name already exists; the operator decides. */
export interface TemplateConflict {
  readonly name: string;
}

interface PendingConflict extends TemplateConflict {
  readonly serviceId: ServiceId;
  readonly existing: TemplateId;
  readonly taken: ReadonlySet<string>;
}

const problemTitles = {
  'not-saved': '틀로 저장할 수 없음',
  'not-replaced': '기존 틀을 지울 수 없음',
} as const;

type SaveProblem = keyof typeof problemTitles;

// NOTE(0913vision): The first of `주일 예배 2`, `주일 예배 3`, and so on that no
// 틀 has, as main names a new song's copy.
function freeName(base: string, taken: ReadonlySet<string>): string {
  let number = 2;
  while (taken.has(`${base} ${number}`)) number++;
  return `${base} ${number}`;
}

function savedNotice(name: string): Notice {
  return {
    key: 'save-template:saved',
    kind: 'info',
    icon: 'frame',
    title: `‘${name}’ 틀로 저장됨`,
    time: noticeTime(),
  };
}

// NOTE(0913vision): Overwriting saves the new 틀 first and then deletes the old
// one, so a failure never loses the 틀 the operator had.
async function writeTemplate({
  api,
  serviceId,
  name,
  replace,
}: {
  readonly api: SaveTemplateApi;
  readonly serviceId: ServiceId;
  readonly name: string;
  readonly replace?: TemplateId | undefined;
}): Promise<SaveProblem | null> {
  const saved = await settle(api, 'Could not save a 틀', () =>
    api.content.edit({type: 'service.saveAsTemplate', serviceId, name}),
  );
  if (saved === undefined || appliedId(saved) === null) return 'not-saved';
  if (replace === undefined) return null;
  const removed = await settle(api, 'Could not delete a 틀', () =>
    api.content.edit({type: 'template.delete', templateId: replace}),
  );
  return removed !== undefined && editApplied(removed) ? null : 'not-replaced';
}

/**
 * 지금 예배를 틀로 저장: saves a copy of the open service as a 틀 named after
 * it. When a 틀 has that name, `conflict` asks whether to save a new 틀 (with
 * the next free name, such as 주일 예배 2) or overwrite it.
 */
export function useSaveTemplate({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}) {
  const api = window.llp;
  const currentId = useShow(view => view.serviceId);
  const currentName = useShow(view => view.serviceName);
  const [conflict, setConflict] = useState<PendingConflict | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const serviceId = asServiceId(currentId);
  const report = (problem: SaveProblem | null, name: string): void => {
    onProblem(
      problem === null
        ? savedNotice(name)
        : warningNotice(`save-template:${problem}`, problemTitles[problem]),
    );
  };
  const finish = (write: Promise<SaveProblem | null>, name: string): void => {
    write
      .then(problem => {
        if (!alive.current) return;
        setBusy(false);
        setConflict(null);
        report(problem, name);
      })
      .catch((cause: unknown) => {
        console.error('Failed to finish saving a 틀:', cause);
      });
  };

  const save = (): void => {
    if (api === undefined || serviceId === null || busy) return;
    const name = currentName;
    setBusy(true);
    settle(api, 'Could not read the 틀 list', () => api.templates.list())
      .then(entries => {
        if (!alive.current) return;
        if (entries === undefined) {
          setBusy(false);
          report('not-saved', name);
          return;
        }
        const existing = entries.find(entry => entry.name === name);
        if (existing === undefined) {
          finish(writeTemplate({api, serviceId, name}), name);
          return;
        }
        setBusy(false);
        setConflict({
          name,
          serviceId,
          existing: existing.id,
          taken: new Set(entries.map(entry => entry.name)),
        });
      })
      .catch((cause: unknown) => {
        console.error('Failed to start saving a 틀:', cause);
      });
  };

  const saveNew = (): void => {
    if (api === undefined || conflict === null || busy) return;
    const name = freeName(conflict.name, conflict.taken);
    setBusy(true);
    finish(writeTemplate({api, serviceId: conflict.serviceId, name}), name);
  };
  const overwrite = (): void => {
    if (api === undefined || conflict === null || busy) return;
    const {name} = conflict;
    setBusy(true);
    finish(
      writeTemplate({
        api,
        serviceId: conflict.serviceId,
        name,
        replace: conflict.existing,
      }),
      name,
    );
  };
  const cancel = (): void => {
    if (!busy) setConflict(null);
  };

  return {
    canSave: serviceId !== null && !busy,
    save,
    conflict: conflict === null ? null : {name: conflict.name},
    busy,
    saveNew,
    overwrite,
    cancel,
  };
}
