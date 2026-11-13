import type {ThemeElement} from '@core/schema/themes';
import {isThemeTextElement} from '@core/themes/content';

interface FollowView {
  readonly element: ThemeElement;
  textBounds(ink?: boolean): {top: number; bottom: number} | undefined;
  setY(y: number): void;
}

export function positionFollowingBoxes(views: readonly FollowView[]): void {
  const stacks = new Map<string, FollowView[]>();
  for (const view of views) {
    if (!isThemeTextElement(view.element) || view.element.stack === undefined) {
      continue;
    }
    const group = stacks.get(view.element.stack.group) ?? [];
    group.push(view);
    stacks.set(view.element.stack.group, group);
  }
  for (const views of stacks.values()) {
    const first = views[0]?.element;
    if (
      first === undefined ||
      !isThemeTextElement(first) ||
      first.stack === undefined
    ) {
      continue;
    }
    const bounds = views.flatMap(view => {
      const rect = view.textBounds(first.stack?.ink);
      return rect === undefined ? [] : [rect];
    });
    if (bounds.length === 0) {
      continue;
    }
    const top = Math.min(...bounds.map(rect => rect.top));
    const bottom = Math.max(...bounds.map(rect => rect.bottom));
    // NOTE(0913vision): Canvas ink metrics are integer pixels; bias half their combined rounding range toward the baseline.
    const shift =
      first.stack.center - (top + bottom) / 2 + (first.stack.ink ? 0.75 : 0);
    for (const view of views) view.setY(view.element.frame.y + shift);
  }
  for (const view of views) {
    const element = view.element;
    if (element.kind !== 'box' || element.follow === undefined) continue;
    const targets = views.filter(target =>
      element.follow?.elements.includes(target.element.id),
    );
    const bounds = targets.flatMap(target => {
      const rect = target.textBounds();
      return rect === undefined ? [] : [rect];
    });
    if (bounds.length === 0) continue;
    const top = Math.min(...bounds.map(rect => rect.top));
    const bottom = Math.max(...bounds.map(rect => rect.bottom));
    const first = targets[0]?.element;
    const stack =
      first !== undefined && isThemeTextElement(first)
        ? first.stack
        : undefined;
    if (
      stack !== undefined &&
      targets.every(
        target =>
          isThemeTextElement(target.element) &&
          target.element.stack?.group === stack.group &&
          target.element.stack.center === stack.center,
      )
    ) {
      // NOTE(0913vision): Chromium uses a 1/64 px layout grid, so quantize the shared distance once.
      const precision = element.follow.snap ? 1 : 64;
      const distance =
        Math.round(((bottom - top) / 2 + element.follow.gap) * precision) /
        precision;
      view.setY(
        element.follow.side === 'above'
          ? stack.center - distance - (element.drawHeight ?? element.frame.h)
          : stack.center + distance,
      );
      continue;
    }
    view.setY(
      element.follow.side === 'above'
        ? top - element.follow.gap - (element.drawHeight ?? element.frame.h)
        : bottom + element.follow.gap,
    );
  }
}
