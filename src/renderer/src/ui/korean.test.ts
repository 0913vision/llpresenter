import {describe, expect, it} from 'vitest';
import {objectParticle} from './korean';

describe('objectParticle', () => {
  it.each([
    ['모니터 2', '를'],
    ['모니터 3', '을'],
    ['모니터 10', '을'],
    ['EPSON 프로젝터', '를'],
    ['본 화면', '을'],
    ['NDI', '를'],
    ['HDMI', '를'],
    ['모니터 1 (HDMI)', '를'],
    ['캡처용 창', '을'],
    ['', '를'],
  ])('puts %s before the particle %s', (word, particle) => {
    expect(objectParticle(word)).toBe(particle);
  });
});
