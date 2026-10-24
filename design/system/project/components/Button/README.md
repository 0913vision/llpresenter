# Button

글자로 된 명령 버튼입니다. 대화상자와 확인 창의 바닥글, 환경설정, 패널 안의 작은 조작에 씁니다.

## 쓰는 곳

- 대화상자와 확인 창의 바닥글: [취소] … [새 곡으로 저장] [덮어쓰기], [새로 시작] [복구하고 시작] (md)
- 환경설정 줄 끝의 조작: 지금 백업, 지금 확인, 바꾸기, 기본값으로, 모두 기본값으로 (md)
- 패널 머리글과 캡션 줄의 조작: 라이브러리 곡 편집, 가져오기, 버리기, 저장 (sm)
- 목록 끝에서 항목을 더하는 덜 중요한 명령: 역본 추가, 지금 예배를 틀로 저장 (투명)

## 쓰지 않는 곳

- 값을 고르는 드롭다운(글자 오른쪽에 화살표가 있는 버튼): Select를 씁니다.
- 아이콘만 있는 버튼: IconButton. 툴바의 아이콘 위 이름 버튼: ToolbarButton. 진행 화면의 지우기 줄: ClearButton.
- 여러 값 가운데 하나를 고르는 묶음: SegmentedControl.
- 상태 표시: 출력 중이나 경고를 버튼 색으로 알리지 않습니다. 빨강, 주황, 초록 버튼은 두지 않습니다. 지우기처럼 되돌릴 수 없는 명령도 보조 버튼으로 두고 확인 창에서 묻습니다.

## 구성

- 바탕: 보조 `bg-control`, 주 `accent-fill`, 투명은 바탕 없음. 모서리 `radius-md`(4px). 테두리와 그림자는 없습니다.
- sm: 높이 `size-control-sm`(26px), 글자 `label`(12/16), 좌우 `space-10`. 앞 아이콘이 있으면 왼쪽만 `space-8`, 아이콘 `size-icon-14`, 아이콘과 글자 사이 `space-6`.
- md: 높이 `size-control-md`(30px), 글자 `body`(13/18), 좌우 `space-14`. 앞 아이콘이 있으면 왼쪽만 `space-12`, 아이콘 `size-icon-16`, 사이 `space-8`.
- 주 버튼 글자는 굵기 600입니다(sm `label-strong`, md `body-strong`).
- 아이콘은 글자색을 따릅니다. 보조는 `text`, 주는 `text-on-fill`, 투명은 `text-2`.
- 너비는 글자에 맞춥니다. 최소 너비를 두지 않고 줄 바꿈하지 않습니다.
- 버튼 사이는 `space-8`입니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 주 md | `size-control-md` 30 | `body-strong`, `text-on-fill` | 대화상자, 확인 창 바닥글 맨 오른쪽. 한 창에 하나 |
| 주 sm | `size-control-sm` 26 | `label-strong`, `text-on-fill` | 패널 안에서 그 자리를 마무리하는 명령(가져온 곡의 저장) |
| 보조 md | 30 | `body`, `text` | 대화상자, 확인 창, 환경설정 |
| 보조 sm | 26 | `label`, `text` | 패널 머리글, 캡션 줄, 속성 칸 |
| 투명 md / sm | 30 / 26 | `body` / `label`, `text-2` | 목록 끝의 추가처럼 눈에 덜 띄어야 하는 명령 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | 보조 `bg-control`, 주 `accent-fill`, 투명 없음 | `text`, `text-on-fill`, `text-2` | |
| 마우스 올림 | 보조 `bg-control-hover`, 주 `accent-fill-hover`, 투명 `bg-raised` | 그대로 | 바탕 100ms ease-out |
| 누름 | 보조 `bg-control-hover`, 주 `accent-fill-hover`, 투명 `bg-control-hover` | 투명만 `text`로 | |
| 포커스 | 그대로 | 그대로 | 키보드 포커스에만 `outline: 2px solid accent`, offset 1px |
| 쓸 수 없음 | 보조와 주 모두 `bg-control`, 투명 없음 | `text-off` | hover와 누름 없음. 투명도를 낮추지 않습니다. 이유는 툴팁으로 |

## 동작

