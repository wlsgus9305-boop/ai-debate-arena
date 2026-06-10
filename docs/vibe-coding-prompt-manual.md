# 아, 딸깍? 하고 싶다면 이거는 알아두세요

부제: 코딩을 몰라도 바이브코딩을 덜 헤매게 만드는 사람용 프롬프트 개념 사전

“딸깍?” 하고 끝내고 싶은데 용어 하나를 모르면 30분 동안 “아니 그거 말고, 잡히는 느낌 나게, 줄도 보이게, 밖으로 빼면 삭제처럼...”이라고 설명하게 되고, 개념 하나를 알면 `sortable drag-and-drop list with drag preview, insertion indicator, and trash drop zone` 한 문장으로 끝난다.

이 차이가 바이브코딩의 실력 차이다.

바이브코딩은 코딩을 잘 몰라도 누구나 시작할 수 있다.
하지만 “아무 말이나 길게 하면 AI가 알아서 해주겠지”라는 방식으로는 금방 한계에 부딪힌다.
AI는 똑똑하지만, 사용자가 어떤 UI 패턴과 어떤 동작 원리를 원하는지 모르면 계속 비슷하게 헛다리를 짚는다.

극단적으로 말하면, **딸깍은 아무나 할 수 있지만, 잘 딸깍하려면 최소한 자기가 시키는 기능의 이름과 구조는 알아야 한다.**
그걸 모르면 사람은 계속 감각을 설명하고, AI는 계속 추측하고, 토큰은 계속 녹는다.
토큰은 단순한 글자 수가 아니라 시간, 돈, 맥락, 집중력이다.

예를 들어 플레이어 순서를 드래그로 바꾸는 기능을 만들 때 이렇게 말할 수 있다.

```text
드래그하면 순서가 바뀌게 해줘.
근데 ... 버튼 말고 카드 아무 데나 잡히면 좋겠어.
드래그했을 때 진짜 집는 느낌도 나야 해.
여기 사이에 들어간다는 줄도 보여줘.
바깥으로 빼면 삭제한 것처럼 보여줘.
근데 너무 쉽게 삭제되면 안 돼.
```

이 말은 틀리지 않다.
오히려 사용자가 원하는 경험은 꽤 정확하다.
문제는 AI가 구현 방향을 바로 잡기에는 말이 너무 길고, 매번 해석 여지가 생긴다는 점이다.

같은 요구를 개발 개념으로 바꾸면 이렇게 된다.

```text
플레이어 목록을 sortable drag-and-drop list로 구현해줘.
카드 전체를 drag handle로 쓰되 input/select/button 같은 interactive element에서는 드래그가 시작되지 않게 해줘.
드래그 중에는 drag preview가 커서를 따라다니고, 원래 자리는 placeholder로 남겨줘.
항목 사이에는 insertion indicator를 보여줘.
삭제는 trash drop zone에 drop했을 때만 실행하고 destructive affordance를 명확히 표시해줘.
```

이 문장은 더 짧고, 더 정확하고, AI가 바로 구현 구조를 떠올리기 쉽다.
여기서 중요한 건 영어를 잘하는 것이 아니다.
`sortable list`, `drag preview`, `drop indicator`, `trash drop zone` 같은 “기능의 이름”을 아는 것이다.

이 문서는 AI에게 통째로 읽히려고 만든 프롬프트 모음이 아니다.
오히려 반대다.
사람이 직접 읽고 개념을 숙지해서, AI에게 덜 말하고 더 정확히 명령하기 위한 매뉴얼이다.

즉, 이 문서는 “AI야 이 문서 읽고 알아서 해줘”가 아니다.
“내가 이 정도는 알고 딸깍하겠다”에 가깝다.

목표는 세 가지다.

1. 코딩을 모르는 사람도 개발 개념을 감각적으로 이해하게 한다.
2. 불필요하게 길고 애매한 프롬프트를 줄인다.
3. AI가 바로 구현 방향을 잡을 수 있게 해서 시행착오와 토큰 낭비를 줄인다.

이 매뉴얼은 바이브코딩을 더 잘하기 위한 사람용 번역 사전이다.
“내가 원하는 느낌”을 “AI가 구현할 수 있는 구조”로 바꾸는 법을 익히는 데 목적이 있다.

핵심은 용어를 외우는 것이 아니라, 원하는 행동을 아래 구조로 말하는 것이다.

```text
이 기능을 <개발 용어> 방식으로 만들어줘.
사용자는 <상황>에서 <행동>할 수 있어야 해.
상태 변화는 <화면 피드백>으로 보여줘.
예외 상황은 <실패 처리>로 막아줘.
```

예시:

```text
플레이어 목록을 sortable drag-and-drop list로 만들어줘.
카드 전체를 드래그 영역으로 쓰되 input/select/button에서는 드래그가 시작되지 않게 해줘.
드래그 중에는 drag preview가 커서를 따라다니고, 항목 사이에는 insertion indicator를 보여줘.
삭제는 trash drop zone에 놓을 때만 실행하고 destructive state를 빨간색으로 표시해줘.
```

