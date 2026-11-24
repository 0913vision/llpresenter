import type {JSX} from 'react';
import {PropertyGroup, PropertyRow} from '@renderer/ui/panels/PropertyRow';
import type {TransitionDefaultKind} from '@core/schema/app/preferences';
import {
  SLIDE_TRANSITION_LIMITS,
  type SlideTransition,
} from '@core/schema/slides/slideTransition';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {NumberField} from '@renderer/ui/fields/NumberField';
import {
  SLIDE_DIRECTIONS,
  SLIDE_EFFECTS,
} from '@renderer/ui/choices/slideTransitionChoices';
import type {PageProps} from './pageProps';

/** 준비: defaults for newly created slides. */
export function PrepPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  const disabled = lockedReason !== undefined;
  return (
    <PropertyGroup title="새 슬라이드 기본 전환">
      {(
        [
          ['songTitle', '곡 제목'],
          ['song', '곡'],
          ['blank', '빈 슬라이드'],
          ['ad', '광고'],
          ['section', '타이틀'],
          ['sermonTitle', '설교 제목'],
          ['creed', '사도신경'],
          ['prayer', '주기도문'],
          ['bible', '성경 말씀'],
        ] as const satisfies ReadonlyArray<
          readonly [TransitionDefaultKind, string]
        >
      ).map(([key, label]) => {
        const value = preferences.show.slideDefaults[key];
        const update = (next: SlideTransition): void =>
          change(stored => ({
            ...stored,
            show: {
              ...stored.show,
              slideDefaults: {...stored.show?.slideDefaults, [key]: next},
            },
          }));
        return (
          <PropertyRow key={key} label={label}>
            {({controlId}) => (
              <>
                <SelectMenu
                  id={controlId}
                  aria-label={`${label} 효과`}
                  value={value.kind}
                  options={SLIDE_EFFECTS.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  disabled={disabled}
                  onChange={kind =>
                    update({
                      kind,
                      sec: value.sec,
                      ...(kind === 'push' || kind === 'wipe'
                        ? {dir: value.dir ?? 'left'}
                        : {}),
                    })
                  }
                />
                <SelectMenu
                  aria-label={`${label} 방향`}
                  value={value.dir ?? 'left'}
                  options={SLIDE_DIRECTIONS.map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  disabled={
                    disabled || (value.kind !== 'push' && value.kind !== 'wipe')
                  }
                  onChange={dir => update({...value, dir})}
                />
                <NumberField
                  aria-label={`${label} 시간`}
                  value={value.sec}
                  {...SLIDE_TRANSITION_LIMITS}
                  unit="초"
                  disabled={disabled || value.kind === 'none'}
                  updateOn="commit"
                  onChange={sec => update({...value, sec})}
                />
              </>
            )}
          </PropertyRow>
        );
      })}
    </PropertyGroup>
  );
}
