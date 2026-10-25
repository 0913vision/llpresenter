# 시안 보드를 디자인 시스템에 맞추는 변경 목록

디자인 시스템(`ds/project/`)이 기준이다. 아래는 컴포넌트를 만든 네 작업자가 보고한 "시안과 달라지는 점"을 모은 것이다. 값 이름(`bg-control` 등)은 `ds/project/tokens.json`의 토큰이며, 보드에서는 그 hex 값을 쓴다.

자주 쓰는 hex: bg-app #0e0e0e, bg-sunken #0b0b0b, bg-well #121212, bg-panel #1c1c1c, bg-inset #1a1a1a, bg-dialog #1f1f1f, bg-toolbar-hover #232323, bg-raised #262626, bg-control #2a2a2a, bg-control-hover #333333, selection #1f4170, line #2b2b2b, line-strong #3a3a3a, line-control #6e6e6e, text #ececec, text-2 #b4b4b4, text-3 #8c8c8c, text-off #6e6e6e, text-on-selection #b4c6e0, accent #3d8bf0 (선), accent-fill #2a70dc (면), accent-fill-hover #2566cc, live #d2343a, warning #e3a23b, warning-tint #33280f, scrim rgba(0,0,0,0.6), scrim-strong rgba(0,0,0,0.72), ring-field `inset 0 0 0 1px #2b2b2b`, shadow-popover `0 0 0 1px #3a3a3a, 0 8px 24px rgba(0, 0, 0, 0.5)`, shadow-dialog `0 0 0 1px #3a3a3a, 0 16px 48px rgba(0, 0, 0, 0.6)`.

## 공통 규칙 (모든 보드)

- 주 버튼, 켜진 체크 상자, 켜진 스위치의 면 #3d8bf0 → #2a70dc. (#3d8bf0은 포커스 고리, 고른 썸네일 테두리, 끌어 넣을 자리 선, 입력 칸 포커스 같은 "선"에만 남긴다.)
- 버튼과 입력 칸 높이는 26(sm, 12px 글자, 좌우 10, 앞 아이콘 있으면 왼쪽 8)과 30(md, 13px 글자, 좌우 14, 앞 아이콘 있으면 왼쪽 12) 두 가지. 24, 28, 32px 버튼은 없앤다(메뉴줄 항목 24, 창 조절 46×30, 툴바 버튼 48, 지우기 52, 세그먼트 항목 22는 예외). 패널 안은 sm, 대화상자/확인 창/환경설정/툴바 검색은 md.
- 아이콘만 있는 버튼 28×28 → 패널 안 26×26, 대화상자 닫기 30×30.
- 보조 버튼의 쉬는 바탕은 어디서나 #2a2a2a(확인 창의 #333333 → #2a2a2a). 드롭다운(Select) 바탕 #262626 → #2a2a2a, 화살표 14 → 12, 왼쪽 여백 md 10 / sm 8.
- 꺼진 체크 상자 테두리, 틀의 빈 자리 점선 #4a4a4a → #6e6e6e.
- 지울 것 없는 지우기 버튼과 되돌림 글자 #5c5c5c → #6e6e6e.
- 경고 바탕 #2a2210, #4a3410 → #33280f. 선택 위 글자 #cfe0f7 → #b4c6e0. 속성 구분선 #222222, #262626 → #2b2b2b. 글쇠 바탕 #2f2f2f → #2a2a2a.
- 대화상자 그림자 `0 20px 48px` → `0 16px 48px`, 메뉴 그림자 `0 12px 32px` → `0 8px 24px`. 대화상자 막은 메뉴줄 아래부터(top 30px), 색 rgba(0,0,0,0.6).
- 메뉴 항목 30/32 → 28.
- 슬라이더는 브라우저 기본 range 대신 ds의 `ll-slider` 모양(줄 4px `text`, 손잡이 12px `text`).
- 설명 문구 금지 규칙은 그대로.

## 1. 버튼과 앱 틀 작업자