## 1. 화면 구성 / 레이아웃

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 화면을 크게 몇 구역으로 나누고 싶다 | Layout / Page Layout | 화면의 뼈대 | `이 화면을 좌측 설정 패널, 중앙 작업 영역, 우측 상세 패널을 가진 3-column layout으로 구성해줘.` |
| 왼쪽 메뉴, 오른쪽 내용 | Sidebar Layout | 앱에서 흔한 좌측 메뉴 구조 | `좌측 sidebar navigation과 우측 main content layout으로 만들어줘.` |
| 위에 고정된 바 | Top Bar / Header | 상단 제목, 상태, 버튼 영역 | `상단에 sticky top bar를 두고 현재 상태와 주요 액션 버튼을 보여줘.` |
| 아래에 계속 보이는 조작바 | Sticky Bottom Bar | 스크롤해도 아래에 붙는 바 | `중요한 실행 버튼은 sticky bottom action bar로 고정해줘.` |
| 카드들이 반응형으로 줄바꿈 | Responsive Grid | 화면 크기에 맞춰 카드 배치 변경 | `카드 목록을 responsive grid로 만들고 모바일에서는 1열, 데스크톱에서는 3열로 보여줘.` |
| 화면이 작을 때 자동으로 바뀌게 | Responsive Design | PC/모바일 모두 자연스럽게 | `모바일 breakpoint를 고려해서 control panel은 위로, content는 아래로 쌓이게 해줘.` |
| 내용 폭이 너무 넓지 않게 | Max Width Container | 읽기 편한 최대 폭 제한 | `본문은 max-width container로 제한하고 가운데 정렬해줘.` |
| 화면 전체를 꽉 채우는 작업 영역 | Full-bleed Canvas / Workspace | 여백 없이 도구 화면처럼 | `작업 화면은 full-bleed workspace로 만들고 불필요한 카드형 감싸기는 줄여줘.` |
| 영역 사이에 선명한 경계 | Visual Hierarchy | 뭐가 중요한지 한눈에 | `section hierarchy가 보이도록 제목, 구분선, spacing을 체계화해줘.` |
| 큰 제목 말고 도구처럼 작게 | Dense Utility UI | 반복 작업용 조밀한 UI | `운영 도구처럼 dense utility UI로 만들고 글자와 패딩을 과하게 키우지 마.` |
| 카드가 너무 둥글지 않게 | Border Radius | 모서리 둥근 정도 | `카드는 6~8px radius로 절제해서 디자인해줘.` |
| 카드 안에 또 카드 넣지 않기 | Nested Card Avoidance | 카드 중첩 줄이기 | `카드 안에 또 floating card를 넣지 말고 section은 unframed layout으로 구성해줘.` |
| 표처럼 촘촘히 보여주기 | Data-dense Layout | 정보가 많은 업무 화면 | `이 화면은 data-dense layout으로 만들고 한눈에 비교 가능하게 해줘.` |
| 화면 안에서 스크롤되게 | Scroll Container | 특정 영역만 스크롤 | `메인 타임라인만 scroll container로 만들고 상단 설정은 고정해줘.` |
| 자동으로 높이 맞추기 | Auto Layout | 내용에 맞춰 늘고 줄기 | `콘텐츠 길이에 따라 카드 높이가 자연스럽게 늘어나는 auto layout으로 구성해줘.` |
| 정해진 비율 유지 | Aspect Ratio | 이미지/보드 비율 고정 | `미리보기 영역은 16:9 aspect-ratio를 유지하게 해줘.` |
| 버튼들이 줄어들어도 안 깨지게 | Flexible Wrapping | 좁을 때 줄바꿈 | `버튼 그룹은 flex-wrap을 적용해서 모바일에서 겹치지 않게 해줘.` |
| 빈 상태 화면 | Empty State | 아직 데이터 없을 때 화면 | `데이터가 없을 때 empty state를 보여주고 다음 행동 버튼을 함께 제공해줘.` |
| 로딩 중 뼈대 화면 | Skeleton UI | 로딩 전 자리 표시 | `데이터 로딩 중에는 skeleton placeholder를 보여줘.` |
| 화면이 갑자기 흔들리지 않게 | Layout Stability | 로딩/상태 변화 때 위치 유지 | `동적 콘텐츠가 들어와도 layout shift가 생기지 않도록 높이와 영역을 안정적으로 잡아줘.` |

## 2. 버튼 / 입력 / 폼

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 입력창 아래에 실행 버튼 | Primary Action Placement | 주요 버튼 위치 | `주요 실행 버튼은 입력창 바로 아래 primary action으로 배치해줘.` |
| 엔터로 실행, 쉬프트엔터로 줄바꿈 | Keyboard Shortcut | 키보드 조작 | `textarea에서 Enter는 제출, Shift+Enter는 줄바꿈으로 처리해줘.` |
| 숫자 조절 | Stepper / Number Input | + - 또는 숫자 입력 | `라운드 수는 number input과 stepper UX로 조절하게 해줘.` |
| 켜고 끄기 | Toggle / Switch | on/off 설정 | `옵션은 checkbox 대신 switch toggle로 표현해줘.` |
| 여러 선택지 중 하나 | Segmented Control | 탭 같은 선택 버튼 | `모드 선택은 segmented control로 만들어줘.` |
| 드롭다운 | Select / Dropdown | 목록에서 선택 | `AI provider는 native select dropdown으로 선택하게 해줘.` |
| 직접 입력 옵션 | Custom Option | 목록 외 값 입력 | `모델 select에는 custom option을 두고 직접 model id를 입력할 수 있게 해줘.` |
| 입력값 검사 | Validation | 잘못 입력하면 막기 | `시작 전에 form validation을 수행하고 부족한 필드는 inline error로 보여줘.` |
| 빨간 오류 문구 | Inline Error | 해당 입력칸 근처 오류 | `필드별 오류는 input 바로 아래 inline validation message로 보여줘.` |
| 저장 전 확인 | Confirm Dialog | 위험 행동 전 확인 | `삭제 버튼은 confirm dialog를 거친 뒤 실행해줘.` |
| 되돌릴 수 있는 삭제 | Undoable Delete | 삭제 후 되돌리기 | `항목 삭제는 즉시 제거하되 toast에 Undo 버튼을 제공해줘.` |
| 제출 중 버튼 잠금 | Disabled Loading State | 중복 클릭 방지 | `제출 중에는 버튼을 disabled 처리하고 loading state를 표시해줘.` |
| 입력값 자동 저장 | Autosave | 사용자가 저장 안 눌러도 저장 | `설정 변경은 debounced autosave로 로컬 저장해줘.` |
| 마지막 입력 기억 | Persisted Form State | 새로고침해도 유지 | `폼 상태는 localStorage에 저장해서 새로고침 후에도 복원해줘.` |
| 복붙하기 쉬운 결과 | Copy to Clipboard | 복사 버튼 | `결과 카드에는 copy-to-clipboard 버튼을 추가해줘.` |
| 파일 끌어넣기 | Drag-and-drop Upload | 파일 업로드 영역 | `파일 업로드는 drag-and-drop upload zone으로 구현해줘.` |
| 여러 파일 업로드 | Multi-file Upload | 파일 여러 개 | `업로드 컴포넌트는 multiple files와 progress bar를 지원하게 해줘.` |
| 검색 입력 | Search Input | 빠른 필터 | `목록 상단에 search input을 두고 입력 즉시 filter되게 해줘.` |
| 선택 초기화 | Reset Action | 원래대로 버튼 | `필터 영역에 reset filters action을 추가해줘.` |
| 입력 보조 문구 | Helper Text | 입력칸 설명 | `각 입력 필드에는 짧은 helper text를 넣어 사용 의도를 알려줘.` |

