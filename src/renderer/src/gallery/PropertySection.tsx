import type {JSX} from 'react';
import {IconButton} from '../ui/IconButton';
import {Panel, PanelBody} from '../ui/Panel';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '../ui/PropertyRow';
import {SegmentedControl} from '../ui/SegmentedControl';
import {SelectMenu} from '../ui/SelectMenu';
import {Switch} from '../ui/Switch';
import {TextArea} from '../ui/TextArea';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';

const PANEL_WIDTH = 480;
const WINDOW_WIDTH = 640;

function ScreenProperties(): JSX.Element {
  return (
    <Properties>
      <PropertyGroup title="출력">
        <PropertyRow label="종류">
          {({controlId, labelId}) => (
            <Stateful<'audience' | 'stage'> initial="audience">
              {(value, setValue) => (
                <SegmentedControl
                  id={controlId}
                  labelledBy={labelId}
                  fill
                  options={[
                    {value: 'audience', label: '청중'},
                    {value: 'stage', label: '무대'},
                  ]}
                  value={value}
                  onChange={setValue}
                />
              )}
            </Stateful>
          )}
        </PropertyRow>
        <PropertyRow label="장치">
          {({controlId}) => (
            <Stateful<string> initial="2">
              {(value, setValue) => (
                <SelectMenu
                  id={controlId}
                  block
                  options={[
                    {value: '2', label: '모니터 2', meta: 'EPSON 프로젝터'},
                    {value: '3', label: '모니터 3'},
                  ]}
                  meta={value === '2' ? 'EPSON 프로젝터' : undefined}
                  value={value}
                  onChange={setValue}
                />
              )}
            </Stateful>
          )}
        </PropertyRow>
        <PropertyValue label="주사율" value="60Hz" />
      </PropertyGroup>
      <PropertyGroup title="안정성">
        <PropertyRow label="항상 위">
          {({controlId}) => (
            <Stateful<boolean> initial>
              {(checked, setChecked) => (
                <Switch
                  id={controlId}
                  checked={checked}
                  onChange={setChecked}
                />
              )}
            </Stateful>
          )}
        </PropertyRow>
        <PropertyRow label="절전 막기">
          {({controlId}) => (
            <Stateful<boolean> initial={false}>
              {(checked, setChecked) => (
                <Switch
                  id={controlId}
                  checked={checked}
                  onChange={setChecked}
                />
              )}
            </Stateful>
          )}
        </PropertyRow>
      </PropertyGroup>
      <PropertyGroup title="메모" icon="note">
        <Stateful<string> initial="">
          {(value, setValue) => (
            <TextArea aria-label="메모" value={value} onChange={setValue} />
          )}
        </Stateful>
      </PropertyGroup>
    </Properties>
  );
}

export function PropertySection(): JSX.Element {
  return (
    <Section title="PropertyRow">
      <SpecGroup alignTop>
        <SpecItem label="Panel, 화면 설정 properties" width={PANEL_WIDTH}>
          <Panel label="속성">
            <PanelBody>
              <ScreenProperties />
            </PanelBody>
          </Panel>
        </SpecItem>
        <SpecItem
          label="Panel, 항목 설정 원본 with an action"
          width={PANEL_WIDTH}
        >
          <Panel label="항목 설정">
            <PanelBody>
              <Properties>
                <PropertyGroup title="원본">
                  <PropertyValue
                    label="곡"
                    value="만복의 근원 하나님"
                    icon="link"
                    primary
                    meta="라이브러리"
                    action={
                      <IconButton icon="open" label="라이브러리 곡 열기" />
                    }
                  />
                </PropertyGroup>
              </Properties>
            </PanelBody>
          </Panel>
        </SpecItem>
        <SpecItem
          label="Window, Preferences, name 168, gap 16, control cell 340, row 38"
          width={WINDOW_WIDTH}
        >
          <Panel label="환경설정">
            <PanelBody>
              <Properties placement="window">
                <PropertyGroup title="보고">
                  <PropertyRow label="오류 보고 보내기">
                    {({controlId}) => (
                      <Stateful<boolean> initial>
                        {(checked, setChecked) => (
                          <Switch
                            id={controlId}
                            checked={checked}
                            onChange={setChecked}
                          />
                        )}
                      </Stateful>
                    )}
                  </PropertyRow>
                  <PropertyValue label="현재 버전" value="1.0.0" />
                  <PropertyValue label="마지막 백업" value="오늘 07:58" />
                </PropertyGroup>
              </Properties>
            </PanelBody>
          </Panel>
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
