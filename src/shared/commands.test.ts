import { describe, expect, it } from 'vitest'
import { isLiveCommand } from './commands'

describe('isLiveCommand', () => {
  it('올바른 명령을 받아들인다', () => {
    expect(isLiveCommand({ type: 'clear.undo' })).toBe(true)
    expect(isLiveCommand({ type: 'layer.clear', target: 'all' })).toBe(true)
    expect(isLiveCommand({ type: 'layer.clear', target: 'notice' })).toBe(true)
    expect(isLiveCommand({ type: 'output.set', screenId: 'main', on: false })).toBe(true)
    expect(
      isLiveCommand({ type: 'slide.show', slide: { itemId: 'a', position: 0, label: null, lines: ['한 줄'] } }),
    ).toBe(true)
    expect(isLiveCommand({ type: 'media.show', media: { mediaId: 'warm-light', loop: true } })).toBe(true)
    expect(isLiveCommand({ type: 'message.show', message: { messageId: 'parking', text: '' } })).toBe(true)
  })

  it('모르는 종류와 모양이 틀린 값을 거부한다', () => {
    const rejected: unknown[] = [
      null,
      undefined,
      'clear.undo',
      [],
      {},
      { type: 'delete.everything' },
      { type: 'layer.clear', target: 'slides' },
      { type: 'layer.clear' },
      { type: 'output.set', screenId: '', on: true },
      { type: 'output.set', screenId: 'main', on: 'yes' },
      { type: 'slide.show', slide: { itemId: 'a', position: -1, label: null, lines: [] } },
      { type: 'slide.show', slide: { itemId: 'a', position: 1.5, label: null, lines: [] } },
      { type: 'slide.show', slide: { itemId: 'a', position: 0, label: 3, lines: [] } },
      { type: 'slide.show', slide: { itemId: 'a', position: 0, label: null, lines: [1] } },
      { type: 'media.show', media: { mediaId: 'x' } },
    ]
    for (const value of rejected) expect(isLiveCommand(value)).toBe(false)
  })
})