## 3. 드래그 / 정렬 / 목록 조작

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 드래그로 순서 바꾸기 | Sortable List / Reorderable List | 목록 순서 변경 | `이 목록을 sortable drag-and-drop list로 만들어줘.` |
| 카드 전체를 잡아서 끌기 | Whole-card Drag | 손잡이 없이 카드 전체가 드래그 영역 | `카드 전체를 drag handle처럼 쓰되 input/select/button은 제외해줘.` |
| 손잡이만 잡고 끌기 | Drag Handle | 특정 아이콘만 드래그 가능 | `왼쪽 grip icon을 drag handle로 사용하게 해줘.` |
| 끌 때 카드가 따라오게 | Drag Preview / Drag Overlay | 떠 있는 미리보기 | `드래그 중에는 drag preview overlay가 커서를 따라다니게 해줘.` |
| 원래 자리에 흐린 표시 | Placeholder | 빠진 자리 표시 | `원래 위치에는 placeholder를 남겨 layout이 튀지 않게 해줘.` |
| 사이에 들어갈 선 | Insertion Indicator | 놓일 위치 표시 | `항목 사이에는 insertion indicator를 표시해줘.` |
| 삭제 영역에 놓으면 삭제 | Trash Drop Zone | 버리는 영역 | `목록 아래에 trash drop zone을 두고 그 위에 drop할 때만 삭제해줘.` |
| 삭제될 것처럼 빨갛게 | Destructive Drop State | 위험 행동 표시 | `삭제 가능 상태는 destructive drop state로 빨간 테두리와 라벨을 보여줘.` |
| 너무 쉽게 삭제되지 않게 | Drop Threshold / Hit Testing | 판정 범위 조절 | `삭제는 trash zone hit testing이 확실할 때만 실행하고 바깥 여백은 보수적으로 처리해줘.` |
| 드래그 중 자동 스크롤 | Auto-scroll on Drag | 끌다가 끝에 가면 스크롤 | `드래그 중 viewport edge에 가까워지면 auto-scroll 되게 해줘.` |
| 모바일 터치도 지원 | Pointer Events | 마우스/터치 통합 | `HTML drag API 대신 pointer events 기반으로 마우스와 터치를 모두 지원해줘.` |
| 순서 바뀐 뒤 저장 | Persist Reorder | 순서 저장 | `reorder가 끝나면 새 순서를 상태와 저장소에 반영해줘.` |
| 여러 개 선택해서 이동 | Multi-select Reorder | 여러 항목 동시 이동 | `checkbox multi-select 후 selected items를 한 번에 reorder할 수 있게 해줘.` |
| 그룹 사이로 이동 | Cross-list Drag | 목록 간 이동 | `backlog와 selected 리스트 사이에 cross-list drag-and-drop을 지원해줘.` |
| 드래그 취소 | Drag Cancel | ESC 또는 놓지 않기 | `Esc를 누르면 drag operation을 cancel하고 원래 순서로 복원해줘.` |

## 4. 테이블 / 리스트 / 데이터 보기

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 표 정렬 | Sortable Table | 컬럼 클릭 정렬 | `테이블 헤더 클릭으로 sortable columns를 지원해줘.` |
| 필터 | Filtering | 조건으로 줄이기 | `status, provider, date filter를 조합할 수 있게 해줘.` |
| 페이지 나누기 | Pagination | 1페이지, 2페이지 | `긴 목록은 pagination으로 나누고 page size를 선택하게 해줘.` |
| 무한 스크롤 | Infinite Scroll | 아래로 내리면 더 로드 | `히스토리는 infinite scroll로 추가 로드해줘.` |
| 많은 행 빠르게 | Virtualized List | 보이는 행만 렌더링 | `수천 개 항목도 버벅이지 않게 virtualized list로 구현해줘.` |
| 행 클릭 시 상세 | Master-detail View | 목록 + 상세 보기 | `왼쪽 리스트, 오른쪽 detail panel의 master-detail layout으로 만들어줘.` |
| 상태 배지 | Status Badge | 진행중/완료 표시 | `각 행에 status badge를 표시하고 색으로 상태를 구분해줘.` |
| 태그 | Tag / Chip | 작은 라벨 | `provider와 role은 chip 형태로 보여줘.` |
| 중요 항목 고정 | Pinning | 상단 고정 | `사용자가 항목을 pin하면 목록 상단에 고정해줘.` |
| 항목 접기 | Collapsible Row | 펼치기/접기 | `행을 클릭하면 expandable row로 세부 로그를 보여줘.` |
| 여러 항목 작업 | Bulk Actions | 일괄 삭제/이동 | `선택된 항목에 대해 bulk actions toolbar를 보여줘.` |
| 빈 검색 결과 | No Results State | 검색 결과 없음 | `필터 결과가 없으면 no results state와 reset 버튼을 보여줘.` |
| 날짜별 묶기 | Grouped List | 오늘/어제 그룹 | `세션 히스토리는 date grouped list로 묶어줘.` |
| 최근순 | Sort by Recency | 최신순 정렬 | `기본 정렬은 last updated desc로 해줘.` |
| 하이라이트 | Highlight Match | 검색어 강조 | `검색어와 일치하는 부분은 highlight match 처리해줘.` |

## 5. 모달 / 패널 / 내비게이션

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 팝업 창 | Modal Dialog | 화면 위에 뜨는 창 | `연결 관리는 modal dialog로 열고 배경 클릭이나 Esc로 닫히게 해줘.` |
| 옆에서 나오는 패널 | Drawer / Slide-over | 오른쪽에서 나오는 상세창 | `상세 설정은 right drawer로 열어줘.` |
| 접었다 펼치기 | Collapsible Panel | 숨기기/펼치기 | `추가 의견 패널은 collapsible panel로 만들고 상태를 기억해줘.` |
| 탭 전환 | Tabs | 여러 화면 전환 | `세션 상세는 Overview, Transcript, Secrets 탭으로 나눠줘.` |
| 단계별 진행 | Stepper / Wizard | 1단계 2단계 | `처음 설정은 wizard flow로 provider 연결, 참가자 선택, 주제 입력 순서로 안내해줘.` |
| 현재 위치 표시 | Breadcrumb | 경로 표시 | `상세 화면 상단에 breadcrumb navigation을 추가해줘.` |
| 뒤로 가기 유지 | Route State | 돌아왔을 때 상태 유지 | `목록에서 상세로 갔다 돌아와도 scroll position과 filters를 유지해줘.` |
| URL로 공유 | Deep Link | 특정 상태 링크 | `세션 상세는 deep link로 공유 가능하게 URL state를 반영해줘.` |
| 오른쪽 클릭 메뉴 | Context Menu | 우클릭 메뉴 | `카드에는 context menu를 추가해 duplicate, remove, rename을 제공해줘.` |
| 안내 풍선 | Tooltip | 마우스 올리면 설명 | `아이콘 버튼에는 accessible tooltip을 붙여줘.` |

