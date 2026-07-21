export default function HomePage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Notion Auto Server</h1>
      <p>서버가 정상적으로 동작 중입니다.</p>
      <a href="/calendar" style={{ color: '#0070f3', textDecoration: 'underline' }}>
        캘린더 페이지로 이동하기 ➔
      </a>
    </div>
  );
}