import type {LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/services/contentEdit';
import {copyName} from '@core/common/copyName';
import {
  createServiceItemId,
  serviceIdSchema,
  type ServiceId,
  type TemplateId,
} from '@core/schema/common/ids';
import {parsePayload} from '@core/schema/common/payload';
import {renameHistory} from '@renderer/platform/undo/renameHistory';
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

/** Renames a service, resolving false when it could not be read or saved. */
export async function renameService(
  api: Pick<LlpApi, 'services' | 'content' | 'log'>,
  serviceId: ServiceId,
  name: string,
): Promise<boolean> {
  const before = await serviceName(api, serviceId);
  const rename = (next: string): Promise<boolean> =>
    writeServiceName(api, serviceId, next);
  const done = await rename(name);
  if (done && before !== null) {
    renameHistory.record({before, after: name, rename});
  }
  return done;
}

/** Renames a 템플릿 as one step of 실행 취소. */
export async function renameTemplate(
  api: Pick<LlpApi, 'templates' | 'content' | 'log'>,
  templateId: TemplateId,
  name: string,
): Promise<boolean> {
  const document = await settle(api, 'Could not read a 템플릿', () =>
    api.templates.get(templateId),
  );
  const rename = (next: string): Promise<boolean> =>
    writeTemplateName(api, templateId, next);
  const done = await rename(name);
  if (done && document) {
    renameHistory.record({before: document.template.name, after: name, rename});
  }
  return done;
}

async function serviceName(
  api: Pick<LlpApi, 'services' | 'log'>,
  serviceId: ServiceId,
): Promise<string | null> {
  const document = await settle(api, 'Could not read a service', () =>
    api.services.get(serviceId),
  );
  return document ? document.service.name : null;
}

// NOTE(0913vision): A rename sends the whole document with the revision it
// was read at, as every `*.update` does; main refuses it as stale when the
// document changed in between.
async function writeServiceName(
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
  return result?.ok === true;
}

async function writeTemplateName(
  api: Pick<LlpApi, 'templates' | 'content' | 'log'>,
  templateId: TemplateId,
  name: string,
): Promise<boolean> {
  const document = await settle(api, 'Could not read a 템플릿', () =>
    api.templates.get(templateId),
  );
  if (!document) return false;
  const result = await settle(api, 'Could not rename a 템플릿', () =>
    api.content.edit({
      type: 'template.update',
      template: {...document.template, name},
      baseRevision: document.revision,
    }),
  );
  return result?.ok === true;
}

/**
 * A copy of a 예배: a new service file with the copy name, the same date, and
 * the same items and settings (each item with a new id).
 *
 * When the copy cannot be filled, the empty new service is deleted again, as
 * far as that works.
 *
 * @returns Whether the copy was made.
 */
export async function duplicateService(
  api: Pick<LlpApi, 'services' | 'content' | 'log'>,
  serviceId: ServiceId,
): Promise<boolean> {
  const source = await settle(api, 'Could not read a service', () =>
    api.services.get(serviceId),
  );
  const entries = await settle(api, 'Could not list the services', () =>
    api.services.list(),
  );
  if (!source || !entries) return false;
  const name = copyName(
    source.service.name,
    entries.map(entry => entry.name),
  );
  const created = await settle(api, 'Could not copy a service', () =>
    api.content.edit({
      type: 'service.create',
      name,
      date: source.service.date,
      templateId: null,
    }),
  );
  const copyId = created === undefined ? null : appliedId(created);
  const id = asServiceId(copyId);
  if (id === null) return false;
  const fresh = await settle(api, 'Could not read the copy of a service', () =>
    api.services.get(id),
  );
  const result = fresh
    ? await settle(api, 'Could not fill the copy of a service', () =>
        api.content.edit({
          type: 'service.update',
          service: {
            ...source.service,
            id: fresh.service.id,
            name,
            order: source.service.order.map(item => ({
              ...item,
              id: createServiceItemId(crypto.randomUUID()),
            })),
          },
          baseRevision: fresh.revision,
        }),
      )
    : undefined;
  if (result !== undefined && editApplied(result)) return true;
  await settle(api, 'Could not remove the empty copy of a service', () =>
    api.content.edit({type: 'service.delete', serviceId: id}),
  );
  return false;
}
