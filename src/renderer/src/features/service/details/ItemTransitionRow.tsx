import type {JSX} from 'react';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import type {SlideTransition} from '@core/schema/slideTransition';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {SLIDE_EFFECTS} from '@renderer/ui/slideTransitionChoices';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {INITIAL_SLIDE_EFFECT} from '@renderer/features/songs/editor/slideTransitionSelection';
import type {ServiceItemStore} from '../items/serviceItemStore';

type Effect = 'default' | SlideTransition['kind'];
const options = [
  {value: 'default', label: '기본값'},
  ...SLIDE_EFFECTS.map(([value, label]) => ({value, label})),
] as const;

/** The common slide effect, preserving per-slide effects when they differ. */
export function ItemTransitionRow({
  item,
  serviceId,
  items,
  reason,
}: {
  readonly item: ServiceItemOf<'song' | 'slides'>;
  readonly serviceId: string;
  readonly items: ServiceItemStore;
  readonly reason: string | undefined;
}): JSX.Element {
  const slides = isItemOfKind(item, 'song') ? item.slides : item.slides.slides;
  const first = slides[0]?.transition;
  const signature = (value: SlideTransition | undefined): string =>
    JSON.stringify(value ?? null);
  const mixed = slides.some(
    slide => signature(slide.transition) !== signature(first),
  );
  const lock =
    reason ??
    (slides.length === 0
      ? '슬라이드 없음'
      : mixed
        ? '선택한 슬라이드의 효과가 서로 다릅니다.'
        : undefined);
  const change = (kind: Effect): void => {
    const expected = slides.map(slide => [
      slide.id,
      signature(slide.transition),
    ]);
    editorTask(
      items.submitItemEdit({
        target: {serviceId, itemId: item.id},
        failure: '전환 저장 실패',
        change: current => {
          if (
            !isItemOfKind(current, 'song') &&
            !isItemOfKind(current, 'slides')
          ) {
            return null;
          }
          const existing = isItemOfKind(current, 'song')
            ? current.slides
            : current.slides.slides;
          if (
            JSON.stringify(
              existing.map(slide => [slide.id, signature(slide.transition)]),
            ) !== JSON.stringify(expected)
          ) {
            return null;
          }
          const apply = <T extends {readonly transition?: SlideTransition}>(
            slide: T,
          ): Omit<T, 'transition'> & {
            readonly transition?: SlideTransition;
          } => {
            const {transition: old, ...rest} = slide;
            if (kind === 'default') return rest;
            const base = old ?? INITIAL_SLIDE_EFFECT;
            const transition: SlideTransition = {
              kind,
              sec: base.sec,
              ...(kind === 'push' || kind === 'wipe'
                ? {dir: base.dir ?? 'left'}
                : {}),
            };
            return {...rest, transition};
          };
          return isItemOfKind(current, 'song')
            ? {...current, slides: current.slides.map(apply)}
            : {
                ...current,
                slides: {
                  ...current.slides,
                  slides: current.slides.slides.map(apply),
                },
              };
        },
      }),
    );
  };
  return (
    <PropertyRow label="전환">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          menuLabel="전환"
          options={options}
          value={first?.kind ?? 'default'}
          disabled={lock !== undefined}
          title={lock}
          onChange={change}
        />
      )}
    </PropertyRow>
  );
}
