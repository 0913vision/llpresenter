import {describe, expect, it} from 'vitest';
import {serviceTitle} from '@core/slides/titles';

describe('serviceTitle', () => {
  it('finds a service title card by its name', () => {
    expect(serviceTitle('축도').name).toBe('축도');
  });

  it('refuses a name that is not a service title', () => {
    expect(() => serviceTitle('없는 순서')).toThrow('No title 없는 순서');
  });
});
