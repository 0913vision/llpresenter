import type {JSX} from 'react';
import {PropertyGroup} from '@renderer/ui/panels/PropertyRow';
import {SegmentedRow, CheckboxRow} from '../PreferenceRows';
import type {PageProps} from './pageProps';

const LAST_SLIDE_OPTIONS = [
  {value: 'stop', label: '멈춤'},
  {value: 'nextItem', label: '다음 항목으로'},
] as const;

/** Service order appearance and navigation. */
export function ServiceOrderPage({edits}: PageProps): JSX.Element | null {
  const {preferences, lockedReason, change} = edits;
  if (preferences === null) return null;
  return (
    <PropertyGroup>
      <SegmentedRow
        label="마지막 슬라이드에서"
        disabled={lockedReason !== undefined}
        title={lockedReason}
        options={LAST_SLIDE_OPTIONS}
        value={preferences.show.atLastSlide}
        onChange={atLastSlide =>
          change(stored => ({
            ...stored,
            show: {...stored.show, atLastSlide},
          }))
        }
      />
      <CheckboxRow
        label="이어서 보여 주기"
        disabled={lockedReason !== undefined}
        title={lockedReason}
        checked={preferences.show.continuousGrid}
        onChange={continuousGrid =>
          change(stored => ({
            ...stored,
            show: {...stored.show, continuousGrid},
          }))
        }
      />
      <CheckboxRow
        label="지난 순서 흐리게"
        disabled={lockedReason !== undefined}
        title={lockedReason}
        checked={preferences.show.dimPastItems}
        onChange={dimPastItems =>
          change(stored => ({
            ...stored,
            show: {...stored.show, dimPastItems},
          }))
        }
      />
      <CheckboxRow
        label="진행 슬라이드 두 번 클릭해서 준비로 이동하기"
        disabled={lockedReason !== undefined}
        title={lockedReason}
        checked={preferences.show.doubleClickPrep}
        onChange={doubleClickPrep =>
          change(stored => ({
            ...stored,
            show: {...stored.show, doubleClickPrep},
          }))
        }
      />
    </PropertyGroup>
  );
}