## 6. 상태 표시 / 피드백 / 알림

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 지금 뭐 하는지 보여주기 | Activity Indicator | 현재 작업 상태 | `현재 AI가 생각 중인지 말하는 중인지 activity indicator로 보여줘.` |
| 진행률 | Progress Bar | 얼마나 진행됐는지 | `업로드와 실행에는 progress bar를 표시해줘.` |
| 잠깐 뜨는 알림 | Toast Notification | 저장됨 같은 알림 | `저장 성공/실패는 toast notification으로 보여줘.` |
| 로딩 스피너 | Spinner | 기다리는 표시 | `짧은 요청에는 spinner를, 긴 요청에는 progress text를 보여줘.` |
| 실패해도 다시 시도 | Retry Action | 재시도 버튼 | `네트워크 실패 시 retry action을 제공해줘.` |
| 사용자 입력 실수 방지 | Guardrail | 위험 행동 막기 | `세션 실행 중에는 참가자 설정 변경을 막는 guardrail을 넣어줘.` |
| 자동 스크롤 조건 | Conditional Auto-scroll | 맨 아래 볼 때만 자동 이동 | `사용자가 타임라인 하단에 있을 때만 auto-scroll하고, 위를 읽는 중이면 유지해줘.` |
| 아래로 이동 버튼 | Scroll-to-bottom Button | 맨 아래로 가기 | `새 이벤트가 생겼는데 사용자가 위에 있으면 scroll-to-bottom floating button을 보여줘.` |
| 읽지 않은 업데이트 | Unread Indicator | 새 글 있음 표시 | `사용자가 위를 읽는 동안 새 이벤트가 오면 unread updates indicator를 표시해줘.` |
| 연결 상태 | Connection Status | 온라인/오프라인 | `SSE 연결 상태를 connected/reconnecting/offline으로 표시해줘.` |
| 오래 걸림 경고 | Timeout Warning | 너무 오래 걸릴 때 | `AI 응답이 timeout threshold를 넘으면 warning state와 stop 버튼을 보여줘.` |
| 차단하지 않는 오류 | Non-blocking Error | 화면 유지하며 오류 표시 | `일부 provider 실패는 non-blocking error로 타임라인에 표시하고 다른 참가자는 계속 진행해줘.` |
| 성공 후 다음 행동 | Success State | 완료 후 뭐 할지 | `세션 종료 후 follow-up actions를 보여줘: 추가 의견, 복사, 히스토리 저장.` |
| 위험 색 | Destructive State | 삭제/실패 강조 | `삭제나 위험 행동은 destructive color와 confirm text로 구분해줘.` |
| 비밀 정보 구분 | Private/Secret Indicator | 관전자만 보는 정보 | `관전자 전용 정보는 secret indicator와 별도 스타일로 표시해줘.` |

## 7. 백엔드 / API / 데이터 흐름

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 서버에 요청 | API Endpoint | 프론트가 서버 부르는 주소 | `세션 시작은 POST /api/sessions endpoint로 처리해줘.` |
| 실시간 업데이트 | Server-Sent Events / WebSocket | 서버가 계속 밀어줌 | `실시간 타임라인은 Server-Sent Events로 스트리밍해줘.` |
| 작업 큐 | Job Queue | 오래 걸리는 작업 순서 관리 | `AI 실행은 job queue로 관리하고 동시에 하나씩 처리되게 해줘.` |
| 중간 상태 저장 | Snapshotting | 진행 중에도 저장 | `세션 이벤트는 진행 중에도 snapshot archive로 저장해 새로고침 복구가 가능하게 해줘.` |
| 기록 저장 | Persistence | 데이터 보존 | `완료된 세션은 logs/sessions에 JSON archive로 persist해줘.` |
| 임시 데이터 | In-memory State | 실행 중 메모리 | `실시간 세션 상태는 in-memory state로 두고 이벤트마다 archive를 갱신해줘.` |
| 파일 기반 저장 | File-backed Storage | DB 없이 파일 저장 | `초기 버전은 database 대신 file-backed storage로 구현해줘.` |
| 나중에 DB로 교체 | Storage Adapter | 저장소 교체 가능 구조 | `파일 저장 로직은 storage adapter로 분리해서 나중에 SQLite로 바꿀 수 있게 해줘.` |
| 요청 검증 | Request Validation | 서버에서 입력 검사 | `API body는 request validation을 거쳐 누락 필드를 400으로 응답해줘.` |
| 공통 에러 형식 | Error Response Shape | 에러 모양 통일 | `모든 API 오류는 { error, code, details } 형태로 응답해줘.` |
| 오래 걸리는 작업 취소 | Cancellation | 중지 버튼 | `세션 중지는 child process cancellation과 cleanup을 보장해줘.` |
| 외부 프로그램 실행 | Child Process | CLI 실행 | `각 AI provider는 child process adapter로 실행하고 stdout/stderr를 수집해줘.` |
| 제공자별 어댑터 | Provider Adapter | Codex/Claude/Gemini 연결부 | `CLI 호출은 provider adapter 구조로 분리해 새 provider를 쉽게 추가하게 해줘.` |
| 재시도 | Retry Policy | 실패 시 다시 실행 | `일시적 실패에는 exponential backoff retry policy를 적용해줘.` |
| 시간 제한 | Timeout | 너무 오래 걸리면 중단 | `각 AI turn은 configurable timeout을 두고 초과 시 runner-error 이벤트를 emit해줘.` |
| 로그 정리 | Log Rotation | 로그가 너무 커지는 것 방지 | `private logs는 log rotation 또는 ignore 정책을 명확히 적용해줘.` |
| 환경 변수 | Environment Variables | 로컬 설정값 | `PORT 같은 로컬 설정은 environment variable로 받게 해줘.` |
| 공개 설정/개인 설정 분리 | Local Override Config | config.local.json | `공개 config.json과 비공개 config.local.json을 deep merge해서 개인 정보는 커밋하지 않게 해줘.` |
| 버전 관리 | Schema Versioning | 데이터 형식 버전 | `세션 archive에는 schemaVersion을 넣어 나중에 마이그레이션 가능하게 해줘.` |
| 데이터 변환 | Normalization | 저장 전 모양 통일 | `player와 moderator 입력은 normalize function으로 표준화해줘.` |
| 요청/응답 모양 분리 | DTO / Data Transfer Object | API용 데이터 모양 | `내부 model을 그대로 노출하지 말고 request/response DTO를 따로 정의해줘.` |
| 서버 역할 나누기 | Controller / Service Layer | 입구와 실제 로직 분리 | `router/controller는 요청 처리만 하고 핵심 로직은 service layer로 분리해줘.` |
| 핵심 개념 정의 | Domain Model | 서비스 안의 주요 대상 | `Session, Player, Provider, Event를 domain model로 정의하고 상태 전이를 명확히 해줘.` |
| 상태 흐름 고정 | State Machine | 진행 단계 규칙 | `세션 상태를 idle/running/paused/completed/failed/cancelled state machine으로 관리해줘.` |
| 같은 요청 중복 방지 | Idempotency | 두 번 눌러도 한 번 처리 | `세션 시작 API는 idempotency key를 받아 중복 시작을 막아줘.` |
| 동시에 꼬이는 것 방지 | Concurrency Lock | 같은 자원 동시 수정 방지 | `같은 sessionId에 대해 동시에 두 turn이 실행되지 않도록 per-session lock을 걸어줘.` |
| 너무 많이 몰릴 때 | Backpressure | 처리량 조절 | `provider 실행 요청이 몰리면 queue length를 제한하고 backpressure error를 반환해줘.` |
| 실시간 이벤트 규격 | Event Schema | 스트리밍 데이터 약속 | `SSE event는 type, sessionId, timestamp, payload를 가진 event schema로 통일해줘.` |
| 서버 생존 확인 | Health Check | 서버 정상 여부 | `GET /health endpoint를 추가해서 서버와 provider status를 간단히 확인하게 해줘.` |
| 안전하게 종료 | Graceful Shutdown | 실행 중 작업 정리 | `서버 종료 시 진행 중 child process를 정리하고 archive flush 후 shutdown되게 해줘.` |
| 요청 추적 | Correlation ID | 로그 이어보기 | `각 세션과 API 요청에 correlationId를 붙여 로그와 UI 이벤트를 추적 가능하게 해줘.` |
| 기계가 읽는 로그 | Structured Logging | 로그를 JSON처럼 정리 | `console 문자열 대신 level, event, sessionId, provider, message를 가진 structured log를 남겨줘.` |

