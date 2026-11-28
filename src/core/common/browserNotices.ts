const RESIZE_LOOP_NOTICE =
  'ResizeObserver loop completed with undelivered notifications';

/**
 * Whether a window's error is the browser's notice that ResizeObserver
 * callbacks changed sizes again in the frame they ran, so the rest of the
 * notifications come the next frame. Nothing is lost, and it isn't the app's
 * failure: panels that would show one frame of the old layout (the 슬라이드
 * grid, 미리보기, 빠른 실행, the tool tabs) lay out again in that same frame
 * on purpose (no flash), and a window resize then brings the notice.
 */
export function isResizeLoopNotice(message: unknown): boolean {
  return typeof message === 'string' && message.startsWith(RESIZE_LOOP_NOTICE);
}
