'use client';

import React, { useState } from 'react';

export default function LyricCardPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [lyricLines, setLyricLines] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);

  // 자동 추출된 배경색 (RGB)
  const [bgColor, setBgColor] = useState('rgb(229, 238, 241)');

  const [cardData, setCardData] = useState({
    title: 'Walk Thru Fire',
    artist: 'Vicetone',
    coverUrl: 'https://via.placeholder.com/300?text=Album+Art',
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

  // Canvas 기반 대표 색상 추출 함수 (CORS 우회 및 안정성 확보)
  const extractDominantColor = (imageUrl) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        // 이미지 중앙 50x50 영역의 피셀 데이터를 가져와 평균 색상 계산
        const imageData = ctx.getImageData(
          Math.floor(img.width * 0.25),
          Math.floor(img.height * 0.25),
          Math.floor(img.width * 0.5),
          Math.floor(img.height * 0.5)
        );

        const data = imageData.data;
        let r = 0, g = 0, b = 0;
        const count = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        setBgColor(`rgb(${r}, ${g}, ${b})`);
      } catch (e) {
        console.error('색상 추출 실패:', e);
        setBgColor('rgb(229, 238, 241)');
      }
    };

    img.onerror = () => {
      setBgColor('rgb(229, 238, 241)');
    };
  };

  // 곡 선택 시
  const handleSelectTrack = async (track) => {
    const highResCover = track.artworkUrl100.replace('100x100bb', '600x600bb');

    setCardData({
      title: track.trackName,
      artist: track.artistName,
      coverUrl: highResCover,
    });

    // 대표 색상 추출
    extractDominantColor(highResCover);

    setLyricLines(['가사를 불러오는 중...']);
    setSelectedIndices([]);

    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(track.artistName)}/${encodeURIComponent(track.trackName)}`);
      const data = await res.json();

      if (data.lyrics) {
        const lines = data.lyrics
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        setLyricLines(lines);
        setSelectedIndices([0, 1].filter((i) => i < lines.length));
      } else {
        setLyricLines(['가사를 찾지 못했습니다.']);
      }
    } catch (e) {
      setLyricLines(['가사를 불러오지 못했습니다.']);
    }
  };

  // 가사 선택 토글
  const toggleLyricSelection = (index) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  };

  // 16:9 프레임 전체 저장
  const handleDownload = async () => {
    const frameElement = document.getElementById('exportFrame');
    if (!frameElement) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(frameElement, { useCORS: true, scale: 2 });

      const link = document.createElement('a');
      link.download = `${cardData.title}-lyric-card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      alert('이미지 생성 중 오류가 발생했습니다.');
    }
  };

  const selectedLyricsText = selectedIndices
    .map((i) => lyricLines[i])
    .join('\n');

  return (
    <div style={styles.container}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>🎵 Lyric Card Generator</h1>

      {/* 1. 검색 영역 */}
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
          <button onClick={handleSearch} style={styles.searchButton}>
            {loading ? '검색 중...' : '검색'}
          </button>
        </div>

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
      </section>

      {/* 2. 가사 선택 영역 */}
      {lyricLines.length > 0 && (
        <section style={styles.section}>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '12px' }}>
            원하는 가사 구절을 클릭하여 선택하세요:
          </p>
          <div style={styles.lyricsGroup}>
            {lyricLines.map((line, idx) => {
              const isSelected = selectedIndices.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleLyricSelection(idx)}
                  style={{
                    ...styles.lyricButton,
                    backgroundColor: isSelected ? '#3182ce' : '#e5eef1',
                    color: isSelected ? '#ffffff' : '#1a202c',
                    fontWeight: isSelected ? '700' : '500',
                  }}
                >
                  {line}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. 흰색 16:9 프레임 내부 카드 미리보기 */}
      <section style={styles.previewSection}>
        <p style={{ fontWeight: 'bold', color: '#4a5568' }}>[ 16:9 최종 이미지 미리보기 ]</p>

        {/* 16:9 비율의 흰색 아우터 프레임 */}
        <div id="exportFrame" style={styles.outerFrame}>
          {/* 가사 양에 따라 크기가 가변하는 카드 */}
          <div
            style={{
              ...styles.innerCard,
              backgroundColor: bgColor,
            }}
          >
            <div style={styles.cardHeader}>
              <img src={cardData.coverUrl} alt="Album Cover" style={styles.cardCover} />
              <div style={styles.cardMeta}>
                <h3 style={styles.cardTitle}>{cardData.title}</h3>
                <p style={styles.cardArtist}>{cardData.artist}</p>
              </div>
            </div>

            {selectedLyricsText && (
              <div style={styles.cardBody}>
                <p style={styles.cardLyrics}>{selectedLyricsText}</p>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleDownload} style={styles.downloadBtn}>
          카드 이미지 다운로드
        </button>
      </section>
    </div>
  );
}

const styles = {
  container: { maxWidth: '640px', margin: '30px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' },
  section: { background: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  inputGroup: { display: 'flex', gap: '8px' },
  input: { flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none' },
  searchButton: { padding: '12px 18px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' },
  resultsList: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', maxHeight: '180px', overflowY: 'auto' },
  resultItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f7fafc', borderRadius: '10px', cursor: 'pointer' },
  thumb: { width: '40px', height: '40px', borderRadius: '6px' },

  lyricsGroup: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' },
  lyricButton: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', fontSize: '0.95rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', lineHeight: '1.4' },

  previewSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },

  // 흰색 16:9 프레임 (외각)
  outerFrame: {
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },

  // 가사에 맞게 유연하게 조정되는 내부 카드
  innerCard: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: '16px',
    padding: '20px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    transition: 'background-color 0.4s ease',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  cardCover: {
    width: '56px',
    height: '56px',
    borderRadius: '10px',
    objectFit: 'cover',
  },
  cardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '800',
    color: '#1a202c',
  },
  cardArtist: {
    margin: 0,
    fontSize: '0.88rem',
    color: '#4a5568',
    fontWeight: '600',
  },
  cardBody: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(8px)',
    padding: '14px 18px',
    borderRadius: '12px',
  },
  cardLyrics: {
    margin: 0,
    fontSize: '0.92rem',
    lineHeight: '1.5',
    color: '#1a202c',
    whiteSpace: 'pre-wrap',
    fontWeight: '600',
  },

  downloadBtn: { width: '100%', padding: '14px', background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' },
};