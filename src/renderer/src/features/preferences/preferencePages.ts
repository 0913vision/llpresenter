import type {PreferencePageId} from '@core/schema/app/preferencePages';

/** The pages of the 환경설정 list, in the order it shows them. */
export const preferencePages = [
  {id: 'general', label: '일반', icon: 'gear'},
  {id: 'show', label: '진행', icon: 'mplay'},
  {id: 'prep', label: '준비', icon: 'listplus'},
  {id: 'output', label: '출력', icon: 'mplay'},
  {id: 'serviceOrder', label: '예배 순서', icon: 'listplus'},
  {id: 'storage', label: '저장', icon: 'folder'},
  {id: 'labels', label: '이름표', icon: 'bookmark'},
  {id: 'media', label: '미디어', icon: 'audio'},
  {id: 'bible', label: '성경', icon: 'book'},
  {id: 'shortcuts', label: '단축키', icon: 'keyboard'},
  {id: 'about', label: '정보', icon: 'info'},
] as const satisfies ReadonlyArray<{
  id: PreferencePageId;
  label: string;
  icon: string;
}>;
