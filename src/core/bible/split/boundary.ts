export interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

// NOTE(0913vision): These tables and penalties follow Copible 1.6's boundary rules.

const FINAL_LAST = new Set(['다', '라', '까', '냐', '뇨', '오', '요', '되']);

const CLAUSE_LAST = new Set([
  '니',
  '며',
  '고',
  '매',
  '면',
  '늘',
  '즉',
  '사',
  '여',
  '든',
]);

const NEEDS_PREV: Readonly<Record<string, ReadonlySet<string>>> = {
  가: new Set(['다']),
  와: new Set(['니']),
  서: new Set(['아', '어', '여']),
  데: new Set(['는', '은', '인']),
  로: new Set(['므']),
  도: new Set(['라', '지']),
  나: new Set(['으', '거', '더']),
};

const PARTICLE_LAST = new Set([
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '게',
  '도',
  '와',
  '과',
  '로',
  '서',
  '만',
  '데',
  '나',
  '터',
  '럼',
  '희',
  '들',
  '께',
]);

const PARTICLE_TAIL_RE = /(?:마다|처럼|같이|대로|부터|까지|조차|마저|밖에)$/;

const FORWARD_RE = /(?:도록|토록|고자|려고)$/;

const QUOTATIVE_NEXT_RE = /^(하|이르)(시|였|었|니|더|고|매|여|사|되)/;

const SENTENCE_END_RE = /[.!?…]['"”’)\]】」』]*$/;

const BOUND_NOUNS = [
  '것',
  '수',
  '바',
  '때',
  '줄',
  '뿐',
  '만',
  '채',
  '데',
  '지',
  '자',
  '듯',
  '등',
  '및',
  '따름',
  '터',
  '적',
  '쪽',
  '편',
  '년',
  '월',
  '일',
  '번',
  '명',
];

const DETERMINERS = new Set([
  '그',
  '이',
  '저',
  '한',
  '두',
  '세',
  '네',
  '모든',
  '온',
  '각',
  '어떤',
  '무슨',
  '여러',
  '새',
  '다른',
  '어느',
  '온갖',
  '갖은',
  '첫',
  '옛',
  '뭇',
  '많은',
  '적은',
  '그의',
  '나의',
  '주의',
  '그들의',
  '우리의',
]);

export const PENALTY_SENTENCE = 0;
export const PENALTY_CLAUSE = 14;
export const PENALTY_WORD = 45;
export const PENALTY_PARTICLE = 80;
export const PENALTY_FORWARD = 95;
export const PENALTY_MAX = 100;

const CLASS_PENALTY = {
  final: PENALTY_SENTENCE,
  clause: PENALTY_CLAUSE,
  other: PENALTY_WORD,
  particle: PENALTY_PARTICLE,
  forward: PENALTY_FORWARD,
};

const syllables = (word: string) => Array.from(word.replace(/[^가-힣]+$/, ''));

export const classifyEnding = (word: string): keyof typeof CLASS_PENALTY => {
  if (SENTENCE_END_RE.test(word)) return 'final';
  if (FORWARD_RE.test(word)) return 'forward';
  if (PARTICLE_TAIL_RE.test(word)) return 'particle';

  const chars = syllables(word);
  if (!chars.length) return 'other';

  const last = chars.at(-1) ?? '';
  const prev = chars.at(-2) ?? '';

  const need = NEEDS_PREV[last];
  if (need) return need.has(prev) ? 'clause' : 'particle';

  if (chars.length < 2) return 'other';

  if (FINAL_LAST.has(last)) return 'final';
  if (CLAUSE_LAST.has(last)) return 'clause';
  if (PARTICLE_LAST.has(last)) return 'particle';
  return 'other';
};

export const tokenize = (text: string): Token[] => {
  const tokens = [];
  const re = /\S+/g;
  let m = re.exec(text);
  while (m !== null) {
    tokens.push({text: m[0], start: m.index, end: m.index + m[0].length});
    m = re.exec(text);
  }
  return tokens;
};

const isParallel = (left: string, right: string) => {
  const a = syllables(left);
  const b = syllables(right);
  return (
    a.length >= 2 &&
    b.length >= 2 &&
    a[a.length - 1] === b[b.length - 1] &&
    a[a.length - 2] === b[b.length - 2]
  );
};

export const boundaryPenalty = (left: string, right: string) => {
  let cls = classifyEnding(left);
  if (cls === 'final' && QUOTATIVE_NEXT_RE.test(right)) cls = 'clause';
  if (cls === 'particle' && isParallel(left, right)) cls = 'clause';

  let penalty = CLASS_PENALTY[cls];
  if (DETERMINERS.has(left)) penalty += 35;
  if (
    right &&
    Array.from(right).length <= 4 &&
    BOUND_NOUNS.some(n => right.startsWith(n))
  ) {
    penalty += 25;
  }
  return Math.min(penalty, PENALTY_MAX);
};

export const penaltyLabel = (p: number) => {
  if (p <= PENALTY_SENTENCE + 4) return '문장끝';
  if (p <= PENALTY_CLAUSE + 6) return '절경계';
  if (p <= PENALTY_WORD + 5) return '어절';
  if (p <= PENALTY_PARTICLE + 5) return '조사뒤';
  return '약함';
};
