import {describe, expect, it} from 'vitest';
import {sameFrame, withDraft} from '@renderer/ui/canvas/canvasDraft';

const title = {id: 'title', name: '제목', frame: {x: 0, y: 0, w: 100, h: 40}};
const lyrics = {
  id: 'lyrics',
  name: '가사',
  frame: {x: 0, y: 50, w: 100, h: 40},
};
const logo = {id: 'logo', name: '로고', frame: {x: 80, y: 0, w: 20, h: 20}};
const layout = {width: 1920, height: 1080, elements: [title, lyrics, logo]};

describe('withDraft', () => {
  it('shows the saved frames without a draft', () => {
    expect(withDraft(layout, null)).toBe(layout);
  });

  it('shows the dragged frame of one box over its saved one', () => {
    const moved = {x: 10, y: 10, w: 100, h: 40};
    const shown = withDraft(layout, {id: 'title', frame: moved});
    expect(shown.elements.map(element => element.frame)).toEqual([
      moved,
      lyrics.frame,
      logo.frame,
    ]);
  });

  it('shows every frame of a group that moves together', () => {
    const shown = withDraft(layout, {
      id: 'title',
      frame: {x: 5, y: 5, w: 100, h: 40},
      frames: [
        {id: 'title', frame: {x: 5, y: 5, w: 100, h: 40}},
        {id: 'lyrics', frame: {x: 5, y: 55, w: 100, h: 40}},
      ],
    });
    expect(shown.elements.map(element => element.frame.y)).toEqual([5, 55, 0]);
  });
});

describe('sameFrame', () => {
  it('compares place and size', () => {
    expect(sameFrame(title.frame, {...title.frame})).toBe(true);
    expect(sameFrame(title.frame, {...title.frame, h: 41})).toBe(false);
  });
});
