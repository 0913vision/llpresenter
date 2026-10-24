// 아이콘. Phosphor Regular SVG를 마스크로 칠하므로 글자색(currentColor)을 따른다.
// 쓸 수 있는 이름은 icons 폴더의 파일 이름이다(디자인 시스템 assets/Icons/README.md).

import type { CSSProperties, JSX } from 'react'
import styles from './Icon.module.css'

const urls: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('./icons/*.svg', { query: '?url', import: 'default', eager: true }),
  ).map(([path, url]) => [path.slice('./icons/'.length, -'.svg'.length), url]),
)

export type IconSize = 12 | 14 | 16 | 18 | 24 | 28

export interface IconProps {
  readonly name: string
  readonly size?: IconSize
  readonly className?: string | undefined
}

export function Icon({ name, size = 16, className }: IconProps): JSX.Element {
  const url = urls[name]
  const style: CSSProperties = {
    width: size,
    height: size,
    // 작은 SVG는 data URL로 들어오므로 따옴표로 감싼다(감싸지 않으면 CSS가 깨진다).
    ...(url === undefined ? {} : { WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")` }),
  }
  return <span aria-hidden="true" className={className === undefined ? styles.icon : `${styles.icon} ${className}`} style={style} />
}
