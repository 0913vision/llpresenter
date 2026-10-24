import type {CSSProperties, JSX} from 'react';
import styles from './Icon.module.css';

const ICON_PREFIX = './icons/';
const ICON_SUFFIX = '.svg';

const iconUrls: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('./icons/*.svg', {
      query: '?url',
      import: 'default',
      eager: true,
    }),
  ).map(([path, url]) => [
    path.slice(ICON_PREFIX.length, -ICON_SUFFIX.length),
    url,
  ]),
);

export type IconSize = 12 | 14 | 16 | 18 | 24 | 28;

export interface IconProps {
  /** A file name in `icons/` without the extension (Phosphor Regular). */
  readonly name: string;
  readonly size?: IconSize;
  readonly className?: string | undefined;
}

function maskStyle(url: string | undefined, size: IconSize): CSSProperties {
  if (url === undefined) return {width: size, height: size};
  // NOTE(0913vision): Small SVGs arrive as data URLs, which break CSS unless
  // the url() argument is quoted.
  const mask = `url("${url}")`;
  return {width: size, height: size, WebkitMaskImage: mask, maskImage: mask};
}

/** An icon painted with the current text color through a CSS mask. */
export function Icon({name, size = 16, className}: IconProps): JSX.Element {
  const classes =
    className === undefined ? styles.icon : `${styles.icon} ${className}`;
  return (
    <span
      aria-hidden="true"
      className={classes}
      style={maskStyle(iconUrls[name], size)}
    />
  );
}
