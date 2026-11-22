import {create} from 'zustand';

export const INSPECTOR_TABS = [
  {value: 'texts', label: '내용'},
  {value: 'look', label: '디자인'},
  {value: 'transition', label: '전환'},
] as const;

export type InspectorTab = (typeof INSPECTOR_TABS)[number]['value'];

/** The tab stays the same from slide to slide and from item to item. */
const useTab = create<{readonly tab: InspectorTab}>(() => ({tab: 'texts'}));

export function useInspectorTab(): InspectorTab {
  return useTab(view => view.tab);
}

export function showInspectorTab(tab: InspectorTab): void {
  useTab.setState({tab});
}
