import { describe, expect, it } from 'vitest'
import { defaultColumns, sizeClassFor } from './sizeClass'

describe('sizeClassFor', () => {
  it('경계값에서 구간이 바뀐다', () => {
    expect(sizeClassFor(1280)).toBe('compact')
    expect(sizeClassFor(1536)).toBe('compact')
    expect(sizeClassFor(1599)).toBe('compact')
    expect(sizeClassFor(1600)).toBe('regular')
    expect(sizeClassFor(1920)).toBe('regular')
    expect(sizeClassFor(2399)).toBe('regular')
    expect(sizeClassFor(2400)).toBe('wide')
    expect(sizeClassFor(2560)).toBe('wide')
  })

  it('최소 창에서도 가운데 열이 최소 너비 560을 지킨다', () => {
    // 창 1280에서 왼쪽, 오른쪽 열과 패널 틈 4px 네 개를 빼고 남는 너비
    const { left, right } = defaultColumns.compact
    expect(1280 - left - right - 4 * 4).toBeGreaterThanOrEqual(560)
  })
})
