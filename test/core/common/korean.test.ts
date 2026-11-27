import {describe, expect, it} from 'vitest';
import {
  objectParticle,
  subjectParticle,
  topicParticle,
  withParticle,
} from '@core/common/korean';

describe('objectParticle', () => {
  it.each([
    ['모니터 2', '를'],
    ['모니터 3', '을'],
    ['모니터 10', '을'],
    ['EPSON 프로젝터', '를'],
    ['청중 화면', '을'],
    ['NDI', '를'],
    ['HDMI', '를'],
    ['모니터 1 (HDMI)', '를'],
    ['캡처용 창', '을'],
    ['', '를'],
  ])('puts %s before the particle %s', (word, particle) => {
    expect(objectParticle(word)).toBe(particle);
  });
});

describe('withParticle', () => {
  it.each([
    ['출력 켜기', '와'],
    ['평상시', '와'],
    ['가사 지우기', '와'],
    ['다음 슬라이드', '와'],
    ['Ctrl 1', '과'],
  ])('puts %s before the particle %s', (word, particle) => {
    expect(withParticle(word)).toBe(particle);
  });
});

describe('subjectParticle', () => {
  it.each([
    ['0.233.1', '이'],
    ['0.233.2', '가'],
    ['0.233.10', '이'],
    ['0.234.5', '가'],
    ['청중 화면', '이'],
    ['NDI', '가'],
  ])('puts %s before the particle %s', (word, particle) => {
    expect(subjectParticle(word)).toBe(particle);
  });
});

describe('topicParticle', () => {
  it.each([
    ['창세기', '는'],
    ['요한복음', '은'],
    ['시편', '은'],
    ['테마', '는'],
    ['동작', '은'],
    ['NDI', '는'],
    ['모니터 3', '은'],
  ])('puts %s before the particle %s', (word, particle) => {
    expect(topicParticle(word)).toBe(particle);
  });
});
