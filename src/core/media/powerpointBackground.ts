import {MEDIA_LIMITS} from '../schema/mediaList';

/** Names a new PowerPoint background without colliding with the media list. */
export function powerpointBackgroundName(
  title: string,
  names: Iterable<string>,
): string {
  const used = new Set([...names].map(name => name.trim().normalize('NFC')));
  const stem = title.trim().normalize('NFC') || '가져온 곡';
  for (let number = 1; ; number++) {
    const suffix = ` 배경${number === 1 ? '' : ` ${number}`}`;
    let base = '';
    for (const letter of stem) {
      if (base.length + letter.length + suffix.length > MEDIA_LIMITS.name) {
        break;
      }
      base += letter;
    }
    const candidate = `${base.trimEnd()}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
