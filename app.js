import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// 전달받은 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBSSUWoH1B_P938bzNRq1E9Qd8-pmYzJhk",
  authDomain: "todo-b78e9.firebaseapp.com",
  databaseURL: "https://todo-b78e9-default-rtdb.firebaseio.com",
  projectId: "todo-b78e9",
  storageBucket: "todo-b78e9.firebasestorage.app",
  messagingSenderId: "273433676374",
  appId: "1:273433676374:web:229b1b12f49e3684ccc9f7",
  measurementId: "G-7LQW10CVQD"
};

// Firebase 및 Realtime Database 초기화
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const schedulesRef = ref(db, "schedules");

// 상태 변수
let schedules = [];
let currentDate = new Date(); // 현재 달력/리스트 기준 월
let currentView = 'calendar'; // 'calendar' | 'list' (기본값: 달력)

// DOM 요소
const todayDateBadge = document.getElementById('todayDateBadge');
const syncStatusBadge = document.getElementById('syncStatusBadge');
const todayTitleLink = document.getElementById('todayTitleLink');
const todayCount = document.getElementById('todayCount');
const todayScheduleList = document.getElementById('todayScheduleList');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const calendarDays = document.getElementById('calendarDays');

const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');
const openAddModalBtn = document.getElementById('openAddModalBtn');

// 보기 전환 요소
const calendarViewBtn = document.getElementById('calendarViewBtn');
const listViewBtn = document.getElementById('listViewBtn');
const calendarViewContainer = document.getElementById('calendarViewContainer');
const listViewContainer = document.getElementById('listViewContainer');

// 모달 요소
const scheduleModal = document.getElementById('scheduleModal');
const modalTitle = document.getElementById('modalTitle');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const deleteScheduleBtn = document.getElementById('deleteScheduleBtn');
const saveScheduleBtn = document.getElementById('saveScheduleBtn');
const scheduleForm = document.getElementById('scheduleForm');

const scheduleIdInput = document.getElementById('scheduleId');
const scheduleDateInput = document.getElementById('scheduleDate');
const scheduleTimeInput = document.getElementById('scheduleTime');
const scheduleColorInput = document.getElementById('scheduleColor');
const scheduleTitleInput = document.getElementById('scheduleTitle');
const scheduleMemoInput = document.getElementById('scheduleMemo');

// 동기화 상태 표시 배지 업데이트
function setSyncStatus(state, message) {
  syncStatusBadge.className = `sync-badge ${state}`;
  syncStatusBadge.textContent = message;
}

// 날짜 포맷 유틸 (YYYY-MM-DD)
function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 요일 포함 오늘 날짜 텍스트
function formatKoreanToday(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

// 리스트 뷰용 날짜 헤더 텍스트
function formatListDateHeader(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayIdx = dateObj.getDay();
  return {
    text: `${m}월 ${d}일 (${days[dayIdx]})`,
    dayIdx,
  };
}

// 시간순 정렬
function sortSchedules(list) {
  return [...list].sort((a, b) => {
    const timeA = a.time || '99:99';
    const timeB = b.time || '99:99';
    return timeA.localeCompare(timeB);
  });
}

// 상단 오늘의 일정 렌더링
function renderTodaySchedules() {
  const today = new Date();
  const todayStr = formatDateString(today);
  todayDateBadge.textContent = formatKoreanToday(today);

  const todayEvents = sortSchedules(schedules.filter((item) => item.date === todayStr));
  todayCount.textContent = `${todayEvents.length}건`;
  todayScheduleList.innerHTML = '';

  if (todayEvents.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'today-empty';
    emptyEl.textContent = '오늘 등록된 일정이 없습니다.';
    todayScheduleList.appendChild(emptyEl);
    return;
  }

  todayEvents.forEach((event) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'today-item';
    itemEl.title = event.memo ? `${event.title} - ${event.memo}` : event.title;

    const dot = document.createElement('span');
    dot.className = `dot color-${event.color || 'blue'}`;
    itemEl.appendChild(dot);

    if (event.time) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'time-tag';
      timeSpan.textContent = event.time;
      itemEl.appendChild(timeSpan);
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'item-title';
    titleSpan.textContent = event.title;
    itemEl.appendChild(titleSpan);

    itemEl.addEventListener('click', () => openEditModal(event.id));
    todayScheduleList.appendChild(itemEl);
  });
}

