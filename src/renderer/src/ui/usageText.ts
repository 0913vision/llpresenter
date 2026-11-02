import {countedMeta} from './countedMeta';

/** The one name of the place a thing is used, in labels and tooltips. */
export const USAGE_LABEL = '쓰는 곳';
export const USAGE_LOADING = '쓰는 곳을 확인하는 중';
export const USAGE_UNAVAILABLE = '쓰는 곳을 확인할 수 없습니다';

/** The line a delete question shows: `쓰는 곳: 예배 2곳`; nothing at 0. */
export function usageMeta(count: number, where: string): readonly string[] {
  return countedMeta(count, `${USAGE_LABEL}: ${where} ${count}곳`);
}
