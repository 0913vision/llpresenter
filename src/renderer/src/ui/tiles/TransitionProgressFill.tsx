import {useMemo, type JSX} from 'react';
import {classNames} from '../classNames';
import {progressStyle, type TransitionProgress} from './transitionProgress';

/** Keeps the animation's time origin stable across unrelated parent renders. */
export function TransitionProgressFill({
  progress,
  className,
  animatedClassName,
}: {
  readonly progress: TransitionProgress;
  readonly className: string | undefined;
  readonly animatedClassName: string | undefined;
}): JSX.Element {
  const style = useMemo(() => progressStyle(progress), [progress]);
  return (
    <span
      className={classNames(
        className,
        typeof progress === 'number' ? undefined : animatedClassName,
      )}
      style={style}
    />
  );
}
