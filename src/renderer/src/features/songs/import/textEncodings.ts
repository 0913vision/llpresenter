import type {Preferences} from '@core/schema/app/preferences';

/** The encoding a text file is read with: auto, UTF-8 or CP949. */
export type TextEncoding = Preferences['import']['txt']['encoding'];

/** The 글자 인코딩 choices of a text file. */
export const TEXT_ENCODINGS = [
  {value: 'auto', label: '자동'},
  {value: 'utf-8', label: 'UTF-8'},
  {value: 'cp949', label: 'CP949'},
] as const;