## 8. 데이터베이스 / 저장소 / 캐시

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 저장할 대상 정리 | Entity / Table | 무엇을 저장할지 | `sessions, players, events, provider_status를 entity/table 단위로 설계해줘.` |
| 고유 번호 | Primary Key | 각 데이터의 주민번호 | `모든 session과 event에는 stable primary key를 부여해줘.` |
| 서로 연결 | Foreign Key | 데이터끼리 관계 | `events는 sessionId foreign key로 sessions와 연결해줘.` |
| 빨리 찾기 | Index | 검색 속도 개선 | `sessionId와 createdAt 기준 조회가 많으니 index를 추가해줘.` |
| 중복 금지 | Unique Constraint | 같은 값 두 번 저장 방지 | `provider id와 player id 조합은 unique constraint로 중복을 막아줘.` |
| 여러 저장을 한 번에 | Transaction | 중간 실패 시 되돌림 | `세션 종료 저장은 summary와 final events를 transaction으로 처리해줘.` |
| DB 구조 변경 | Migration | 테이블 버전 업데이트 | `DB schema 변경은 migration 파일로 관리하고 기존 archive와 호환되게 해줘.` |
| 초기 샘플 데이터 | Seed Data | 처음 들어갈 기본값 | `개발용 seed data로 샘플 세션과 참가자 3명을 생성하게 해줘.` |
| 조회 조건 | Query | 데이터 꺼내기 | `히스토리는 status, mode, createdAt 조건으로 query할 수 있게 해줘.` |
| 페이지 나누기 | Pagination | 한 번에 조금씩 | `히스토리 목록은 limit/offset pagination을 적용해줘.` |
| 무한 스크롤식 페이지 | Cursor Pagination | 다음 기준값으로 조회 | `이벤트 타임라인은 createdAt cursor pagination으로 오래된 기록을 더 불러오게 해줘.` |
| 삭제처럼 보이지만 보관 | Soft Delete | 숨김 처리 | `세션 삭제는 hard delete 대신 deletedAt을 찍는 soft delete로 처리해줘.` |
| 변경 기록 | Audit Log | 누가 뭘 바꿨는지 | `설정 변경과 provider 연결 상태 변화는 audit log로 남겨줘.` |
| 오래된 데이터 정책 | Retention Policy | 언제 지울지 | `private logs는 retention policy를 두고 30일 지난 파일은 정리하게 해줘.` |
| 파일 저장 | Object Storage | 이미지/첨부 저장소 | `스크린샷과 gif는 DB에 넣지 말고 object storage 또는 assets 폴더 경로만 저장해줘.` |
| 검색 가능하게 | Search Index | 제목/내용 검색 | `완료된 세션은 topic과 summary를 search index에 넣어 검색 가능하게 해줘.` |
| 자주 쓰는 값 임시 저장 | Cache | 매번 계산 안 함 | `provider status는 짧은 TTL cache를 둬서 새로고침마다 CLI를 때리지 않게 해줘.` |
| 캐시 만료 시간 | TTL | 얼마 뒤 다시 확인 | `auth status cache는 TTL 10초로 두고 수동 새로고침은 cache bypass를 지원해줘.` |
| 캐시 지우기 | Cache Invalidation | 오래된 값 제거 | `연결 버튼을 누른 뒤에는 provider status cache를 invalidate하고 다시 확인해줘.` |
| 동시에 수정 충돌 방지 | Optimistic Locking | 저장 버전 확인 | `config 저장은 version 필드를 비교하는 optimistic locking으로 덮어쓰기를 막아줘.` |
| 개인정보 분리 | PII Separation | 민감정보 따로 관리 | `이메일 같은 PII는 공개 archive와 분리하고 UI 표시 전 redaction을 적용해줘.` |
| 백업과 복구 | Backup / Restore | 날아갔을 때 살리기 | `sessions archive는 backup/restore command를 제공해서 다른 PC에서도 복구 가능하게 해줘.` |
| 내보내기 | Export | 밖으로 저장 | `완료된 세션은 markdown/json export를 지원하고 private fields 포함 여부를 선택하게 해줘.` |