// 하단 달력 렌더링
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  currentMonthLabel.textContent = `${year}년 ${month + 1}월`;

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0(일) ~ 6(토)
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const todayStr = formatDateString(new Date());

  calendarDays.innerHTML = '';

  // 총 35칸 또는 42칸 계산
  const totalCells = Math.ceil((startDayOfWeek + totalDaysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    const dayOfWeek = i % 7;
    if (dayOfWeek === 0) cell.classList.add('sun');
    if (dayOfWeek === 6) cell.classList.add('sat');

    let cellDate;
    let displayDay;

    if (i < startDayOfWeek) {
      displayDay = prevMonthLastDay - startDayOfWeek + i + 1;
      cellDate = new Date(year, month - 1, displayDay);
      cell.classList.add('other-month');
    } else if (i >= startDayOfWeek + totalDaysInMonth) {
      displayDay = i - (startDayOfWeek + totalDaysInMonth) + 1;
      cellDate = new Date(year, month + 1, displayDay);
      cell.classList.add('other-month');
    } else {
      displayDay = i - startDayOfWeek + 1;
      cellDate = new Date(year, month, displayDay);
    }

    const dateStr = formatDateString(cellDate);
    if (dateStr === todayStr) {
      cell.classList.add('is-today');
    }

    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';

    const dayNum = document.createElement('span');
    dayNum.className = 'day-number';
    dayNum.textContent = displayDay;
    dayHeader.appendChild(dayNum);
    cell.appendChild(dayHeader);

    const dayEvents = sortSchedules(schedules.filter((item) => item.date === dateStr));
    const eventList = document.createElement('div');
    eventList.className = 'event-list';

    dayEvents.forEach((event) => {
      const chip = document.createElement('div');
      chip.className = `event-chip color-${event.color || 'blue'}`;
      chip.textContent = event.time ? `${event.time} ${event.title}` : event.title;
      chip.title = event.memo ? `${event.title}\n메모: ${event.memo}` : event.title;

      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(event.id);
      });

      eventList.appendChild(chip);
    });

    cell.appendChild(eventList);

    cell.addEventListener('click', () => {
      openAddModal(dateStr);
    });

    calendarDays.appendChild(cell);
  }
}

