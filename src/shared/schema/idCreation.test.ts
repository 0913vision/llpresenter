import {describe, expect, it} from 'vitest';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
  createTemplateId,
  createMediaId,
  createMessageId,
  createMediaPlaylistId,
  createAudioPlaylistId,
  createQuickItemId,
  createMessageTemplateId,
} from './ids';

const UUID = '00000000-0000-4000-8000-00000000000a';
const factories = {
  song: createSongId,
  service: createServiceId,
  template: createTemplateId,
  item: createServiceItemId,
  media: createMediaId,
  message: createMessageId,
  mediaPlaylist: createMediaPlaylistId,
  audioPlaylist: createAudioPlaylistId,
  quickItem: createQuickItemId,
  messageTemplate: createMessageTemplateId,
};

describe.each(Object.entries(factories))(
  '%s id creation',
  (_name, createId) => {
    it('accepts a generated lowercase version 4 UUID without changing it', () => {
      expect(createId(UUID)).toBe(UUID);
    });

    it.each([
      '',
      'not-an-id',
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-1000-8000-000000000001',
      '00000000-0000-4000-7000-000000000001',
      UUID.toUpperCase(),
    ])('refuses %j before branding it', value => {
      expect(() => createId(value)).toThrow();
    });
  },
);