## 9. 로그인 / 권한 / 보안

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| API 키 쓰지 않기 | CLI-only Auth | 각 CLI 로그인 사용 | `API key는 사용하지 말고 local CLI authentication만 사용하게 해줘.` |
| 연결 상태 확인 | Auth Status Check | 로그인 됐는지 확인 | `provider별 auth status command를 실행해 연결 상태를 감지해줘.` |
| 계정 표시 | Account Detection | 어떤 계정인지 보여줌 | `감지 가능한 경우 provider account를 표시하되 토큰은 절대 표시하지 마.` |
| 민감정보 숨기기 | Secret Redaction | 이메일/토큰 가림 | `로그와 UI에는 token, API key, auth cache 내용을 redaction 처리해줘.` |
| 공개/비공개 설정 분리 | Secret-safe Config | 커밋 안전 | `실제 이메일과 이름은 config.local.json에만 두고 .gitignore에 추가해줘.` |
| 권한 확인 | Permission Check | 할 수 있는지 확인 | `위험 작업 전에는 user permission과 current state를 확인해줘.` |
| 관전자 전용 | Spectator-only Data | 사용자만 보는 비밀 | `속마음과 역할 정보는 spectator-only panel에만 표시하고 AI 공개 기록에는 넣지 마.` |
| 역할별 정보 제한 | Role-based Information | 역할마다 아는 정보 다름 | `마피아/경찰/의사 prompts는 role-based information boundary를 지켜줘.` |
| 외부 전송 확인 | Data Transmission Confirmation | 밖으로 보내기 전 확인 | `외부 서비스로 데이터를 전송하기 전에는 어떤 데이터가 어디로 가는지 confirm step을 넣어줘.` |
| 업로드 전 스캔 | Privacy Scan | 개인정보 검사 | `GitHub 업로드 전 rg 기반 privacy scan을 실행해 이메일, 실명, 토큰 패턴을 검사해줘.` |
| 로그인과 권한 구분 | Authentication / Authorization | 누구인지/뭘 할 수 있는지 | `authentication과 authorization을 분리해서 로그인 확인과 권한 확인을 따로 처리해줘.` |
| 최소 권한 | Least Privilege | 필요한 권한만 | `파일 접근과 외부 실행 권한은 least privilege 원칙으로 필요한 범위만 허용해줘.` |
| 비밀값 관리 | Secret Management | 토큰/키 보관 방식 | `토큰이나 API key는 코드와 config에 저장하지 말고 OS keychain이나 CLI auth cache를 사용해줘.` |
| 입력값 공격 방지 | Input Sanitization | 이상한 입력 정리 | `사용자 topic과 player 이름은 command injection이 불가능하도록 sanitize/escape 처리해줘.` |
| 명령어 주입 방지 | Command Injection Guard | CLI 실행 안전장치 | `child_process 실행은 shell string 조합을 피하고 args 배열로 전달해 command injection을 막아줘.` |
| 브라우저 출처 제한 | CORS Policy | 허용된 화면만 API 호출 | `API 서버는 localhost 개발 환경에 맞춘 strict CORS policy를 적용해줘.` |
| 요청 과다 방지 | Rate Limiting | 너무 많이 누르는 것 제한 | `provider 연결 확인과 세션 시작 API에는 rate limit을 적용해 과도한 호출을 막아줘.` |
| 작업 기록 추적 | Audit Trail | 나중에 확인 가능한 기록 | `연결, 삭제, export, 외부 업로드 같은 민감 작업은 audit trail에 남겨줘.` |
| 비공개 필드 보호 | Private Field Boundary | 숨길 데이터 노출 방지 | `hiddenReason, role, privatePrompt 같은 필드는 public response DTO에서 제거해줘.` |
| 안전한 기본값 | Secure Defaults | 실수해도 안전 | `기본 설정은 public sharing off, private fields hidden, local-only server로 시작하게 해줘.` |

## 10. AI / LLM / 에이전트 기능

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 여러 AI가 순서대로 말하기 | Sequential Agent Loop | 한 명씩 발언 | `여러 AI 참가자를 sequential agent loop로 실행해 한 명씩 발언하게 해줘.` |
| 모든 이전 발언 전달 | Shared Transcript Context | 지금까지 대화 기억 | `각 turn prompt에는 public transcript를 compact context로 포함해줘.` |
| 각자 성격 부여 | Persona Prompting | 역할/말투 설정 | `각 player에는 persona prompt를 주고 발언 스타일을 유지하게 해줘.` |
| 진행자 | Moderator Agent | 회의 정리 AI | `라운드 끝마다 moderator agent가 쟁점과 다음 액션을 정리하게 해줘.` |
| 마지막 정리 | Final Summary Prompt | 결론문 | `마지막 라운드에서는 final summary prompt로 결론, 근거, 리스크, 다음 액션을 작성하게 해줘.` |
| 반박하게 만들기 | Adversarial Prompting | 일부러 공격적 검토 | `참가자들에게 claim/evidence/objection/action 구조로 서로 반박하게 해줘.` |
| 서로 모델 인식 | Agent Identity Context | 누가 어떤 AI인지 알기 | `각 agent prompt에 참가자 이름과 provider/model identity를 포함해줘.` |
| 같은 말 반복 방지 | Anti-repetition Rule | 복붙 답변 줄이기 | `이전 발언을 반복하지 말고 새 반박이나 실행안을 추가하라는 anti-repetition rule을 넣어줘.` |
| 프롬프트 길이 줄이기 | Context Compaction | 긴 기록 압축 | `긴 transcript는 최근 발언과 핵심 요약만 남기는 context compaction을 적용해줘.` |
| 종료 토큰 | Stop Token / End Token | 응답 끝 확인 | `각 CLI 응답은 end token을 요구하고 없으면 runner-error로 처리해줘.` |
| 출력 파싱 | Response Parsing | AI 답변에서 본문 추출 | `CLI raw output에서 speaker prefix와 end token을 제거하는 response parser를 만들어줘.` |
| 속마음 | Hidden Reasoning Field | 공개하지 않는 이유 | `투표 이유는 public reason과 spectator-only hidden reason으로 분리해줘.` |
| 후속 질문 | Follow-up Prompt | 끝난 뒤 더 물어보기 | `세션 종료 후 특정 참가자에게 same archive context로 follow-up prompt를 보낼 수 있게 해줘.` |
| 새 세션과 기존 세션 분리 | Session Isolation | 판마다 기억 분리 | `새 회의는 new session context로 시작하고 follow-up만 기존 archive context를 사용해줘.` |
| 역할별 프롬프트 | Role Prompt Templates | 마피아/경찰/의사 분리 | `마피아 게임은 role prompt template을 분리해서 각 역할이 알아야 할 정보만 제공해줘.` |
| 자유롭게 거짓말 | Strategic Freedom | 게임 전략 허용 | `마피아 역할은 bluffing과 misdirection을 허용하되 private role을 직접 노출하지 않게 해줘.` |
| 근거 중심 답변 | Evidence-grounded Answer | 왜 그런지 말하기 | `각 발언은 주장, 근거, 반박, 다음 행동을 포함하게 해줘.` |
| 결론 강제 | Convergence Constraint | 싸우다 끝나지 않게 | `마지막 라운드에서는 추가 요청 없이 현재 기록만으로 결론을 내리게 해줘.` |
| 모델별 비교 | Multi-provider Comparison | Codex/Claude/Gemini 비교 | `provider별 발언 차이를 UI에서 provider chip과 색상으로 구분해줘.` |
| 실패한 AI 건너뛰기 | Fault-tolerant Agent Loop | 한 AI 실패해도 계속 | `한 provider가 실패해도 나머지 turn은 계속 진행하고 실패 이벤트를 타임라인에 남겨줘.` |

