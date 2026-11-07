/** The topic particle for a name: 는 after a vowel, 은 after a final consonant. */
function topicParticle(noun: string): string {
  const last = noun.codePointAt(noun.length - 1) ?? 0;
  const syllable = last - 0xac00;
  if (syllable < 0 || syllable > 11171) return '은';
  return syllable % 28 === 0 ? '는' : '은';
}

/**
 * What a control says when a list has reached its limit, for example "테마는
 * 200개까지 추가할 수 있습니다". This is the one sentence for every limit in the
 * app.
 */
export function limitReason(noun: string, max: number, verb = '추가'): string {
  return `${noun}${topicParticle(noun)} ${max}개까지 ${verb}할 수 있습니다`;
}
