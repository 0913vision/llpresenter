import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {serviceIdSchema, type ServiceId} from '@shared/schema/ids';
import {parsePayload} from '@shared/schema/payload';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {logFailure} from './useServiceSources';

/**
 * Whether an edit took effect. A failed save still did: main keeps the edit
 * and saves it later.
 */
export function editApplied(result: EditResult): boolean {
  return result.ok || result.error.reason === 'write-failed';
}

/** The id of the document an edit made or changed, if it took effect. */
export function appliedId(result: EditResult): string | null {
  if (result.ok) return result.value.id;
  return result.error.reason === 'write-failed'
    ? result.error.applied.id
    : null;
}

/** A 예배 순서 id from the show state or an edit's answer, if it is one. */
export function asServiceId(id: string | null): ServiceId | null {
  if (id === null) return null;
  const parsed = parsePayload(serviceIdSchema, id);
  return parsed.ok ? parsed.value : null;
}

/** A warning card from the service dialogs, such as 새 예배를 만들 수 없음. */
export function warningNotice(key: string, title: string): Notice {
  return {key, kind: 'warning', icon: 'warning', title, time: noticeTime()};
}

/**
 * Runs one step of a flow. A rejected call is logged with `what` and answers
 * `undefined`, so each step can tell its own failure apart.
 */
export async function settle<T>(
  api: Pick<LlpApi, 'log'>,
  what: string,
  run: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await run();
  } catch (cause) {
    logFailure(api, what, cause);
    return undefined;
  }
}

export async function renameService(
  api: Pick<LlpApi, 'services' | 'content' | 'log'>,
  serviceId: ServiceId,
  name: string,
): Promise<boolean> {
  const document = await settle(api, 'Could not read a service', () =>
    api.services.get(serviceId),
  );
  if (!document) return false;
  const result = await settle(api, 'Could not rename a service', () =>
    api.content.edit({
      type: 'service.update',
      service: {...document.service, name},
      baseRevision: document.revision,
    }),
  );
  return result !== undefined && editApplied(result);
}
