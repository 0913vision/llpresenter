import {describe, expect, it} from 'vitest';
import {
  ndiAccelerationLabel,
  ndiAccelerationReason,
} from '@renderer/features/screens/ndiAcceleration';

describe('NDI acceleration status', () => {
  it('reports the active path and the reason for bitmap fallback', () => {
    const base = {
      placement: 'ndi',
      renderer: 'running',
      fps: 30,
      fpsLow: false,
    } as const;
    expect(ndiAccelerationLabel({...base, ndiAcceleration: 'pending'})).toBe(
      '하드웨어 가속 확인 중',
    );
    expect(ndiAccelerationLabel({...base, ndiAcceleration: 'hardware'})).toBe(
      '하드웨어 가속',
    );
    const fallback = {
      ...base,
      ndiAcceleration: 'bitmap',
      ndiAccelerationReason: 'no-texture',
    } as const;
    expect(ndiAccelerationLabel(fallback)).toBe('하드웨어 가속 안 됨');
    expect(ndiAccelerationReason(fallback)).toContain('공유 텍스처');
    expect(
      ndiAccelerationReason({
        ...base,
        ndiAcceleration: 'bitmap',
        ndiAccelerationReason: 'disabled',
      }),
    ).toContain('꺼져');
  });
});
