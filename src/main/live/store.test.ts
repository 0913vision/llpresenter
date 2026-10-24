import { describe, expect, it, vi } from 'vitest'
import { LiveStore } from './store'

describe('LiveStore', () => {
  it('바뀌었을 때만 구독자에게 알린다', () => {
    const store = new LiveStore()
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.dispatch({ type: 'layer.clear', target: 'all' })).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    expect(store.dispatch({ type: 'output.set', screenId: 'main', on: true })).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenLastCalledWith(store.state)
  })

  it('구독을 풀면 더 알리지 않고 목록에서도 빠진다', () => {
    const store = new LiveStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    expect(store.listenerCount).toBe(1)
    unsubscribe()
    expect(store.listenerCount).toBe(0)
    store.dispatch({ type: 'output.set', screenId: 'main', on: true })
    expect(listener).not.toHaveBeenCalled()
  })

  it('한 구독자의 오류는 다른 구독자와 상태에 번지지 않는다', () => {
    const store = new LiveStore()
    const errors: unknown[] = []
    const after = vi.fn()
    store.subscribe(() => {
      throw new Error('그리기 실패')
    })
    store.subscribe(after)
    expect(store.dispatch({ type: 'output.set', screenId: 'main', on: true }, (error) => errors.push(error))).toBe(true)
    expect(after).toHaveBeenCalledTimes(1)
    expect(errors).toHaveLength(1)
    expect(store.state.outputs['main']).toBe(true)
  })
})
