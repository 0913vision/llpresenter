import {
  parseServiceDocument,
  type ServiceChange,
  type ServiceDocument,
} from '@core/schema/contentDocuments';
import type {EditResult} from '@core/schema/contentEdit';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
} from '@core/schema/ids';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {editorFixture} from '@renderer/features/songs/editor/editorFixture';

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

export const fixtureMedia = {
  warm: createMediaId('60000000-0000-4000-8000-000000000011'),
  dawn: createMediaId('60000000-0000-4000-8000-000000000012'),
  hymn: createMediaId('60000000-0000-4000-8000-000000000013'),
} as const;
export const fixtureMacros = {
  praise: '70000000-0000-4000-8000-000000000001',
  sermon: '70000000-0000-4000-8000-000000000002',
} as const;

/** Two pictures and one audio file, as the media list holds them. */
export function itemMedia() {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: [
        {
          id: fixtureMedia.warm,
          name: '따뜻한 빛',
          kind: 'image',
          file: 'a.png',
          size: 0,
        },
        {
          id: fixtureMedia.dawn,
          name: '새벽 하늘',
          kind: 'video',
          file: 'b.mp4',
          size: 0,
        },
        {
          id: fixtureMedia.hymn,
          name: '찬송 반주',
          kind: 'audio',
          file: 'c.mp3',
          size: 0,
        },
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value;
}

/** Two invented 매크로 with one action each. */
export function itemMacros() {
  const parsed = parseSettingsDocument({
    name: 'macros',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llsettings.macros',
      schemaVersion: 1,
      macros: [
        {
          id: fixtureMacros.praise,
          name: '찬양',
          icon: 'music-notes',
          color: 'teal',
          actions: [{kind: 'audio', operation: 'fadeOut'}],
        },
        {
          id: fixtureMacros.sermon,
          name: '설교',
          icon: 'book',
          color: 'violet',
          actions: [{kind: 'audio', operation: 'fadeOut'}],
        },
      ],
      collections: [],
    },
  });
  if (!parsed.ok || parsed.value.name !== 'macros') {
    throw new Error('Invalid macros fixture');
  }
  return parsed.value;
}

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
  const media = itemMedia();
  const macros = itemMacros();
  const api = {
    ...editor.api,
    media: {...editor.api.media, get: () => Promise.resolve(media)},
    settings: {
      ...editor.api.settings,
      get: (request: Parameters<typeof editor.api.settings.get>[0]) =>
        request.name === 'macros'
          ? Promise.resolve(macros)
          : editor.api.settings.get(request),
    },
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
