import type {JSX} from 'react';
import {Select, type SelectProps} from '../Select';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';
import warmLight from '../../../../../design/system/upload/Media/warm-light.jpg';

function Dropdown(
  props: Omit<SelectProps, 'expanded' | 'onExpandedChange'> & {
    readonly expanded?: boolean;
  },
): JSX.Element {
  return (
    <Stateful initial={props.expanded ?? false}>
      {(expanded, setExpanded) => (
        <Select {...props} expanded={expanded} onExpandedChange={setExpanded} />
      )}
    </Stateful>
  );
}

const media = {kind: 'media', src: warmLight} as const;

export function SelectSection(): JSX.Element {
  return (
    <Section title="Select">
      <SpecGroup title="Sizes" surface="panel">
        <SpecItem label="sm 26, 12px, panel header">
          <Dropdown size="sm" value="주일용" />
        </SpecItem>
        <SpecItem label="md 30, 13px, Preferences, property fields" width={240}>
          <Dropdown block value="한국어" />
        </SpecItem>
        <SpecItem label="md, extra info on the right text-2" width={300}>
          <Dropdown block value="모니터 2" meta="EPSON 프로젝터" />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="Leading image and leading icon" surface="panel">
        <SpecItem label="sm, media 36×20, default background">
          <Dropdown
            size="sm"
            aria-label="기본 배경 따뜻한 빛"
            value="따뜻한 빛"
            lead={media}
          />
        </SpecItem>
        <SpecItem label="md, media, background in item settings" width={300}>
          <Dropdown block value="따뜻한 빛" meta="곡 기본값" lead={media} />
        </SpecItem>
        <SpecItem label="Service item scope and live impact in the tooltip">
          <Dropdown
            size="sm"
            aria-label="배경 선택"
            value="따뜻한 빛"
            meta="곡 기본값"
            lead={media}
            title="이 항목에만 적용합니다. 출력 중인 항목이면 배경이 바로 바뀝니다"
          />
        </SpecItem>
        <SpecItem label="md, macro color tile 20, 시작할 때" width={300}>
          <Dropdown
            block
            value="찬양"
            meta="매크로"
            lead={{kind: 'tile', color: 'teal', icon: 'song'}}
          />
        </SpecItem>
        <SpecItem label="md, leading icon 16, date">
          <Dropdown
            value="11월 1일 일요일"
            numeric
            popup="dialog"
            lead={{kind: 'icon', icon: 'cal'}}
          />
        </SpecItem>
        <SpecItem label="md, time">
          <Dropdown
            value="오전 11:00"
            numeric
            lead={{kind: 'icon', icon: 'clock'}}
          />
        </SpecItem>
        <SpecItem label="sm, leading icon 14, Bible version">
          <Dropdown
            size="sm"
            aria-label="역본 개역한글"
            value="개역한글"
            lead={{kind: 'icon', icon: 'translate'}}
          />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="States" surface="panel">
        <SpecItem label="Default" width={150}>
          <Dropdown block value="1분마다" />
        </SpecItem>
        <SpecItem label="Hover" pin="hover" width={150}>
          <Dropdown block value="1분마다" />
        </SpecItem>
        <SpecItem label="Open, the menu is Menu" width={150}>
          <Dropdown block value="1분마다" expanded />
        </SpecItem>
        <SpecItem label="Focus" pin="focus" width={150}>
          <Dropdown block value="1분마다" />
        </SpecItem>
        <SpecItem label="Disabled" width={150}>
          <Dropdown block value="1920×1080" numeric disabled />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
