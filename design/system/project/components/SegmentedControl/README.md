# SegmentedControl

한 단 낮은 바닥 홈 안에 두세 개의 항목을 늘어놓고 하나를 고르는 컨트롤입니다. 곡의 구성, 출력 방식, 미리 볼 화면, 보기 전환처럼 고를 것이 적고 모두 보여야 할 때 씁니다.

## 쓰는 곳

- 패널 머리글과 캡션 줄: 구성(기본, 주일용, 짧게), 미리보기의 화면(본 화면, 무대, 방송 자막), 출력 미리보기(화면 내용, 테스트 패턴)
- 속성 칸(칸을 채우는 형태): 화면 설정의 종류와 방식, 미디어의 끝나면과 맞춤, 무대 배치의 보여 줄 것, 환경설정의 채널
- 목록 위 거르기: 단축키의 전체, 바꾼 것, 겹침(개수 포함)
- 보기 전환(아이콘 항목): 진행 도구와 매크로, 미디어의 격자 보기와 목록 보기, Look의 정렬

## 쓰지 않는 곳

- 고를 것이 다섯 개를 넘거나 이름이 길 때: Select를 씁니다.
- 켜고 끄기 하나: Switch나 IconButton(`aria-pressed`).
- 패널 머리글의 탭(예배 순서, 표시 중 …): 패널 탭을 씁니다. 세그먼트는 패널 안 내용을 바꾸는 작은 전환에만 씁니다.
- 작업 공간 전환(진행, 준비, 화면 설정): ToolbarButton의 작업 공간 탭.

## 구성

- 바닥 홈: 바탕 `bg-well`, 모서리 `radius-lg`(5px), 안쪽 `space-2`, 높이 `size-control-sm`(26px). 항목 사이 틈은 없습니다.
- 항목: 높이 `size-control-xs`(22px), 좌우 `space-10`, 모서리 `radius-sm`(3px), 글자 `label`(12/16).
- 고른 항목: 바탕 `bg-control-hover`, 글자 `text`. 나머지: 바탕 없음, 글자 `text-3`. 굵기는 바꾸지 않습니다.
- 아이콘 항목: 22×28, 아이콘 `size-icon-14`, 이름은 `aria-label`과 툴팁으로.
- 개수: 이름 뒤 `space-6`, 글자 `caption`(11/14), 숫자 폭 고정. 나머지 항목에서는 `text-3`, 고른 항목에서는 `text-2`, 겹침처럼 고쳐야 할 것의 개수는 `warning`. 바탕이 있는 배지로 만들지 않습니다.
- 칸을 채우는 형태(`ll-seg--fill`): 너비 100%, 항목이 너비를 똑같이 나누고 좌우 `space-8`. 이름이 넘치면 말줄임.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 기본 | 홈 `size-control-sm` 26, 항목 `size-control-xs` 22 | `label` | 패널 머리글, 캡션 줄, 목록 위 거르기 |
| 칸 채움 | 같음 | `label` | 속성 칸, 환경설정의 줄 |
| 아이콘 | 같음, 항목 너비 28 | 아이콘 14 | 격자/목록 보기, 정렬 |

크기는 하나입니다. md 30 컨트롤 옆(환경설정)에서도 26 홈을 쓰고 세로 가운데에 맞춥니다.

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본(고르지 않음) | 없음 | `text-3` | |
| 마우스 올림 | `bg-raised` | `text-2` | 100ms ease-out |
| 누름 | `bg-control-hover` | `text-2` | 놓으면 고른 항목이 됩니다 |
| 고름 | `bg-control-hover` | `text` | 마우스를 올려도 그대로 |
| 포커스 | 그대로 | 그대로 | 키보드 포커스에만 항목에 `outline: 2px solid accent`, offset 1px |
| 쓸 수 없음 | 고른 항목만 `bg-control-hover`를 남김 | `text-off` | hover 없음, 이유는 툴팁으로 |

## 동작

