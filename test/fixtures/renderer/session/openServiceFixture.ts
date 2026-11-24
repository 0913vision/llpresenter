import {onTestFinished, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  ServiceChange,
  ServiceDocument,
} from '@core/schema/services/contentDocuments';
import type {ContentEdit, EditResult} from '@core/schema/services/contentEdit';
import {createServiceId, createServiceItemId} from '@core/schema/common/ids';
import {hasSlides, type ServiceItem} from '@core/schema/services/service';
import {itemTiles, itemTitle} from '@core/slides/tiles';
import {applyService} from '@renderer/session/show';
import {startOpenServiceSync} from '@renderer/session/openService';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

export const SERVICE = createServiceId('00000000-0000-4000-8000-000000000001');

export function itemId(number: number) {
  return createServiceItemId(
    `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
}

/** A service that is open in a window whose main process keeps every edit. */
export function openServiceFixture(
  order: readonly ServiceItem[],
  {
    api: more = {},
    readOnly = false,
  }: {
    readonly api?: Parameters<typeof mockLlpApi>[0];
    readonly readOnly?: boolean;
  } = {},
) {
  let document: ServiceDocument = {
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE,
      name: '주일 예배',
      date: '2026-11-01T11:00',
      order: [...order],
    },
    revision: 1,
    access: readOnly ? 'readOnly' : 'editable',
  };
  const listeners = new Set<(change: ServiceChange) => void>();
  const publish = (): void => {
    applyService({
      id: SERVICE,
      revision: document.revision,
      name: document.service.name,
      readOnly,
      rows: document.service.order.map(item =>
        hasSlides(item)
          ? {kind: item.kind, id: item.id, title: itemTitle(item)}
          : {kind: 'header', id: item.id, title: item.name},
      ),
      tiles: Object.fromEntries(
        document.service.order.flatMap(item =>
          hasSlides(item) ? [[item.id, itemTiles(item, new Map())]] : [],
        ),
      ),
    });
    for (const listener of listeners) {
      listener({serviceId: SERVICE, document});
    }
  };
  const replace = (next: Partial<ServiceDocument['service']>): void => {
    document = {
      ...document,
      service: {...document.service, ...next},
      revision: document.revision + 1,
    };
    publish();
  };
  const edit = vi.fn<LlpApi['content']['edit']>(
    (command: ContentEdit): Promise<EditResult> => {
      if (command.type !== 'service.update') {
        return Promise.reject(new Error(`Unexpected ${command.type}`));
      }
      if (command.baseRevision !== document.revision) {
        return Promise.resolve({
          ok: false,
          error: {reason: 'stale', message: 'Invented conflict'},
        });
      }
      replace(command.service);
      return Promise.resolve({
        ok: true,
        value: {id: SERVICE, revision: document.revision},
      });
    },
  );
  const api = mockLlpApi({
    ...more,
    services: {
      get: () => Promise.resolve(document),
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    content: {edit},
  });
  window.llp = api;
  applyService(null);
  publish();
  const stop = startOpenServiceSync();
  onTestFinished(() => {
    stop();
    applyService(null);
    delete window.llp;
  });
  publish();
  return {
    api,
    edit,
    /** The order main has. */
    order: () => document.service.order,
    item: (id: ServiceItem['id']) =>
      document.service.order.find(entry => entry.id === id),
    /** Another window changes the service. */
    replace,
  };
}
