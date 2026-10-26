import {
  parseServiceDocument,
  type ServiceChange,
  type ServiceDocument,
} from '@shared/schema/contentDocuments';
import type {EditResult} from '@shared/schema/contentEdit';
import {createServiceId, createServiceItemId} from '@shared/schema/ids';
import {editorFixture} from '@renderer/prep/editor/editorFixture';

export const fixtureServiceId = createServiceId(
  '40000000-0000-4000-8000-000000000001',
);
export const fixtureItems = {
  header: createServiceItemId('50000000-0000-4000-8000-000000000001'),
  arranged: createServiceItemId('50000000-0000-4000-8000-000000000002'),
  plain: createServiceItemId('50000000-0000-4000-8000-000000000003'),
  slot: createServiceItemId('50000000-0000-4000-8000-000000000004'),
  lost: createServiceItemId('50000000-0000-4000-8000-000000000005'),
} as const;

function serviceDocument(value: unknown): ServiceDocument {
  const parsed = parseServiceDocument(value);
  if (!parsed.ok || parsed.value === null) {
    throw new Error('Invalid service fixture');
  }
  return parsed.value;
}

/**
 * The editor fixture plus one invented 예배 순서 that main revises and pushes
 * on `service.update`, without disk or output commands.
 */
export function itemFixture() {
  const editor = editorFixture();
  const services = new Set<(change: ServiceChange) => void>();
  let service = serviceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: fixtureServiceId,
      name: '주일 예배',
      date: '2026-10-25T11:00',
      order: [
        {id: fixtureItems.header, header: '찬양'},
        {
          id: fixtureItems.arranged,
          song: editor.first.song.id,
          arrangement: '주일용',
          memo: '천천히',
          future: {keep: true},
        },
        {id: fixtureItems.plain, song: editor.second.song.id},
        {id: fixtureItems.slot, slot: 'song', title: '헌금 찬양'},
        {
          id: fixtureItems.lost,
          song: editor.first.song.id,
          arrangement: '사라진 구성',
        },
      ],
    },
    revision: 3,
    access: 'editable',
  });
  const pushService = (document: ServiceDocument): void => {
    service = document;
    for (const listener of services) {
      listener({serviceId: document.service.id, document});
    }
  };
  const refuse = (reason: 'not-found' | 'stale' | 'invalid'): EditResult => ({
    ok: false,
    error: {reason, message: 'Fixture refusal'},
  });
  const api = {
    ...editor.api,
    services: {
      ...editor.api.services,
      get: (id: string) =>
        Promise.resolve(id === service.service.id ? service : null),
      subscribe: (listener: (change: ServiceChange) => void) => {
        services.add(listener);
        return () => {
          services.delete(listener);
        };
      },
    },
    content: {
      edit: async (
        edit: Parameters<typeof editor.api.content.edit>[0],
      ): Promise<EditResult> => {
        if (edit.type !== 'service.update') {
          return editor.api.content.edit(edit);
        }
        await Promise.resolve();
        editor.edits.push(edit);
        if (edit.service.id !== service.service.id) return refuse('not-found');
        if (edit.baseRevision !== service.revision) return refuse('stale');
        pushService(
          serviceDocument({
            ...service,
            service: edit.service,
            revision: service.revision + 1,
          }),
        );
        return {
          ok: true,
          value: {id: service.service.id, revision: service.revision},
        };
      },
    },
  };
  return {
    ...editor,
    api,
    service: () => service,
    pushService,
    serviceListeners: () => services.size,
  };
}
