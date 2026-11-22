/** The values a theme can use beside the texts of its own boxes. */
export const AUTO_TOKENS = {
  label: '이름표',
  /** The label, unless the slide before in the item has the same one. */
  newLabel: '새 이름표',
  number: '번호',
  passage: '구절',
  song: '곡 제목',
  /** The song's name after its hymn number, when it has one. */
  hymn: '찬송가 장과 제목',
  /** The title that the hymnal gives the number on the slide. */
  hymnTitle: '찬송가 제목',
  item: '항목 이름',
} as const;

export type AutoValues = Readonly<
  Partial<Record<(typeof AUTO_TOKENS)[keyof typeof AUTO_TOKENS], string>>
>;

/** The text of a slide, as its theme draws it. */
export interface SlideContent {
  /** The slide's own texts by box name. */
  readonly texts: Readonly<Record<string, string>>;
  readonly auto: AutoValues;
  /** What the slide before shows, when this slide has its own text for it. */
  readonly next?: string | undefined;
  /** The text goes on on the next slide. */
  readonly continued?: boolean;
}
