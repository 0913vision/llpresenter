import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type JSX,
} from 'react';
import {emptyLayers} from '@shared/live';
import {mediaUrl} from '@shared/media';
import type {LyricStyle} from '@shared/schema/looks';
import {OutputRenderer} from '@renderer/render/outputRenderer';
import {
  DEFAULT_LYRIC_STYLE,
  renderLyricStyle,
} from '@renderer/render/lyricStyle';
import styles from './LookPreview.module.css';

const sample = {
  ...emptyLayers(),
  slide: {
    itemId: 'lyric-style-preview',
    position: 0,
    label: null,
    lines: ['함께 부르는 노래', '가사 스타일 미리보기'],
  },
};

/** Draws invented sample text with the same style renderer used by live outputs. */
export function LyricStylePreview({
  style,
}: {
  readonly style: LyricStyle;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const renderer = useRef<OutputRenderer | null>(null);
  const draw = useEffectEvent(() => {
    renderer.current?.render(sample, {
      transitions: false,
      look: {
        layers: {slide: true},
        lyricStyle: renderLyricStyle(style),
        background: null,
      },
    });
  });
  useEffect(() => {
    if (root.current === null) return undefined;
    const instance = new OutputRenderer(root.current, {
      lyricStyle: DEFAULT_LYRIC_STYLE,
      mediaUrl,
      mode: 'preview',
      onError: (message, cause) => {
        window.llp?.log.write({level: 'error', message, detail: String(cause)});
      },
    });
    renderer.current = instance;
    draw();
    return () => {
      instance.dispose();
      renderer.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    draw();
  });
  return (
    <div
      className={styles.frame}
      aria-label="가사 스타일 미리보기"
      ref={root}
    />
  );
}
