import type {OutputScreenStatus} from '@core/schema/outputStatus';

export function ndiAccelerationLabel(
  status: OutputScreenStatus | undefined,
): string {
  if (status?.ndiAcceleration === 'hardware') return '하드웨어 가속';
  if (status?.ndiAcceleration === 'bitmap') return '하드웨어 가속 안 됨';
  return '하드웨어 가속 확인 중';
}

export function ndiAccelerationReason(
  status: OutputScreenStatus | undefined,
): string | undefined {
  if (status?.ndiAcceleration !== 'bitmap') return undefined;
  switch (status.ndiAccelerationReason) {
    case 'disabled':
      return '설정에서 하드웨어 가속이 꺼져 있습니다';
    case 'no-texture':
      return '공유 텍스처 프레임을 받지 못했습니다';
    case 'compositor':
      return 'GPU 합성을 사용할 수 없습니다';
    case 'error':
    case undefined:
      return 'GPU 출력에 실패하여 비트맵 출력으로 전환했습니다';
  }
}
