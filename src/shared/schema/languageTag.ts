const LANGUAGE = '(?:[a-z]{2,3}(?:-[a-z]{3}){0,3}|[a-z]{4}|[a-z]{5,8})';
const LANGUAGE_TAG = new RegExp(
  `^${LANGUAGE}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|[0-9]{3}))?` +
    '(?:-(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3}))*' +
    '(?:-[0-9a-wy-z](?:-[a-z0-9]{2,8})+)*(?:-x(?:-[a-z0-9]{1,8})+)?$',
  'i',
);
const PRIVATE_TAG = /^x(?:-[a-z0-9]{1,8})+$/i;
const GRANDFATHERED = new Set([
  'art-lojban',
  'cel-gaulish',
  'en-gb-oed',
  'i-ami',
  'i-bnn',
  'i-default',
  'i-enochian',
  'i-hak',
  'i-klingon',
  'i-lux',
  'i-mingo',
  'i-navajo',
  'i-pwn',
  'i-tao',
  'i-tay',
  'i-tsu',
  'no-bok',
  'no-nyn',
  'sgn-be-fr',
  'sgn-be-nl',
  'sgn-ch-de',
  'zh-guoyu',
  'zh-hakka',
  'zh-min',
  'zh-min-nan',
  'zh-xiang',
]);

/** Checks BCP 47 syntax without rewriting the tag or querying the IANA registry. */
export function isLanguageTag(value: string): boolean {
  if (/[^a-z0-9-]/i.test(value)) return false;
  const tag = value.toLowerCase();
  if (PRIVATE_TAG.test(tag) || GRANDFATHERED.has(tag)) return true;
  if (!LANGUAGE_TAG.test(tag)) return false;
  const variants = new Set<string>();
  const extensions = new Set<string>();
  let extension = false;
  for (const part of tag.split('-').slice(1)) {
    if (part === 'x') break;
    if (part.length === 1) {
      if (extensions.has(part)) return false;
      extensions.add(part);
      extension = true;
    } else if (
      !extension &&
      (part.length >= 5 || /^[0-9][a-z0-9]{3}$/.test(part))
    ) {
      if (variants.has(part)) return false;
      variants.add(part);
    }
  }
  return true;
}
