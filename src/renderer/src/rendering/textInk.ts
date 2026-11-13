export function measureTextInk(
  block: HTMLElement,
): {top: number; bottom: number} | undefined {
  const rect = block.getBoundingClientRect();
  const scale = rect.width / block.clientWidth;
  if (!(scale > 0)) return undefined;
  const style = getComputedStyle(block);
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) return undefined;
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const lines = new Map<number, string>();
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const content = node.textContent ?? '';
    for (let offset = 0; offset < content.length;) {
      const length = (content.codePointAt(offset) ?? 0) > 0xffff ? 2 : 1;
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + length);
      const charRect = range.getBoundingClientRect();
      if (charRect.height > 0) {
        const key = Math.round(charRect.top * 64);
        lines.set(
          key,
          (lines.get(key) ?? '') + content.slice(offset, offset + length),
        );
      }
      offset += length;
    }
  }
  const allLines = [...lines.entries()].sort(([a], [b]) => a - b);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const visibleCount =
    block.style.maxHeight === ''
      ? allLines.length
      : Math.max(1, Math.round(rect.height / scale / lineHeight));
  const ordered = allLines.slice(0, visibleCount);
  const first = ordered[0]?.[1];
  const last = ordered.at(-1)?.[1];
  if (first === undefined || last === undefined) return undefined;
  const firstMetrics = context.measureText(first);
  const lastMetrics = context.measureText(last);
  const lastRow = block.lastElementChild ?? block;
  const marker = document.createElement('span');
  Object.assign(marker.style, {
    display: 'inline-block',
    width: '0',
    height: '0',
    padding: '0',
    margin: '0',
    verticalAlign: 'baseline',
  });
  lastRow.append(marker);
  const lastBaseline =
    marker.getBoundingClientRect().top +
    ((ordered.at(-1)?.[0] ?? 0) - (allLines.at(-1)?.[0] ?? 0)) / 64;
  marker.remove();
  const firstBaseline =
    lastBaseline + ((ordered[0]?.[0] ?? 0) - (ordered.at(-1)?.[0] ?? 0)) / 64;
  return {
    top: firstBaseline - firstMetrics.actualBoundingBoxAscent * scale,
    bottom: lastBaseline + lastMetrics.actualBoundingBoxDescent * scale,
  };
}
