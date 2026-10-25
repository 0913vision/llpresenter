export const testText = '첫째 문장\n뷁 새 문장\n[후렴]\n마지막 문장';

export const cp949Sample = Buffer.from(
  'c3b9c2b020b9aec0e50a94ee20bbf520b9aec0e50a5bc8c4b7c55d0ab8b6c1f6b8b720b9aec0e5',
  'hex',
);

export const encodedTextSamples = [
  ['UTF-8', Buffer.from(testText)],
  [
    'UTF-8 BOM',
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(testText)]),
  ],
  [
    'UTF-16 LE',
    Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(testText, 'utf16le'),
    ]),
  ],
  [
    'UTF-16 BE',
    Buffer.concat([
      Buffer.from([0xfe, 0xff]),
      Buffer.from(testText, 'utf16le').swap16(),
    ]),
  ],
  ['CP949 including extended Hangul', cp949Sample],
] as const;
