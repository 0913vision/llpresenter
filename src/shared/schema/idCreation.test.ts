import {describe, expect, it} from 'vitest';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
  createTemplateId,
} from './ids';

const UUID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
const factories = {
  song: createSongId,
  service: createServiceId,
  template: createTemplateId,
  item: createServiceItemId,
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
      '6f1c2a9e-4b7d-1c1a-9e2f-0123456789ab',
      '6f1c2a9e-4b7d-4c1a-7e2f-0123456789ab',
      UUID.toUpperCase(),
    ])('refuses %j before branding it', value => {
      expect(() => createId(value)).toThrow();
    });
  },
);