## 11. 인프라 / 배포 / 운영

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 내 컴퓨터에서만 실행 | Local-first App | 로컬 중심 앱 | `이 앱은 local-first로 설계하고 기본 서버는 localhost에서만 열리게 해줘.` |
| 포트 설정 | Port Configuration | 3000/3001 같은 번호 | `PORT 환경 변수로 서버 포트를 바꾸고 이미 사용 중이면 명확한 에러를 보여줘.` |
| 개발 서버 | Dev Server | 개발 중 실행 서버 | `프론트와 백엔드 dev server를 함께 띄우는 npm script를 추가해줘.` |
| 실행 프로세스 관리 | Process Manager | 서버 계속 켜두기 | `운영 실행은 process manager가 재시작할 수 있도록 start script와 health check를 준비해줘.` |
| 컨테이너로 묶기 | Containerization / Docker | 어디서든 같은 실행 환경 | `Dockerfile을 만들되 CLI auth는 이미지에 넣지 말고 host mount 방식으로 분리해줘.` |
| 여러 서비스 같이 실행 | Docker Compose | 서버+DB 한 번에 실행 | `SQLite가 아닌 DB를 쓸 경우 docker-compose로 app과 database를 함께 실행하게 해줘.` |
| 앞단 서버 | Reverse Proxy | 외부 요청을 내부 서버로 전달 | `외부 공개가 필요하면 reverse proxy 뒤에 app server를 두고 TLS를 termination하게 해줘.` |
| 도메인 연결 | DNS / Domain | 주소 붙이기 | `배포 문서에는 DNS record와 app base URL 설정 방법을 적어줘.` |
| HTTPS 적용 | TLS / SSL | 암호화 접속 | `외부 공개 모드에서는 TLS를 필수로 하고 http 요청은 https로 redirect해줘.` |
| 서버 정상 확인 | Liveness Check | 죽었는지 확인 | `liveness check는 프로세스가 살아있는지만 빠르게 확인하게 해줘.` |
| 서비스 준비 확인 | Readiness Check | 요청 받아도 되는지 확인 | `readiness check는 storage와 provider status check가 가능한지 확인하게 해줘.` |
| 배포 자동화 | CI/CD Pipeline | 테스트 후 자동 반영 | `push 시 lint/test/build를 돌리고 통과한 artifact만 배포하는 CI/CD pipeline을 구성해줘.` |
| 결과물 묶기 | Build Artifact | 배포 파일 | `배포는 source 전체가 아니라 build artifact 기준으로 이루어지게 해줘.` |
| 정적 파일 배포 | Static Hosting / CDN | 프론트 파일 빠르게 제공 | `web 정적 assets는 cache header를 붙이고 필요한 경우 CDN에 올릴 수 있게 구조화해줘.` |
| 배포 중 DB 변경 | Migration on Deploy | 배포 때 DB 구조 업데이트 | `배포 단계에서 migration을 먼저 실행하고 실패하면 app rollout을 중단해줘.` |
| 되돌리기 | Rollback Strategy | 망하면 이전 버전 | `배포 실패 시 이전 artifact와 이전 config로 rollback할 수 있는 절차를 문서화해줘.` |
| 조금씩 배포 | Canary Release | 일부만 새 버전 | `외부 서비스라면 canary release로 일부 트래픽만 새 버전에 보내게 해줘.` |
| 무중단 배포 | Blue-Green Deployment | 새 서버 확인 후 교체 | `blue-green deployment를 고려해서 새 버전 health check 통과 후 트래픽을 전환하게 해줘.` |
| 로그 모아보기 | Centralized Logging | 서버 로그 한곳에 | `운영 모드에서는 structured log를 파일 또는 logging backend로 모을 수 있게 해줘.` |
| 숫자로 상태 보기 | Metrics | 성공/실패/시간 측정 | `session count, provider latency, error rate 같은 metrics를 수집하게 해줘.` |
| 문제 알림 | Alerting | 장애 알림 | `error rate나 timeout이 threshold를 넘으면 alerting hook을 호출하게 해줘.` |
| 추적 가능성 | Observability | 왜 느린지/망했는지 확인 | `request id, session id, provider id를 log와 metric에 함께 넣어 observability를 확보해줘.` |
| 자원 제한 | Resource Limits | CPU/메모리 폭주 방지 | `child process와 queue worker에 memory/time/resource limit을 설정해줘.` |
| 자동 확장 | Autoscaling | 사용량 많으면 늘림 | `서버형 배포라면 stateless web server와 stateful worker를 분리해 autoscaling 가능하게 해줘.` |
| 작업자 분리 | Worker Process | 오래 걸리는 일 담당 | `AI CLI 실행은 web request thread에서 직접 돌리지 말고 worker process로 분리해줘.` |
| 예약 작업 | Scheduler / Cron | 주기적 작업 | `오래된 로그 정리와 backup은 scheduler job으로 실행되게 해줘.` |
| 백업 계획 | Backup Schedule | 정기 백업 | `sessions archive와 config는 backup schedule을 두고 restore 절차까지 문서화해줘.` |
| 장애 복구 계획 | Disaster Recovery | 최악의 경우 복구 | `DB 손상이나 파일 삭제 상황을 가정한 disaster recovery 절차를 README에 적어줘.` |
| 비용 제한 | Cost Guardrail | 돈 새는 것 방지 | `외부 리소스를 쓰는 경우 monthly budget과 usage limit을 cost guardrail로 설정해줘.` |
| 환경 분리 | Environment Separation | dev/staging/prod 구분 | `dev/staging/prod 설정을 분리하고 production 기본값은 더 보수적으로 잡아줘.` |
| 배포 후 확인 | Post-deploy Smoke Test | 올린 뒤 바로 테스트 | `배포 직후 health, static assets, session start, history load를 post-deploy smoke test로 확인해줘.` |

## 12. 테스트 / 품질 / 릴리즈

| 하고 싶은 말 | 개발 용어 | 쉽게 이해하기 | 프롬프트 예시 |
|---|---|---|---|
| 코드 문법 확인 | Static Check | 실행 전 기본 검사 | `변경 후 node --check와 npm run check를 실행해줘.` |
| 실제 화면 확인 | Browser QA | 브라우저로 직접 보기 | `프론트 변경 후 브라우저에서 주요 플로우를 smoke test해줘.` |
| 빠른 가짜 실행 | Dry Run | 외부 호출 없이 테스트 | `외부 CLI 호출 없이 dry-run mode로 UI 이벤트 흐름을 검증해줘.` |
| 진짜 실행 | End-to-end Run | 실제 연결로 전체 테스트 | `중요한 배포 전에는 실제 provider CLI로 end-to-end run을 한 번 수행해줘.` |
| 핵심 플로우 테스트 | Smoke Test | 최소 동작 확인 | `시작, 이벤트 수신, 종료, 히스토리 저장을 smoke test로 확인해줘.` |
| 회귀 방지 | Regression Test | 예전 버그 재발 방지 | `이름 변경이 실제 세션 이벤트에 반영되는 regression test를 추가해줘.` |
| 접근성 | Accessibility / a11y | 키보드/스크린리더 고려 | `버튼에는 accessible label을 넣고 키보드 포커스가 보이게 해줘.` |
| 모바일 확인 | Responsive QA | 작은 화면 테스트 | `모바일 viewport에서 텍스트 겹침과 버튼 overflow를 확인해줘.` |
| 성능 확인 | Performance Budget | 느려지지 않게 | `타임라인 이벤트가 1000개여도 렌더링이 버벅이지 않게 performance budget을 잡아줘.` |
| 에러 로그 | Error Logging | 실패 원인 기록 | `runner-error에는 command, phase, player id, sanitized message를 포함해줘.` |
| 배포 전 개인정보 검사 | Secret Scan | 공개 전 점검 | `커밋 전 staged 파일 기준으로 email/token/name privacy scan을 실행해줘.` |
| README 정리 | Documentation | 사용법 문서 | `README에 quick start, CLI-only auth, screenshots, privacy notes를 추가해줘.` |
| 릴리즈 노트 | Changelog | 변경 요약 | `이번 변경을 changelog 형식으로 요약해줘.` |
| GitHub 업로드 | Commit & Push | 저장소 반영 | `의도한 파일만 stage하고 커밋한 뒤 개인 GitHub 계정으로 push해줘.` |
| 롤백 가능하게 | Reversible Change | 되돌리기 쉬움 | `큰 변경은 작은 commit 단위로 나눠 rollback 가능하게 해줘.` |

