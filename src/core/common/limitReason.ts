import {topicParticle} from './korean';

/**
 * What a control says when a list has reached its limit, for example "테마는
 * 200개까지 추가할 수 있습니다". This is the one sentence for every limit in the
 * app.
 */
export function limitReason(noun: string, max: number, verb = '추가'): string {
  return `${noun}${topicParticle(noun)} ${max}개까지 ${verb}할 수 있습니다.`;
}
