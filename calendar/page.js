'use client';

import { useEffect, useState } from 'react';

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API 호출 주소를 /calendar/api 로 변경
    fetch('/calendar/api')
      .then((res) => res.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>일정을 불러오는 중...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>TRPG 일정 달력</h2>
      <div style={{ display: 'grid', gap: '10px' }}>
        {events.map((evt) => (
          <div key={evt.id} style={{ border: '1px solid #eee', padding: '12px', borderRadius: '8px' }}>
            <strong>[{evt.start}]</strong> {evt.title} ({evt.rule})
          </div>
        ))}
      </div>
    </div>
  );
}