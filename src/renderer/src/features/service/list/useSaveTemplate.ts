import {useEffect, useRef, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {freeName} from '@core/common/freeName';
import type {ServiceId, TemplateId} from '@core/schema/ids';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/notices';
import {
  appliedId,
  asServiceId,
  editApplied,
  settle,
  warningNotice,
} from './serviceEdits';

type SaveTemplateApi = Pick<LlpApi, 'content' | 'templates' | 'log'>;
interface TemplateService {
  readonly id: ServiceId;
  readonly name: string;
}

/** A 템플릿 with the open service's name already exists; the operator decides. */
export interface TemplateConflict {
  readonly name: string;
}

interface PendingConflict extends TemplateConflict {
  readonly serviceId: ServiceId;
  readonly existing: TemplateId;
  readonly taken: ReadonlySet<string>;
}

const problemTitles = {
  'not-saved': '템플릿으로 저장할 수 없음',
  'not-replaced': '기존 템플릿을 지울 수 없음',
} as const;

type SaveProblem = keyof typeof problemTitles;

// NOTE(0913vision): Overwriting saves the new 템플릿 first and deletes the old one
// only once the new one is on disk, so a failure or a crash never loses the
// 템플릿 the operator had. A new 템플릿 that main holds only in memory (write-failed)
// keeps the old one; main's 저장할 수 없음 card tells the operator.
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
  const saved = await settle(api, 'Could not save a 템플릿', () =>
    api.content.edit({type: 'service.saveAsTemplate', serviceId, name}),
  );
  if (saved === undefined || appliedId(saved) === null) return 'not-saved';
  if (replace === undefined || !saved.ok) return null;
  const removed = await settle(api, 'Could not delete a 템플릿', () =>
    api.content.edit({type: 'template.delete', templateId: replace}),
  );
  return removed !== undefined && editApplied(removed) ? null : 'not-replaced';
}

/**
 * 지금 예배를 템플릿으로 저장: saves a copy of the open service as a 템플릿 named after
 * it. When a 템플릿 has that name, `conflict` asks whether to save a new 템플릿 (with
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
  // NOTE(0913vision): A save that works shows nothing: spec 08 keeps the
  // notifications for what the operator didn't do themselves.
  const report = (problem: SaveProblem | null): void => {
    if (problem === null) return;
    onProblem(
      warningNotice(`save-template:${problem}`, problemTitles[problem]),
    );
  };
  const finish = (write: Promise<SaveProblem | null>): void => {
    write
      .then(problem => {
        if (!alive.current) return;
        setBusy(false);
        setConflict(null);
        report(problem);
      })
      .catch((cause: unknown) => {
        console.error('Failed to finish saving a 템플릿:', cause);
      });
  };

  const save = (target?: TemplateService): void => {
    const id = target?.id ?? serviceId;
    if (api === undefined || id === null || busy) return;
    const name = target?.name ?? currentName;
    setBusy(true);
    settle(api, 'Could not read the 템플릿 list', () => api.templates.list())
      .then(entries => {
        if (!alive.current) return;
        if (entries === undefined) {
          setBusy(false);
          report('not-saved');
          return;
        }
        const existing = entries.find(entry => entry.name === name);
        if (existing === undefined) {
          finish(writeTemplate({api, serviceId: id, name}));
          return;
        }
        setBusy(false);
        setConflict({
          name,
          serviceId: id,
          existing: existing.id,
          taken: new Set(entries.map(entry => entry.name)),
        });
      })
      .catch((cause: unknown) => {
        console.error('Failed to start saving a 템플릿:', cause);
      });
  };

  const saveNew = (): void => {
    if (api === undefined || conflict === null || busy) return;
    const name = freeName(conflict.name, conflict.taken);
    setBusy(true);
    finish(writeTemplate({api, serviceId: conflict.serviceId, name}));
  };
  const overwrite = (): void => {
    if (api === undefined || conflict === null || busy) return;
    setBusy(true);
    finish(
      writeTemplate({
        api,
        serviceId: conflict.serviceId,
        name: conflict.name,
        replace: conflict.existing,
      }),
    );
  };
  const cancel = (): void => {
    if (!busy) setConflict(null);
  };

  return {
    canSave: serviceId !== null && !busy,
    save: () => save(),
    saveService: (target: TemplateService) => save(target),
    conflict: conflict === null ? null : {name: conflict.name},
    busy,
    saveNew,
    overwrite,
    cancel,
  };
}
