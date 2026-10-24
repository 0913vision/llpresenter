import type {JSX} from 'react';
import {Panel, PanelBody} from '../Panel';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '../PropertyRow';
import {SegmentedControl} from '../SegmentedControl';
import {SelectMenu} from '../SelectMenu';
import {Switch} from '../Switch';
import {TextArea} from '../TextArea';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';

const PANEL_WIDTH = 480;
const WINDOW_WIDTH = 640;

function ScreenProperties(): JSX.Element {
  return (
    <Properties>
      <PropertyGroup title="출력">
        <PropertyRow label="종류">
          {id => (
            <Stateful<'audience' | 'stage'> initial="audience">
              {(value, setValue) => (
                <SegmentedControl
                  labelledBy={id}
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
          {id => (
            <Stateful<string> initial="2">
              {(value, setValue) => (
                <SelectMenu
                  id={id}
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
          {id => (
            <Stateful<boolean> initial>
              {(checked, setChecked) => (
                <Switch id={id} checked={checked} onChange={setChecked} />
              )}
            </Stateful>
          )}
        </PropertyRow>
        <PropertyRow label="절전 막기">
          {id => (
            <Stateful<boolean> initial={false}>
              {(checked, setChecked) => (
                <Switch id={id} checked={checked} onChange={setChecked} />
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
          label="Window, Preferences, name 168, gap 16, control cell 340, row 38"
          width={WINDOW_WIDTH}
        >
          <Panel label="환경설정">
            <PanelBody>
              <Properties placement="window">
                <PropertyGroup title="보고">
                  <PropertyRow label="오류 보고 보내기">
                    {id => (
                      <Stateful<boolean> initial>
                        {(checked, setChecked) => (
                          <Switch
                            id={id}
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
