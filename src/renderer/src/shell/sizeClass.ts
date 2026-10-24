// 창 크기 구간. 크기는 Windows 배율을 적용한 CSS 픽셀이다(디자인 시스템 README의 창 크기와 배치).

export type SizeClass = 'compact' | 'regular' | 'wide'

export const sizeClasses: readonly SizeClass[] = ['compact', 'regular', 'wide']

export function sizeClassFor(width: number): SizeClass {
  if (width >= 2400) return 'wide'
  if (width >= 1600) return 'regular'
  return 'compact'
}

/** 구간마다 열 너비의 기본값. 사용자가 끌어 바꾼 너비는 1단계 뒤에 구간마다 기억한다. */
export const defaultColumns: Readonly<Record<SizeClass, { readonly left: number; readonly right: number }>> = {
  compact: { left: 220, right: 360 },
  regular: { left: 280, right: 480 },
  wide: { left: 320, right: 560 },
}
