import { describe, expect, it } from 'vitest'
import type { LiveCommand } from '@shared/commands'
import { emptyLiveState, layerKinds, type SlideLayer } from '@shared/live'
import { applyCommand, initialHistory, UNDO_LIMIT, type LiveHistory } from './reducer'

const slide = (position: number): SlideLayer => ({
  itemId: 'item-1',
  position,
  label: '후렴',
  lines: ['저 천사여 찬송하세', '찬송 성부 성자 성령'],
})

const run = (commands: readonly LiveCommand[], start: LiveHistory = initialHistory(emptyLiveState())): LiveHistory =>
  commands.reduce(applyCommand, start)

describe('applyCommand', () => {
  it('장을 띄우면 판 번호가 오르고 장 층이 바뀐다', () => {
    const next = run([{ type: 'slide.show', slide: slide(1) }])
    expect(next.state.version).toBe(1)
    expect(next.state.layers.slide?.position).toBe(1)
  })

  it('같은 장 객체를 다시 띄우면 바뀐 것이 없다', () => {
    const shown = slide(1)
    const once = run([{ type: 'slide.show', slide: shown }])
    const twice = applyCommand(once, { type: 'slide.show', slide: shown })
    expect(twice).toBe(once)
  })

  it('비어 있는 층을 지우면 바뀐 것이 없고 되돌림에 쌓이지 않는다', () => {
    const start = initialHistory(emptyLiveState())
    expect(applyCommand(start, { type: 'layer.clear', target: 'slide' })).toBe(start)
    expect(applyCommand(start, { type: 'layer.clear', target: 'all' })).toBe(start)
  })

  it('지운 뒤 되돌리면 지우기 직전 층이 돌아온다', () => {
    const shown = run([
      { type: 'media.show', media: { mediaId: 'warm-light', loop: true } },
      { type: 'slide.show', slide: slide(2) },
    ])
    const cleared = applyCommand(shown, { type: 'layer.clear', target: 'all' })
    expect(layerKinds.every((kind) => cleared.state.layers[kind] === null)).toBe(true)
    const restored = applyCommand(cleared, { type: 'clear.undo' })
    expect(restored.state.layers).toEqual(shown.state.layers)
    expect(restored.undo).toHaveLength(0)
    expect(restored.state.version).toBe(cleared.state.version + 1)
  })

  it('한 층만 지우면 다른 층은 그대로다', () => {
    const shown = run([
      { type: 'media.show', media: { mediaId: 'warm-light', loop: true } },
      { type: 'slide.show', slide: slide(2) },
      { type: 'layer.clear', target: 'slide' },
    ])
    expect(shown.state.layers.slide).toBeNull()
    expect(shown.state.layers.media?.mediaId).toBe('warm-light')
  })

  it('되돌릴 것이 없으면 바뀐 것이 없다', () => {
    const start = initialHistory(emptyLiveState())
    expect(applyCommand(start, { type: 'clear.undo' })).toBe(start)
  })

  it(`되돌림 기록은 ${UNDO_LIMIT}개를 넘지 않는다`, () => {
    let history = initialHistory(emptyLiveState())
    for (let i = 0; i < UNDO_LIMIT + 15; i += 1) {
      history = applyCommand(history, { type: 'slide.show', slide: slide(i) })
      history = applyCommand(history, { type: 'layer.clear', target: 'slide' })
    }
    expect(history.undo).toHaveLength(UNDO_LIMIT)
    expect(history.undo.at(-1)?.slide?.position).toBe(UNDO_LIMIT + 14)
  })

  it('출력 켜고 끄기는 화면별이고 같은 값이면 바뀐 것이 없다', () => {
    const on = run([{ type: 'output.set', screenId: 'main', on: true }])
    expect(on.state.outputs['main']).toBe(true)
    expect(on.state.outputs['stage']).toBeUndefined()
    expect(applyCommand(on, { type: 'output.set', screenId: 'main', on: true })).toBe(on)
    const off = applyCommand(on, { type: 'output.set', screenId: 'main', on: false })
    expect(off.state.outputs['main']).toBe(false)
  })

  it('아무 순서로 명령을 넣어도 판 번호는 줄지 않고 되돌림 기록은 상한을 지킨다', () => {
    // 같은 결과가 나오도록 씨앗이 고정된 의사 난수를 쓴다.
    let seed = 20261024
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const targets = [...layerKinds, 'all'] as const
    const pick = (): LiveCommand => {
      const roll = random()
      if (roll < 0.3) return { type: 'slide.show', slide: slide(Math.floor(random() * 9)) }
      if (roll < 0.4) return { type: 'media.show', media: { mediaId: `m${Math.floor(random() * 3)}`, loop: true } }
      if (roll < 0.5) return { type: 'message.show', message: { messageId: 'parking', text: '차량 이동 부탁드립니다' } }
      if (roll < 0.75) return { type: 'layer.clear', target: targets[Math.floor(random() * targets.length)] ?? 'all' }
      if (roll < 0.9) return { type: 'clear.undo' }
      return { type: 'output.set', screenId: random() < 0.5 ? 'main' : 'stage', on: random() < 0.5 }
    }
    let history = initialHistory(emptyLiveState())
    for (let i = 0; i < 5000; i += 1) {
      const next = applyCommand(history, pick())
      expect(next.state.version).toBeGreaterThanOrEqual(history.state.version)
      expect(next.undo.length).toBeLessThanOrEqual(UNDO_LIMIT)
      history = next
    }
  })
})