- Enter와 Space로 누릅니다. 대화상자 안에서는 Enter가 주 버튼, Esc가 [취소]와 같습니다(Dialog가 처리합니다).
- 포커스 순서는 보이는 순서(왼쪽에서 오른쪽)입니다.
- 쓸 수 없는 버튼은 `disabled` 대신 `aria-disabled="true"`로 만들고 누름을 무시합니다. 포커스가 남고 툴팁으로 이유를 보일 수 있습니다. CSS는 두 방식을 모두 받습니다.
- 마우스로 누르면 포커스 고리를 그리지 않습니다(`:focus-visible`만).
- 아이콘은 `aria-hidden`입니다. 이름은 버튼 글자가 맡습니다.

## 글쓰기

- 무엇이 일어나는지 동사로 씁니다: 만들기, 가져오기, 덮어쓰기, 새 곡으로 저장, 복구하고 시작, 바꾸기.
- "확인", "예", "아니요"를 쓰지 않습니다. 확인 창에서도 [덮어쓰기]처럼 그 일을 씁니다. 그만두는 버튼은 언제나 "취소"입니다.
- 두세 낱말로 짧게 씁니다. 버튼 옆에 설명 문구를 붙이지 않고, 필요하면 툴팁에 씁니다.
- 마침표, 느낌표, 말줄임표를 붙이지 않습니다.

## 구현 메모

```jsx
<Button variant="secondary" size="sm" icon="edit">라이브러리 곡 편집</Button>
<Button size="md">취소</Button>
<Button variant="primary" size="md" onClick={overwrite}>덮어쓰기</Button>
<Button variant="ghost" size="md" icon="plus">역본 추가</Button>
<Button variant="primary" size="md" disabled title="곡 제목을 적어야 저장할 수 있습니다">저장</Button>
```

- props: `variant` `'secondary'`(기본) | `'primary'` | `'ghost'`, `size` `'sm'`(기본) | `'md'`, `icon` 아이콘 키(글자 앞), `disabled`(`aria-disabled`로 그림), `title`(툴팁 문구, Tooltip이 그림).
- 클래스: `ll-btn`, 변형 `ll-btn--primary` `ll-btn--ghost`, 크기 `ll-btn--md`(sm은 클래스 없음), 앞 아이콘이 있으면 `ll-btn--lead`. 아이콘은 `<span class="ll-i ll-i-<키>" aria-hidden="true">`이고 크기는 버튼이 정합니다.
- `00-base.css`의 `.ll-root button { font: inherit; color: inherit }`가 특이도 0,1,1이라 블록 규칙은 `.ll-root .ll-btn`으로, 변형은 `.ll-btn.ll-btn--x`로 한 단 올려 두었습니다. 옮길 때 이 순서를 지킵니다.
- `.is-hover`, `.is-active`, `.is-focus`는 미리보기에서 상태를 고정하는 클래스입니다. 앱 코드에는 쓰지 않습니다.

## 시안과 달라진 점

- 모든 보드: 주 버튼 바탕 #3d8bf0 → `accent-fill`(#2a70dc), 같은 색의 hover → `accent-fill-hover`.
- NewService, ServiceImport: [취소] 12px → 13px(`body`), [만들기] [가져오기] 12px 좌우 16 → 13px 600 좌우 14.
- ImportSave: 확인 창의 [취소] [새 곡으로 저장] 바탕 #333333 → `bg-control`. 패널 안 [저장] 좌우 14 → 10, 앞 6px → 버튼 사이 `space-8`.
- ImportEdit: 패널 안 [저장] 좌우 14 → 10, [버리기] 좌우 12 → 10.
- ImportText: [편집] 32px 좌우 18 → md 30, 좌우 14.
- Recovery: [새로 시작] [복구하고 시작] 높이 32 → 30(md), 주 버튼 좌우 16 → 14.
- Prefs, Shortcuts: 28px 버튼(바꾸기, 지금 백업, 지금 확인, 기본값으로, 지우기, 모두 기본값으로) 12px 좌우 12 → md 30, 13px, 좌우 14(앞 아이콘이 있으면 왼쪽 12, 아이콘 14 → 16). "역본 추가" 32px 12px → 투명 md 30, 13px, 아이콘 16.
- NewService: "지금 예배를 틀로 저장" 32px 12px 아이콘 14 → 투명 md 30, 13px, 아이콘 16.
- Overlays [보내기], Bible [바로 띄우기]: 패널 안의 30px 주 버튼 → sm 26(12px 600, 앞 아이콘 14, 왼쪽 8).