// 하단 리스트 뷰 렌더링 (현재 선택된 연/월 기준 날짜순 정렬)
function renderScheduleList() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const todayStr = formatDateString(new Date());

  currentMonthLabel.textContent = `${year}년 ${month + 1}월`;
  listViewContainer.innerHTML = '';

  const monthEvents = schedules.filter((item) => item.date && item.date.startsWith(monthPrefix));

  if (monthEvents.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'list-empty-state';
    emptyDiv.textContent = `${year}년 ${month + 1}월에 등록된 일정이 없습니다.`;
    listViewContainer.appendChild(emptyDiv);
    return;
  }

  // 날짜별 그룹화 및 오름차순 정렬
  const groupedByDate = {};
  monthEvents.forEach((event) => {
    if (!groupedByDate[event.date]) {
      groupedByDate[event.date] = [];
    }
    groupedByDate[event.date].push(event);
  });

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b));

  sortedDates.forEach((dateStr) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'list-date-group';

    const { text: dateLabel, dayIdx } = formatListDateHeader(dateStr);
    const headerEl = document.createElement('div');
    headerEl.className = 'list-date-header';
    if (dateStr === todayStr) {
      headerEl.classList.add('is-today');
    }

    const dateTitleSpan = document.createElement('span');
    if (dayIdx === 0) dateTitleSpan.className = 'sun';
    if (dayIdx === 6) dateTitleSpan.className = 'sat';
    dateTitleSpan.textContent = dateStr === todayStr ? `${dateLabel} · 오늘` : dateLabel;
    headerEl.appendChild(dateTitleSpan);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'list-date-add-btn';
    addBtn.textContent = '+ 추가';
    addBtn.addEventListener('click', () => openAddModal(dateStr));
    headerEl.appendChild(addBtn);

    groupEl.appendChild(headerEl);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'list-items-container';

    const dayEvents = sortSchedules(groupedByDate[dateStr]);
    dayEvents.forEach((event) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'list-event-row';

      const badge = document.createElement('span');
      badge.className = `list-event-badge color-${event.color || 'blue'}`;
      rowEl.appendChild(badge);

      const timeEl = document.createElement('span');
      timeEl.className = 'list-event-time';
      timeEl.textContent = event.time || '종일';
      rowEl.appendChild(timeEl);

      const contentEl = document.createElement('div');
      contentEl.className = 'list-event-content';

      const titleEl = document.createElement('div');
      titleEl.className = 'list-event-title';
      titleEl.textContent = event.title;
      contentEl.appendChild(titleEl);

      if (event.memo) {
        const memoEl = document.createElement('div');
        memoEl.className = 'list-event-memo';
        memoEl.textContent = event.memo;
        contentEl.appendChild(memoEl);
      }

      rowEl.appendChild(contentEl);
      rowEl.addEventListener('click', () => openEditModal(event.id));
      itemsContainer.appendChild(rowEl);
    });

    groupEl.appendChild(itemsContainer);
    listViewContainer.appendChild(groupEl);
  });
}

// 보기 모드 전환 ('calendar' | 'list')
function setViewMode(mode) {
  currentView = mode;

  if (mode === 'calendar') {
    calendarViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
    calendarViewContainer.classList.remove('hidden');
    listViewContainer.classList.add('hidden');
  } else {
    listViewBtn.classList.add('active');
    calendarViewBtn.classList.remove('active');
    listViewContainer.classList.remove('hidden');
    calendarViewContainer.classList.add('hidden');
  }

  refreshMainView();
}

// 현재 선택된 뷰(달력 또는 리스트)만 갱신
function refreshMainView() {
  if (currentView === 'calendar') {
    renderCalendar();
  } else {
    renderScheduleList();
  }
}

// 전체 화면 갱신
function refreshUI() {
  renderTodaySchedules();
  refreshMainView();
}

// Realtime Database 실시간 구독 시작
function subscribeSchedules() {
  setSyncStatus('syncing', 'Firebase 동기화 중...');

  onValue(
    schedulesRef,
    (snapshot) => {
      const data = snapshot.val();
      if (data) {
        schedules = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
      } else {
        schedules = [];
      }
      //setSyncStatus('connected', 'Firebase 연결됨');
      //setSyncStatus('connected', 'Firebase 연결됨'); 
      syncStatusBadge.classList.add('hidden');//연결되었을때는 표시안함.
      refreshUI();
    },
    (error) => {
      console.error('Realtime Database 구독 오류:', error);
      setSyncStatus('error', 'Firebase 연결 오류');
      todayScheduleList.innerHTML =
        '<p class="today-empty">Realtime Database 연결에 실패했습니다. 규칙과 네트워크를 확인해주세요.</p>';
    }
  );
}

// 새 일정 추가 모달 열기
function openAddModal(defaultDateStr = null) {
  modalTitle.textContent = '새 일정 추가';
  scheduleIdInput.value = '';
  scheduleDateInput.value = defaultDateStr || formatDateString(new Date());
  scheduleTimeInput.value = '';
  scheduleColorInput.value = 'blue';
  scheduleTitleInput.value = '';
  scheduleMemoInput.value = '';

  deleteScheduleBtn.classList.add('hidden');
  scheduleModal.classList.remove('hidden');
  scheduleTitleInput.focus();
}

