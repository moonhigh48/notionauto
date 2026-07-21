'use client';

import { useState, useEffect } from 'react';

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date()); // 현재 날짜 기준

  // 데이터 불러오기 함수
  const fetchCalendarData = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/calendar/api?t=${Date.now()}`);
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('달력 데이터를 불러오는 데 실패했습니다:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  // 동적 달력 날짜 계산
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 월의 첫 날 요일 (0: 일요일)
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // 월의 총 일수

  // 달력 그리드 배열 생성
  const calendarCells = [];
  
  // 1. 첫 번째 주 빈 칸 채우기
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push({ key: `empty-${i}`, day: null });
  }

  // 2. 실제 날짜 채우기
  for (let day = 1; day <= daysInMonth; day++) {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    // 해당 날짜에 있는 이벤트 필터링
    const dayEvents = events.filter((ev) => ev.date === dateStr);

    calendarCells.push({
      key: `day-${day}`,
      day,
      dateStr,
      events: dayEvents,
    });
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div style={styles.container}>
      {/* 헤더 영역 */}
      <div style={styles.header}>
        <h1 style={styles.title}>Notion Event Calendar</h1>
        
        {/* 우측 상단 새로고침 버튼 */}
        <button 
          onClick={fetchCalendarData} 
          disabled={isRefreshing}
          style={{
            ...styles.refreshButton,
            opacity: isRefreshing ? 0.6 : 1,
            cursor: isRefreshing ? 'not-allowed' : 'pointer'
          }}
          title="새로고침"
        >
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#333333" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              transform: isRefreshing ? 'rotate(360deg)' : 'none',
              transition: 'transform 0.6s ease'
            }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
      </div>

      {/* 년/월 동적 표시 */}
      <h2 style={styles.monthTitle}>{monthNames[month]} {year}</h2>

      {/* 달력 컨테이너 */}
      <div style={styles.calendarCard}>
        {/* 요일 헤더 */}
        <div style={styles.weekHeader}>
          {['sun', 'mon', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dayName) => (
            <div key={dayName} style={styles.weekDay}>{dayName}</div>
          ))}
        </div>

        {/* 동적 그리드 날짜 영역 */}
        <div style={styles.grid}>
          {calendarCells.map((cell) => {
            if (!cell.day) {
              return <div key={cell.key} style={styles.dayCell}></div>;
            }

            return (
              <div key={cell.key} style={styles.dayCell}>
                <span style={styles.dayNumber}>{cell.day}</span>
                
                {/* 노션에서 받아온 이벤트 동적 렌더링 */}
                {cell.events.map((ev, idx) => {
                  // 룰 종류에 따라 배지 색상 동적 지정
                  const isCoC = ev.rule?.includes('CoC');
                  const badgeBg = isCoC ? '#e8f0fe' : '#e6f4ea';
                  const badgeColor = isCoC ? '#3c4043' : '#137333';
                  const badgeBorder = isCoC ? '#4285f4' : '#34a853';

                  return (
                    <div
                      key={idx}
                      style={{
                        ...styles.badge,
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        borderLeft: `3px solid ${badgeBorder}`,
                      }}
                    >
                      {ev.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 디자인 스타일 객체
const styles = {
  container: {
    maxWidth: '850px',
    margin: '30px auto',
    padding: '0 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#333',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  refreshButton: {
    backgroundColor: '#ebebeb',
    border: 'none',
    width: '40px',
    height: '40px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    transition: 'background-color 0.2s',
  },
  monthTitle: {
    fontSize: '20px',
    fontWeight: '500',
    marginBottom: '12px',
  },
  calendarCard: {
    border: '1.5px solid #d0d0d0',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  weekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    backgroundColor: '#f7f7f7',
    borderBottom: '1px solid #d0d0d0',
  },
  weekDay: {
    padding: '10px 0',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
  },
  dayCell: {
    minHeight: '90px',
    borderRight: '1px solid #e0e0e0',
    borderBottom: '1px solid #e0e0e0',
    padding: '6px',
    boxSizing: 'border-box',
    position: 'relative',
  },
  dayNumber: {
    fontSize: '13px',
    color: '#555555',
    display: 'block',
    marginBottom: '6px',
  },
  badge: {
    fontSize: '11px',
    padding: '3px 6px',
    borderRadius: '4px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '4px',
  },
};