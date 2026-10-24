import {mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export const HYMN_ONE_ID = '6f1c2a9e-4b7d-4c1a-9e2f-0123456789ab';
export const SUNDAY_ID = 'a41e0c52-7e1f-4a2b-8c3d-4e5f60718293';
export const EVENING_ID = 'b52f1d63-8f2a-4b3c-9d4e-5f6071829304';

/** Hymn 1, with two 구성 and an unlabeled 장, as a `.llsong` file holds it. */
export function hymnOne(): Record<string, unknown> {
  return {
    format: 'llsong',
    schemaVersion: 1,
    id: HYMN_ONE_ID,
    title: '만복의 근원 하나님',
    slides: [
      {label: '1절', lines: ['만복의 근원 하나님', '온 백성 찬송 드리고']},
      {label: '후렴', lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령']},
      {lines: ['아멘']},
    ],
    arrangements: [
      {name: '주일용', slides: [1, 2, 1, 2, 3]},
      {name: '비어 있음', slides: []},
    ],
  };
}

/** A 예배 순서 file with one of each common item kind. */
export function service(
  id: string,
  date: string,
  order: readonly object[],
): Record<string, unknown> {
  return {
    format: 'llservice',
    schemaVersion: 1,
    id,
    name: '주일 예배',
    date,
    order,
  };
}

export function itemId(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

/** Writes JSON, or raw text, to a file, creating its folder. */
export async function writeJson(file: string, json: unknown): Promise<void> {
  await mkdir(dirname(file), {recursive: true});
  await writeFile(
    file,
    typeof json === 'string' ? json : JSON.stringify(json),
    'utf8',
  );
}