// 기존 일정 수정 모달 열기
function openEditModal(id) {
  const target = schedules.find((item) => item.id === id);
  if (!target) return;

  modalTitle.textContent = '일정 수정';
  scheduleIdInput.value = target.id;
  scheduleDateInput.value = target.date;
  scheduleTimeInput.value = target.time || '';
  scheduleColorInput.value = target.color || 'blue';
  scheduleTitleInput.value = target.title;
  scheduleMemoInput.value = target.memo || '';

  deleteScheduleBtn.classList.remove('hidden');
  scheduleModal.classList.remove('hidden');
}

// 모달 닫기
function closeModal() {
  scheduleModal.classList.add('hidden');
}

// 일정 저장 처리 (Realtime Database 추가 / 수정)
scheduleForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = scheduleIdInput.value;
  const date = scheduleDateInput.value;
  const time = scheduleTimeInput.value;
  const color = scheduleColorInput.value;
  const title = scheduleTitleInput.value.trim();
  const memo = scheduleMemoInput.value.trim();

  if (!date || !title) return;

  saveScheduleBtn.disabled = true;
  saveScheduleBtn.textContent = '저장 중...';

  try {
    if (id) {
      const targetRef = ref(db, `schedules/${id}`);
      await update(targetRef, {
        date,
        time,
        color,
        title,
        memo,
        updatedAt: Date.now(),
      });
    } else {
      const newScheduleRef = push(schedulesRef);
      await set(newScheduleRef, {
        date,
        time,
        color,
        title,
        memo,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    closeModal();

    // 등록/수정한 일정의 월로 이동
    const [y, m] = date.split('-').map(Number);
    currentDate = new Date(y, m - 1, 1);
    refreshUI();
  } catch (error) {
    console.error('일정 저장 오류:', error);
    alert('일정 저장 중 오류가 발생했습니다.');
  } finally {
    saveScheduleBtn.disabled = false;
    saveScheduleBtn.textContent = '저장';
  }
});

// 일정 삭제 처리 (Realtime Database 삭제)
deleteScheduleBtn.addEventListener('click', async () => {
  const id = scheduleIdInput.value;
  if (!id) return;

  if (!confirm('이 일정을 삭제하시겠습니까?')) return;

  deleteScheduleBtn.disabled = true;
  deleteScheduleBtn.textContent = '삭제 중...';

  try {
    await remove(ref(db, `schedules/${id}`));
    closeModal();
  } catch (error) {
    console.error('일정 삭제 오류:', error);
    alert('일정 삭제 중 오류가 발생했습니다.');
  } finally {
    deleteScheduleBtn.disabled = false;
    deleteScheduleBtn.textContent = '삭제';
  }
});

// 이벤트 바인딩
openAddModalBtn.addEventListener('click', () => openAddModal());
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);

// 보기 전환 버튼 이벤트
calendarViewBtn.addEventListener('click', () => setViewMode('calendar'));
listViewBtn.addEventListener('click', () => setViewMode('list'));

// 모달 바깥 배경을 직접 클릭(mousedown)할 때만 닫기 (입력창 드래그 블록 지정 보호)
scheduleModal.addEventListener('mousedown', (e) => {
  if (e.target === scheduleModal) {
    closeModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !scheduleModal.classList.contains('hidden')) {
    closeModal();
  }
});

prevMonthBtn.addEventListener('click', () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  refreshMainView();
});

nextMonthBtn.addEventListener('click', () => {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  refreshMainView();
});

// 상단 '오늘의 일정 0건' 클릭 시 오늘 월로 이동
todayTitleLink.addEventListener('click', () => {
  currentDate = new Date();
  refreshUI();
});

// 초기 화면 렌더링 및 Realtime Database 실시간 동기화 시작
refreshUI();
subscribeSchedules();
