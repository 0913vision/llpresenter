import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {fitTabIndices} from '@core/common/fitTabs';
import {
  PanelTabs,
  PanelTabContent,
  PanelMoreContent,
  type PanelTab,
} from './Panel';
import styles from './Panel.module.css';

interface Measurements {
  readonly available: number;
  readonly widths: readonly number[];
  readonly more: number;
  readonly gap: number;
}

export function ResponsivePanelTabs<T extends string>({
  tabs,
  value,
  onChange,
  moreLabel,
}: {
  readonly tabs: ReadonlyArray<PanelTab<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly moreLabel: string;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const tabMeasure = useRef<HTMLDivElement>(null);
  const moreMeasure = useRef<HTMLSpanElement>(null);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  useLayoutEffect(() => {
    const container = host.current;
    const row = tabMeasure.current;
    const more = moreMeasure.current;
    if (!container || !row || !more) return;
    const measure = (): void => {
      const next: Measurements = {
        available: container.getBoundingClientRect().width,
        widths: Array.from(
          row.children,
          child => child.getBoundingClientRect().width,
        ),
        more: more.getBoundingClientRect().width,
        gap: Number.parseFloat(getComputedStyle(row).columnGap) || 0,
      };
      setMeasurements(previous =>
        previous?.available === next.available &&
        previous.more === next.more &&
        previous.gap === next.gap &&
        previous.widths.length === next.widths.length &&
        previous.widths.every((width, index) => width === next.widths[index])
          ? previous
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(row);
    observer.observe(more);
    return () => observer.disconnect();
  }, [tabs]);
  const indices = measurements
    ? fitTabIndices({
        ...measurements,
        selected: tabs.findIndex(tab => tab.value === value),
      })
    : tabs.map((_, index) => index);
  const visible = indices.flatMap(index => {
    const tab = tabs[index];
    return tab ? [tab] : [];
  });
  const shown = new Set(visible.map(tab => tab.value));
  return (
    <div ref={host} className={styles.fitting}>
      <PanelTabs
        tabs={visible}
        value={value}
        onChange={onChange}
        more={{
          label: moreLabel,
          tabs: tabs.filter(tab => !shown.has(tab.value)),
        }}
      />
      <div className={styles.measurements} aria-hidden="true" inert>
        <div ref={tabMeasure} className={styles.tabs}>
          {tabs.map(tab => (
            <span key={tab.value} className={styles.tab}>
              <PanelTabContent label={tab.label} count={tab.count} />
            </span>
          ))}
        </div>
        <span ref={moreMeasure} className={styles.more}>
          <PanelMoreContent label={moreLabel} />
        </span>
      </div>
    </div>
  );
}
