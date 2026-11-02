import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {expect, it} from 'vitest';

// NOTE(0913vision): Each thing has one name in the app. These are the names
// the B18 sweep replaced; they must not come back in the source.

const ROOT = join(__dirname, '..', '..');

const OLD_NAMES: ReadonlyArray<readonly [string, string]> = [
  ['예배 순서 선택', '예배 선택'],
  ['예배 순서 저장', '예배 저장'],
  ['열린 예배 순서가', '열린 예배가'],
  ['읽기 전용', '새 버전의 파일이라 바꿀 수 없습니다'],
  ['시스템 디스플레이', '시스템 화면'],
  ['내리기', '지우기'],
  ['그룹 넣기', '이름표 넣기'],
  ['슬라이드 넣기', '이름표 넣기'],
  ['사용 항목', '쓰는 곳'],
  ['사용처', '쓰는 곳'],
  ['곳에서 씀', '쓰는 곳'],
  ['동영상', '영상'],
  ['비디오', '영상'],
  ['메시지 템플릿', '메시지 문구'],
  ['메시지 프리셋', '메시지 문구'],
  ['한도 도달', '…는 N개까지 추가할 수 있음'],
  ['가득 찼습니다', '…는 N개까지 추가할 수 있음'],
  ['연결 안 됨', '이 창에서는 쓸 수 없음'],
  ['아직 없는 기능', '이번 버전에서는 쓸 수 없음'],
  ['준비 중입니다', '이번 버전에서는 쓸 수 없음'],
  ['동작 빼기', '동작 삭제'],
  ['모두 빼기', '모두 삭제'],
  ['버리기', '저장 안 함'],
  ['되돌림', '되돌리기'],
  ['머리글', '구역'],
  ['칩 왼쪽', '이름표 왼쪽'],
  ['칩 오른쪽', '이름표 오른쪽'],
  ['타이머 분리', '(removed)'],
  ['(edit undo)', '실행 취소'],
  ['(relink)', '다시 연결'],
  ['(canvas zoom)', '화면에 맞춤'],
  ['UI 확대', '화면 확대'],
  ['UI 축소', '화면 축소'],
  ["'라이브러리 곡',", '곡'],
  ['한도 초과', '…는 N개까지 사용할 수 있음'],
];

function filesUnder(folder: string): string[] {
  return readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** The source lines that are code or text, not comments. */
function codeLines(text: string): string[] {
  return text.split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line));
}

it.each(OLD_NAMES)('has no %s left in the source (use: %s)', old => {
  const found = filesUnder(join(ROOT, 'src'))
    .filter(file => !file.includes(`${sep}gallery${sep}`))
    .filter(file =>
      codeLines(readFileSync(file, 'utf8')).some(line => line.includes(old)),
    )
    .map(file => relative(ROOT, file).split(sep).join('/'));
  expect(found).toEqual([]);
});