**모든 보드 (assemble.js)**
- 메뉴줄 바탕 #0b0b0b → bg-app
- 툴바 검색 칸 420×32, #1c1c1c, 모서리 5, 돋보기 14 → 420×30, bg-well + ring-field, radius-md(4), 돋보기 16, 좌우 10
- 툴바 구분선 높이 32 → 24
- 출력 점 7px(오른쪽 −5) → 6px(위 −3, 오른쪽 −4). 꺼진 출력은 점 없음(회색 점 #3a3a3a 없앰), 아이콘과 이름 #6e6e6e
- Look 화살표 14 → 12
- 주 버튼 #3d8bf0 → accent-fill

**진행 화면**
- ShowH, Bible: 꺼진 출력의 회색 점 → 점 없음. 지울 것 없는 버튼과 되돌림 글자 #5c5c5c → text-off(Problems도 같음)
- Problems: 모니터 없음 출력 버튼의 바탕 #2a2210과 이름의 주황 → 바탕 없음, 아이콘과 점만 warning. 툴팁 → "무대 화면: 모니터 3을 찾을 수 없습니다"
- Compact: 툴바 44 → 40. 작업 공간 탭 바닥 홈(#161616) 없앰, 고른 탭 #2f2f2f → bg-raised, 탭/Look/출력 버튼 30 → 32, 모서리 4 → 5, 탭 글자 굵기 500 → 400. 미디어 버튼 34 → 32. 검색 칸 12px → 13px, bg-well + ring-field. 지우기 "모두" 1.6배 → 1.4배, 10px 이름 없앰, 구분선 26 → 24, 툴팁에 단축키 추가. 상태 표시줄 24 → 28, 사이 14 → 18, 좌우 16 → 18, 저장 아이콘 12 → 14, 출력 이름에 fps 추가. 사이드바 접기 버튼 24 #8c8c8c → 26 text-2

**대화상자와 확인 창**
- NewService, ServiceImport: 닫기 28 → 30. [취소], [만들기], [가져오기] 12px → 13px, 주 버튼 좌우 16 → 14
- ImportSave: 확인 창의 보조 버튼 #333333 → bg-control. 패널 안 [저장] 좌우 14 → 10, 앞 6px 틈 → 버튼 사이 8
- ImportEdit: [저장] 좌우 14 → 10, [버리기] 좌우 12 → 10
- ImportText: [편집] 32 → 30, 좌우 18 → 14
- Recovery: 버튼 32 → 30
- Prefs, Shortcuts: 28px 버튼 → md 30, 13px. "역본 추가"(32px, 12px) → 투명 md 30. 거르기 세그먼트 항목 26 → 22, 개수 칩 → 바탕 없는 숫자. 보조 창 제목줄 32, #0b0b0b → 30, bg-app
- NewService "지금 예배를 틀로 저장"(32px, 아이콘 14) → 투명 md 30, 아이콘 16

**패널 안 조작**
- Overlays: 반복 켜짐(바탕 없음) → bg-control-hover + text. 내리기 아이콘 14 text-3 → 16 text-2(ShowH도 같음)
- StageEditor: 비율 고정, 격자에 맞추기 28 / 아이콘 14 / 켜짐 #262626 → 26 / 아이콘 16 / 켜짐 bg-control-hover. 속성 탭 26px(고른 항목 굵게) → 22px, 굵기 400 고정. 정렬 아이콘 세그먼트 32×24 → 28×22(Looks도 같음)
- Reflow, ImportSave: 구성 세그먼트 항목 24(좌우 12) → 22(좌우 10)
- Screens, Media, StageEditor, Prefs: 칸을 채우는 세그먼트 항목 24 → 22
- PrepService, NewService, AddSongs, Media: 패널 안 28×28 아이콘 버튼 → 26×26

## 2. 입력 작업자

**공통 (여러 보드)**
- 툴바 검색: 위 1과 같음
- 패널 안 검색과 퀵 실행: 좌우 6 → 10, 아이콘과 글자 사이 10 → 8
- 속성 칸의 입력 칸과 드롭다운: 28 → 30
- 드롭다운 바탕 #262626 → bg-control, 화살표 14 → 12
- 켜진 체크 상자와 스위치: #3d8bf0 → accent-fill. 스위치 손잡이 #fff → text
- 꺼진 체크 상자 테두리: #4a4a4a → line-control
- 썸네일 크기/음량 슬라이더: 브라우저 기본 range → ll-slider
- 속성 묶음 구분선: #262626 → line

**보드별**
- PrepService: 메모 줄 높이 20 → 18. 미디어 40×24 → 36×20. 매크로 칸 22 → 20. 부가 정보 #8c8c8c → text-2. 속성 줄 40 → 36
- NewService: 날짜/시간에 화살표 추가, 아이콘 14 #8c8c8c → 16 text-2. 체크 줄 28 → 30
- Compact: 퀵 실행 28 → 26. 기본 배경 24 → 26, 미디어 32×18 → 36×20
- Bible: 참조 24 → 26, 바탕 → bg-control. 역본 아이콘 → text-2
- Macros: 동작 찾기 28 → 26. 색 줄: 사이 5 → 0, 고리 → 칸 안쪽 2px(text), 색 순서는 토큰 순서(teal green yellow orange rose violet slate gray). 메뉴 너비 210 → 240, 줄 높이 32 → 28
- Reflow 이름표 메뉴: 색 18 → 16, 칸 사이 4 → 0, 고리는 칸 바깥 → 안쪽, 없음 x #6e6e6e → text-2
- ServiceImport: 체크 줄 28 → 30
- Recovery: 줄 36 → 30, 상자와 아이콘 사이 12 → 10
- Looks: 층 목록 줄 34 → 30. 속성 줄 38 → 36, 줄마다 있던 선 없앰. 두 단 사이 28 → 24
- Screens, ScreensNDI: 이름 칸 112 → 84. Media: 이름 칸 96 → 84
- Prefs, Shortcuts: 글쇠 바탕 #2f2f2f → bg-control, 좌우 5 → 6, 글쇠 사이 3 → 4. 바꾼 단축키의 파란 점 → selection 바탕. 없음 #6e6e6e → text-3. 키 입력 칸 24 → 26. 묶음 여백 14/8 → 12/8
- Overlays, Media: 음량 아이콘 16 → 14

## 3. 목록, 패널, 떠 있는 창 작업자

**패널**
- 모든 보드의 패널 머리글: 34px + 아래 선 1px(합 35) → 선 포함 34
- ShowH 진행 도구 탭: 사이 14 → 18, 오른쪽 여백 14 → 8, 꺼진 탭 굵기 500 → 600
- Compact: 패널 머리글 안쪽 12/6 → 14/8. 진행 도구 탭 사이 12 → 18, 꺼진 탭 굵기 500 → 600. 예배 순서 머리글의 아이콘 버튼 사이 0 → 8, 퀵 실행 도구 줄 6 6 4 → 8 8 6. 예배 순서 머리글에 "주일 예배 ▾" 이름 버튼이 없으면 다른 보드처럼 넣는다
- 예배 고르기 버튼(머리글의 "주일 예배 ▾") 높이 24 → 26: ShowH, PrepService, Reflow, ServiceSwitch, AddSongs, AddSongsQuick, Bible, ImportEdit, ImportSave, ImportText, NewService, ServiceImport, Problems

**목록 줄**
- ShowH, Compact 퀵 실행: 켜진 줄 바탕 #262626 → bg-control-hover(+ 왼쪽 3px live 막대가 이미 있으면 유지). 꺼진 줄 글자 #cfcfcf → text, 아이콘 #8c8c8c → text-2, 오른쪽 여백 12 → 14
- Compact 목록 줄: 줄 28 → 30, 글자 12px → 13px, 아이콘 14 → 16. 아이콘과 글자 사이 8 → 10, 좌우 12 → 14. 묶음 머리글 안쪽 8 12 4 → 10 14 5, LIVE 배지 → 16px 높이, 10px 700, 좌우 4, radius 3
- NewService, ServiceImport 왼쪽 목록: 빈 예배 줄 36 → 30, 묶음 머리글 위 12 → 10
- NewService 빈 자리 점선 #4a4a4a → line-control
- AddSongs 끌고 있는 줄: 바탕 rgba(42,42,42,.95) → bg-control, 더하기 원 #3d8bf0 → accent-fill, 그림자 → shadow-popover

**메뉴**
- ServiceSwitch 항목 30 → 28
- ImportMenu 하위 메뉴 아이콘 16 → 14
- Reflow 이름표 메뉴: 항목 30 → 28, 체크 오른쪽 끝 → 앞 칸(14px), 구분선 위아래 6 → 4, "새 이름표" 글자 text-2 → text
- Macros, ClearGroups 삭제 글자 #e07a7a → text(빨강은 출력에만)
- Macros 우클릭 메뉴 너비 210 → 240

**대화상자**
- NewService, ServiceImport: 닫기 28 → 30, 바닥글 버튼 글자 12px → 13px, 주 버튼 #3d8bf0 → accent-fill, 주 버튼 좌우 16 → 14
- NewService 입력 줄 60 → 52, 날짜/시간 드롭다운 바탕 #262626 → bg-control
- ImportText: 너비 980 → 1080, 머리글 48 → 44, 제목 14px → 13px. 좌우 여백 18 → 16, 옵션 줄 항목 사이 28 → 20. 바닥글 56 → 52, 버튼 32 → 30. 그림자 → shadow-dialog, 막 창 전체 → 메뉴줄 아래부터

**확인 창**
- ImportSave: 바탕 #262626 → bg-dialog, 막(0.45, 창 전체) → scrim(메뉴줄 아래부터). 아이콘 칸 36×36(1px 테두리, 아이콘 18) → 40×40 radius 5, bg-panel(테두리 없음, 아이콘 24 text-2). 제목 14/20 → 16/22, 제목과 부가 정보 사이 6 → 2. 보조 버튼 #333 → bg-control, 주 버튼 → accent-fill
- Recovery: 아이콘 칸 #262626 → bg-panel, 아이콘 text → text-2. 머리 묶음 가운데 정렬 → 위 정렬, 제목과 부가 정보 사이 3 → 2. 묶음 이름 위아래 12/6 → 10/5. 바닥글(위 선, 높이 60) → 선 없는 버튼 줄(위 20), 버튼 32 → 30

**알림**
- Problems 알림 카드: bg-panel, 모서리 5, 그림자 없음 → bg-raised, radius 8, shadow-dialog. 닫기 아이콘 14px #8c8c8c → 16px text-2, 부가 줄 화살표 #6e6e6e → text-3, 제목 줄과 부가 줄 사이 3 → 2

## 4. 진행 요소와 배치 작업자

| 보드 | 바뀌는 값 |
|---|---|
| ShowH | 썸네일 슬라이더 6–2열 → 2–8열. 가사 `48/열 수`px → 캔버스 너비 × 0.044. 썸네일 hover 없음 → 1px line-control. 미리보기 틀 모서리 3 → 4, 작은 칸 이름 #cfcfcf → text-2. 미디어 줄: 출력 중 고리 2 → 3px, 이름 #d6d6d6 → text-2, 이름 위 간격 7 → 8, 길이 칩 5 → 6, 반복 아이콘 14 → 12, 바탕 0.72 → scrim-strong, 패널 220 → 170. LIVE 배지 좌우 5 → 4. 툴바 출력 점 7 → 6. 탭 개수 16px 알약(#3a3a3a) → 18px radius 3, selection 바탕 + text-on-selection 11/600 |
| Compact | 툴바 44 → 40. 상태 표시줄 24 → 28. 썸네일 띠 22/11 → 24/12, 격자 틈 12/10 → 16/12, 패널 안쪽 12 → 14. 작은 미리보기 80 → 64, 사이 8 → 10. LIVE 배지 15/9 → 16/10. 메시지 탭 → 더 보기 안으로. 더 보기 개수 알약 없앰 |
| PrepService | 칩 모서리 4 → 3, 사이 6 → 8, 고름 흰 1px → 2px 틈(bg-panel) + accent 2px, hover #333 → 손잡이만 불투명, 이름표 없음 글자 #b4b4b4 → label-gray(#a3a3a3), 넣기 점선 #4a4a4a → line-control. 미리보기 틀 3 → 4 |
| Reflow, ImportEdit, ImportSave | 이름표 칩 24 → 22. 이름표 없음 글자 #8c8c8c → label-gray. 화살표 불투명도 0.7 → 1. 활성 블록의 흰 고리 → 메뉴 열림일 때만. Reflow 슬라이드 패널 격자 틈 14/12 → 16/12, 가사 11px → 너비 × 0.044 |
| ImportText | 이름표 24 → 22 |
| Problems | 빗금 #1a1a1a/#151515 → bg-inset/bg-well. 칸 안 "다시 연결" 버튼과 "파일 없음" 글자 없앰. "⚠ 창으로 표시 중" → "⚠ 모니터 3"(warning) + 툴팁. 미디어 고리 2 → 3, 미디어 줄 220 → 170 |
| Media | 격자 틈 18/14 → 16/12. 이름 #cfcfcf → text-2. 길이 칩 20 → 18. 복사 중(불투명도 0.35 + 막 0.45 + 글자) → scrim + 퍼센트. 막대 3px #2b2b2b(바닥 끝) → 4px 진행 막대(안쪽 6) |
| Macros, Overlays | 매크로 이름 #cfcfcf 500 → text-2 400. 새 매크로 점선 #4a4a4a → line-control. 목록 보기 34px 칸 + 동작 칩 → 30px 줄 + 20px 색 칸 + "동작 N개", 마지막 실행 줄 바탕 #232323 → 이름 굵기 600 |