## 13. 제품 기획자가 프롬프트에 자주 넣으면 좋은 문장

| 목적 | 바로 쓰는 문장 |
|---|---|
| 기존 디자인 존중 | `기존 UI 패턴과 스타일을 먼저 읽고, 새 기능도 같은 디자인 언어로 맞춰줘.` |
| 과한 랜딩 페이지 방지 | `마케팅 랜딩이 아니라 실제 사용 가능한 도구 화면을 첫 화면으로 만들어줘.` |
| 작은 UI 요청을 정확히 | `이건 장식이 아니라 반복 작업용 컨트롤이므로 작고 조밀하게 만들어줘.` |
| 사용자 흐름 강조 | `사용자가 가장 자주 하는 순서대로 화면과 버튼 위치를 재배치해줘.` |
| 상태 명확화 | `각 작업 상태를 idle/loading/success/error/empty로 나눠서 UI 상태를 구현해줘.` |
| 실패 상황 | `실패했을 때 조용히 죽지 말고 사용자에게 원인과 다음 행동을 보여줘.` |
| 저장/복구 | `새로고침해도 진행 중인 상태와 완료 기록을 복구할 수 있게 해줘.` |
| 개인정보 | `공개 저장소에 올라갈 수 있는 파일에는 실명, 이메일, 토큰, 로컬 경로가 들어가지 않게 해줘.` |
| 확장성 | `지금은 파일 저장으로 구현하되 나중에 DB로 바꿀 수 있게 adapter 경계를 만들어줘.` |
| 백엔드 구조 | `router/controller/service/storage adapter 경계를 나눠서 UI 요청과 핵심 로직이 섞이지 않게 해줘.` |
| API 계약 | `요청/응답 DTO와 error response shape를 먼저 정하고 프론트는 그 계약만 사용하게 해줘.` |
| 저장 안정성 | `저장 작업은 transaction 또는 atomic write로 처리해서 중간 실패 시 데이터가 깨지지 않게 해줘.` |
| 동시성 | `같은 사용자가 버튼을 여러 번 눌러도 idempotency와 per-resource lock으로 중복 실행을 막아줘.` |
| 운영 가능성 | `health check, structured logging, metrics, graceful shutdown을 기본으로 넣어줘.` |
| 배포 기준 | `dev/staging/prod 설정을 분리하고 production은 secure default와 rollback 절차를 갖추게 해줘.` |
| 장애 대응 | `실패 시 사용자에게 보이는 에러와 운영자가 보는 sanitized log를 분리해줘.` |
| 너무 큰 리팩터 방지 | `요청한 기능과 직접 관련된 파일만 수정하고 불필요한 리팩터는 하지 마.` |
| 검증 | `수정 후 정적 체크와 브라우저 기반 smoke test를 실행하고 결과를 요약해줘.` |
| 실사용 테스트 구분 | `평소에는 dry-run으로 확인하고, 공개 데모나 배포 전에는 실제 provider로 end-to-end run을 해줘.` |

## 14. 바이브코딩 프롬프트 템플릿

### UI 기능 추가

```text
<화면/목록/패널>에 <기능>을 추가해줘.
개발 용어로는 <용어> 방식이면 돼.
사용자는 <행동>할 수 있어야 하고, <상태 변화>가 화면에 보여야 해.
input/select/button 같은 기존 조작 요소와 충돌하지 않게 해줘.
모바일에서도 겹치거나 잘리지 않게 확인해줘.
```

### AI 에이전트 기능 추가

```text
<AI 참가자/진행자/역할>에게 <새 행동>을 시키고 싶어.
각 AI가 알아야 하는 공개 정보와 비공개 정보를 분리해줘.
프롬프트에는 역할, 현재 라운드, 이전 공개 기록, 이번 턴 목표를 넣어줘.
마지막에는 사용자가 바로 읽을 수 있는 결과 이벤트로 UI에 표시해줘.
```

### 백엔드 기능 추가

```text
<기능>을 백엔드에 추가해줘.
API는 <method/path> endpoint로 만들고 request/response DTO를 명확히 정의해줘.
핵심 로직은 service layer에 두고 저장 로직은 storage adapter로 분리해줘.
입력값은 request validation을 거치고, 오류는 { error, code, details } 형태로 통일해줘.
중복 요청, timeout, cancellation, partial failure 상황을 고려해줘.
```

### 저장소 / 데이터 모델 추가

```text
<데이터>를 저장할 수 있게 설계해줘.
entity/table, primary key, relationship, index, migration을 먼저 제안해줘.
조회는 pagination을 고려하고, 삭제는 필요한 경우 soft delete로 처리해줘.
개인정보와 public archive에 들어갈 데이터를 분리해줘.
백업/복구 또는 export가 필요한지도 같이 판단해줘.
```

### 인프라 / 운영 준비

```text
이 기능을 실제로 운영 가능한 형태로 정리해줘.
local/dev/prod 설정을 분리하고 환경 변수와 secret 관리 방식을 명확히 해줘.
health check, structured logging, metrics, graceful shutdown을 추가해줘.
배포 후 smoke test와 rollback 절차를 README에 적어줘.
외부 공개가 필요한 경우 TLS, reverse proxy, CORS, rate limit 기준도 확인해줘.
```

### 버그 수정

```text
문제: <사용자가 본 증상>.
기대 동작: <원래 되어야 하는 행동>.
재현 방법: <순서>.
원인을 추적해서 최소 수정으로 고쳐줘.
수정 후 같은 재현 방법으로 regression check를 해줘.
```

### 공개 배포 전 점검

```text
GitHub에 올리기 전에 privacy scan을 해줘.
실명, 이메일, 토큰, API key, private logs, local auth cache가 커밋에 포함되지 않게 확인해줘.
공개용 config와 로컬용 config를 분리하고 README에 설정 방법을 적어줘.
검사 통과 후 의도한 파일만 커밋해줘.
```
