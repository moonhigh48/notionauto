'use client';

import React, { useState } from 'react';

export default function LyricCardPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLyrics, setSelectedLyrics] = useState('');

  const [cardData, setCardData] = useState({
    title: '노래 제목',
    artist: '가수 이름',
    coverUrl: 'https://via.placeholder.com/300?text=Album+Art',
    lyrics: '선택한 가사가 여기에 표시됩니다.',
  });

  // iTunes API 검색
  const handleSearch = async () => {
    if (!query.trim()) return alert('노래 제목이나 가수를 입력해주세요.');
    setLoading(true);

    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
      const data = await res.json();

      if (data.results) {
        setResults(data.results);
      }
    } catch (err) {
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 곡 선택 시 가사 검색 (Lyrics.ovh API)
  const handleSelectTrack = async (track) => {
    const highResCover = track.artworkUrl100.replace('100x100bb', '600x600bb');

    setCardData((prev) => ({
      ...prev,
      title: track.trackName,
      artist: track.artistName,
      coverUrl: highResCover,
    }));

    setSelectedLyrics('가사를 불러오는 중...');

    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(track.artistName)}/${encodeURIComponent(track.trackName)}`);
      const data = await res.json();

      if (data.lyrics) {
        setSelectedLyrics(data.lyrics);
        // 상위 4줄 기본 적용
        const shortLyrics = data.lyrics.split('\n').slice(0, 4).join('\n');
        setCardData((prev) => ({ ...prev, lyrics: shortLyrics }));
      } else {
        setSelectedLyrics('');
        setCardData((prev) => ({ ...prev, lyrics: '가사를 찾지 못했습니다. 직접 입력해주세요.' }));
      }
    } catch (e) {
      setSelectedLyrics('');
      setCardData((prev) => ({ ...prev, lyrics: '가사를 불러오지 못했습니다. 직접 입력해주세요.' }));
    }
  };

  // 가사 직접 수정 반영
  const handleLyricsChange = (e) => {
    const text = e.target.value;
    setSelectedLyrics(text);
    setCardData((prev) => ({
      ...prev,
      lyrics: text || '선택한 가사가 여기에 표시됩니다.',
    }));
  };

  // 카드 이미지 다운로드 (Next.js SSR 방지를 위해 동적 import 사용)
  const handleDownload = async () => {
    const cardElement = document.getElementById('lyricCard');
    if (!cardElement) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardElement, { useCORS: true, scale: 2 });
      
      const link = document.createElement('a');
      link.download = `${cardData.title}-lyric-card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      alert('이미지 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>🎵 Lyric Card Generator</h1>

      {/* 검색 및 가사 입력 영역 */}
      <section style={styles.section}>
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="노래 제목 또는 가수 이름을 입력하세요"
            style={styles.input}
          />
          <button onClick={handleSearch} style={styles.button}>
            {loading ? '검색 중...' : '가사 검색'}
          </button>
        </div>

        {/* 검색 결과 목록 */}
        {results.length > 0 && (
          <div style={styles.resultsList}>
            {results.map((track) => (
              <div
                key={track.trackId}
                onClick={() => handleSelectTrack(track)}
                style={styles.resultItem}
              >
                <img src={track.artworkUrl100} alt={track.trackName} style={styles.thumb} />
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{track.trackName}</strong>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{track.artistName}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 가사 편집 영역 */}
        <textarea
          value={selectedLyrics}
          onChange={handleLyricsChange}
          placeholder="검색 결과에서 가사를 선택하거나, 여기에 직접 가사를 입력하세요."
          style={styles.textarea}
        />
      </section>

      {/* 카드 미리보기 영역 */}
      <section style={styles.previewSection}>
        <div id="lyricCard" style={styles.card}>
          <div style={styles.coverWrapper}>
            <img src={cardData.coverUrl} alt="Cover" style={styles.coverImg} />
          </div>
          <div style={styles.cardContent}>
            <p style={styles.cardLyrics}>{cardData.lyrics}</p>
            <div>
              <h3 style={styles.cardTitle}>{cardData.title}</h3>
              <p style={styles.cardArtist}>{cardData.artist}</p>
            </div>
          </div>
        </div>

        <button onClick={handleDownload} style={styles.downloadBtn}>
          카드 이미지 다운로드
        </button>
      </section>
    </div>
  );
}

// 스타일 설정
const styles = {
  container: { maxWidth: '800px', margin: '40px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' },
  section: { background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  inputGroup: { display: 'flex', gap: '10px', marginBottom: '10px' },
  input: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.95rem' },
  button: { padding: '12px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  resultsList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', marginBottom: '10px' },
  resultItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f8f9fa', borderRadius: '8px', cursor: 'pointer' },
  thumb: { width: '45px', height: '45px', borderRadius: '6px' },
  textarea: { width: '100%', height: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', resize: 'vertical', marginTop: '10px', fontSize: '0.95rem' },
  previewSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
  card: { width: '340px', background: '#1c1c1e', color: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' },
  coverWrapper: { width: '100%', height: '340px' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardContent: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
  cardLyrics: { fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: '#e5e5ea', margin: 0 },
  cardTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 'bold' },
  cardArtist: { margin: '4px 0 0 0', fontSize: '0.85rem', color: '#a1a1a6' },
  downloadBtn: { width: '340px', padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' },
};