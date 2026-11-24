import type {JSX} from 'react';
import {
  CLEAR_FADE_LIMIT_MS,
  DEFAULT_CLEAR_FADE,
} from '@core/schema/live/clearFade';
import {clearName} from '@core/live';
import {PropertyGroup, PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {NumberField} from '@renderer/ui/fields/NumberField';
import type {PageProps} from './pageProps';

const CLEAR_TARGETS = [
  'all',
  'slide',
  'media',
  'prop',
  'audio',
  'message',
] as const;

/** The 진행 page of the 환경설정 window; null until the preferences are read. */
export function ShowPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  return (
    <PropertyGroup title="지우기 페이드">
      {CLEAR_TARGETS.map(target => {
        const label = clearName(target);
        const value = preferences.clearKeys[target] ?? DEFAULT_CLEAR_FADE;
        const update = (next: typeof value): void =>
          change(stored => ({
            ...stored,
            clearKeys: {...stored.clearKeys, [target]: next},
          }));
        return (
          <PropertyRow key={target} label={label}>
            {({controlId}) => (
              <>
                <NumberField
                  id={controlId}
                  aria-label={`${label} 지우기 시간`}
                  value={value.fade ? value.durationMs / 1000 : 0}
                  min={0}
                  max={CLEAR_FADE_LIMIT_MS / 1000}
                  step={0.1}
                  unit="초"
                  disabled={lockedReason !== undefined}
                  updateOn="commit"
                  onChange={seconds =>
                    update({
                      fade: seconds > 0,
                      durationMs: Math.round(seconds * 1000),
                    })
                  }
                />
              </>
            )}
          </PropertyRow>
        );
      })}
    </PropertyGroup>
  );
}