- 값 하나를 고르는 묶음은 `role="radiogroup"`과 항목 `role="radio"` + `aria-checked`로 만듭니다. 패널 안 내용을 바꾸는 화면 탭은 `role="tablist"`와 `role="tab"` + `aria-selected`, 보기 전환은 `aria-pressed`를 씁니다. CSS는 세 가지를 모두 받습니다.
- 키보드: Tab으로 들어오면 고른 항목에 포커스가 갑니다(나머지는 `tabindex="-1"`). 왼쪽/오른쪽 화살표로 옆 항목으로 옮기면서 바로 고르고, 끝에서 처음으로 돌아갑니다. Home과 End는 처음과 끝.
- 마우스: 누르면 바로 고릅니다. 이미 고른 항목을 다시 눌러도 바뀌지 않습니다.
- 묶음 이름은 `aria-label`로 줍니다(구성, 방식, 보기). 화면에 보이는 앞 이름이 있으면 `aria-labelledby`로 잇습니다.
- 묶음 전체를 쓸 수 없을 때는 항목마다 `aria-disabled="true"`를 줍니다.

## 글쓰기

- 항목 이름은 한두 낱말의 명사로, 서로 같은 꼴로 씁니다: 기본, 주일용, 짧게 / 맞추기, 채우기, 늘리기 / 전체 화면, 창, 캡처용 창, NDI.
- 묶음 위에 설명을 붙이지 않습니다. 항목의 뜻이 어려우면 툴팁에 씁니다.
- 아이콘 항목의 이름은 "격자 보기", "목록 보기"처럼 무엇이 되는지를 씁니다.

## 구현 메모

```jsx
<SegmentedControl label="구성" value={arr} onChange={setArr}
  options={[{ value: 'base', label: '기본' }, { value: 'sunday', label: '주일용' }, { value: 'short', label: '짧게' }]} />
<SegmentedControl label="방식" fill value={mode} onChange={setMode} options={modes} />
<SegmentedControl label="보기" kind="toggle" value={view} onChange={setView}
  options={[{ value: 'grid', icon: 'grid', label: '격자 보기' }, { value: 'list', icon: 'rows', label: '목록 보기' }]} />
<SegmentedControl label="보기" value={filter} onChange={setFilter}
  options={[{ value: 'all', label: '전체' }, { value: 'changed', label: '바꾼 것', count: 3 }, { value: 'conflict', label: '겹침', count: 1, warning: true }]} />
```

- props: `options`(`value`, `label`, `icon`, `count`, `warning`, `disabled`), `value`, `onChange`, `label`(묶음 이름), `fill`, `kind` `'radio'`(기본) | `'tabs'` | `'toggle'`, `disabled`.
- 클래스: 홈 `ll-seg`, 칸 채움 `ll-seg--fill`, 항목 `ll-seg__item`, 아이콘 항목 `ll-seg__item--icon`, 이름 `ll-seg__label`(말줄임이 필요할 때 감쌈), 개수 `ll-seg__count`, 경고 개수 `ll-seg__count--warning`.

## 시안과 달라진 점

- Reflow, ImportSave: 구성(기본, 주일용, 짧게) 항목 24px 좌우 12 → 22px 좌우 10(홈 28 → 26).
- Screens(종류, 방식), Media(끝나면, 맞춤), StageEditor(보여 줄 것), Prefs(채널): 칸 채움 항목 24px → 22px(홈 28 → 26), 좌우 0 → 8.
- StageEditor: 속성 탭(바닥 홈 안 26px 항목, 고른 항목 굵게) → 22px 항목, 굵기 400 고정.
- StageEditor, Looks: 정렬 아이콘 항목 최소 너비 32, 높이 24 → 22×28, 아이콘 14.
- Prefs, Shortcuts: 거르기 항목 26px → 22px. 개수 배지(16px 둥근 칩, 바탕 #2a2a2a와 겹침 #4a3410, 10px 700) → 바탕 없는 11px 숫자(`text-3`, 겹침은 `warning`).
