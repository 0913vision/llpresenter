# IconButton

아이콘만 있는 정사각형 투명 버튼입니다. 패널 머리글의 추가, 목록 줄 끝의 내리기, 대화상자 닫기, 켜고 끄는 작은 도구에 씁니다.

## 쓰는 곳

- 패널 머리글 오른쪽: 항목 추가, 새 곡, 퀵 실행 추가, 구성 추가, 새 매크로 (sm)
- 목록 줄 끝: 진행 도구 표시 중 목록의 내리기, 라이브러리 곡 열기 (sm)
- 켜고 끄는 도구(`aria-pressed`): 오디오의 반복, 무대 배치의 비율 고정과 격자에 맞추기 (sm)
- 메뉴를 여는 더 보기(`aria-expanded`) (sm)
- 대화상자 머리글의 닫기 (md)

## 쓰지 않는 곳

- 격자 보기와 목록 보기처럼 둘 가운데 하나를 고르는 묶음: SegmentedControl의 아이콘 항목을 씁니다.
- 툴바: ToolbarButton. 메뉴줄의 창 조절 버튼(46×30): MenuBar.
- 바탕이 채워진 아이콘 버튼은 두지 않습니다. 눌러서 바로 실행되는 중요한 명령은 글자를 붙여 Button으로 만듭니다.
- 빈 자리에 장을 넣는 점선 칸은 이 컴포넌트가 아닙니다.

## 구성

- 크기: sm `size-control-sm`(26×26), md `size-control-md`(30×30). 아이콘은 두 크기 모두 `size-icon-16`.
- 모서리 `radius-md`(4px), 바탕 없음, 아이콘 `text-2`.
- 패널 머리글에 둘 때는 머리글 오른쪽 여백 `space-8` 안에 붙이고, 여러 개면 사이 `space-4`.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| sm | `size-control-sm` 26×26 | 아이콘 16 `text-2` | 패널 머리글, 목록 줄, 패널 안 도구 |
| md | `size-control-md` 30×30 | 아이콘 16 `text-2` | 대화상자 머리글의 닫기, 대화상자 안 도구 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | 없음 | `text-2` | |
| 마우스 올림 | `bg-raised` | `text-2` | 100ms ease-out |
| 누름 | `bg-control-hover` | `text` | |
| 켜짐(`aria-pressed="true"`), 메뉴 열림(`aria-expanded="true"`) | `bg-control-hover` | `text` | 마우스를 올려도 그대로 |
| 포커스 | 그대로 | 그대로 | 키보드 포커스에만 `outline: 2px solid accent`, offset 1px |
| 쓸 수 없음 | 없음 | `text-off` | hover 없음, 이유는 툴팁으로 |

## 동작

- Enter와 Space로 누릅니다. 켜고 끄는 버튼은 누를 때마다 `aria-pressed`를 바꿉니다.
- 글자가 없으므로 `aria-label`을 꼭 줍니다. 툴팁은 같은 이름을 보이고, 단축키가 있으면 이름 뒤에 붙입니다(닫기 Esc).
- 켜고 끄는 버튼의 이름은 상태와 상관없이 같게 둡니다(반복). 켜짐은 `aria-pressed`가 알립니다.
- 메뉴를 여는 버튼에는 `aria-haspopup="menu"`와 `aria-expanded`를 줍니다.
- 쓸 수 없을 때는 `aria-disabled="true"`를 써서 툴팁이 보이게 합니다.
- 목록 줄 끝의 버튼은 줄 안에서 Tab으로 갈 수 있게 두되, 줄을 누르는 동작과 겹치지 않게 이벤트 전파를 막습니다.

## 글쓰기

- `aria-label`과 툴팁은 명사나 동사로 짧게 씁니다: 항목 추가, 새 곡, 내리기, 닫기, 반복, 격자에 맞추기, 비율 고정.
- "버튼", "클릭" 같은 말을 넣지 않습니다.

## 구현 메모

```jsx
<IconButton icon="plus" label="항목 추가" />
<IconButton icon="loop" label="반복" pressed={loop} onPressedChange={setLoop} />
<IconButton icon="more" label="메뉴" menu expanded={open} />
<IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
```

- props: `icon`, `label`(aria-label과 툴팁), `size` `'sm'`(기본) | `'md'`, `pressed`(있으면 켜고 끄는 버튼), `expanded`와 `menu`(메뉴를 여는 버튼), `shortcut`(툴팁에 붙일 단축키), `disabled`.
- 클래스: `ll-iconbtn`, `ll-iconbtn--md`. 아이콘은 `<span class="ll-i ll-i-<키>" aria-hidden="true">`이고 크기는 버튼이 16으로 맞춥니다.

## 시안과 달라진 점

- NewService, ServiceImport: 대화상자 닫기 28×28 → 30×30(md).
- PrepService, NewService, ServiceImport, AddSongs, Media: 패널 안 28×28 버튼(라이브러리 곡 열기 등) → 26×26.
- ShowH, Overlays: 내리기 아이콘 14px `text-3` → 16px `text-2`.
- Overlays: 반복 켜짐이 바탕 없이 #ececec → `bg-control-hover` + `text`.
- StageEditor: 비율 고정, 격자에 맞추기 28×28 아이콘 14 → 26×26 아이콘 16. 켜짐 바탕 #262626 → `bg-control-hover`, 꺼짐 아이콘 #8c8c8c → `text-2`.
- Prefs, Bible, Problems: 26×26 버튼의 아이콘 #8c8c8c → `text-2`.
- Compact: 사이드바 접기 24×24 #8c8c8c → 26×26 `text-2`.
