'use client';

import React, { useState, useRef } from 'react';
import { Poppins, Montserrat, Inter } from 'next/font/google';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });

// ⚠️ Spotify Developer Dashboard에서 발급받은 클라이언트 정보 입력
const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET = 'YOUR_SPOTIFY_CLIENT_SECRET';

export default function LyricCardPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [lyricLines, setLyricLines] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [bgColor, setBgColor] = useState('hsl(200, 40%, 86%)');

  const [selectedFont, setSelectedFont] = useState('poppins');
  const [customFontName, setCustomFontName] = useState('');

  const [cardData, setCardData] = useState({
    title: 'Title',
    artist: 'Artist',
    coverUrl: '',
  });

  const innerCardRef = useRef(null);

  // Spotify Access Token 획득
  const getSpotifyAccessToken = async () => {
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
        },
        body: 'grant_type=client_credentials',
      });
      const data = await res.json();
      return data.access_token;
    } catch (e) {
      return null;
    }
  };

  // 폰트 업로드
  const handleCustomFontUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fontName = `CustomFont_${Date.now()}`;
    const fontUrl = URL.createObjectURL(file);
    const newFontFace = new FontFace(fontName, `url(${fontUrl})`);

    newFontFace.load().then((loadedFace) => {
      document.fonts.add(loadedFace);
      setCustomFontName(fontName);
      setSelectedFont('custom');
    }).catch(() => alert('폰트 파일을 불러오는 데 실패했습니다.'));
  };

  const getCurrentFontFamily = () => {
    switch (selectedFont) {
      case 'poppins': return `${poppins.style.fontFamily}, sans-serif`;
      case 'montserrat': return `${montserrat.style.fontFamily}, sans-serif`;
      case 'inter': return `${inter.style.fontFamily}, sans-serif`;
      case 'custom': return customFontName ? `"${customFontName}", sans-serif` : 'sans-serif';
      case 'system':
      default: return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    }
  };

  const normalizeText = (text) => text.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

  // 가사 가져오기 (lyrics.ovh)
  const fetchLyrics = async (artist, title) => {
    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
      const data = await res.json();
      if (data.lyrics) {
        return data.lyrics.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      }
    } catch (e) {}
    return [];
  };

  // 검색 처리 (iTunes 메인 + Spotify 서브)
  const handleSearch = async () => {
    if (!query.trim()) return alert('노래 제목이나 가수를 입력해주세요.');
    setLoading(true);
    setResults([]);

    try {
      // 1. iTunes API 검색 (메인)
      const itunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=8`)
        .then(res => res.json())
        .then(data => data.results || [])
        .catch(() => []);

      // 2. Spotify API 검색 (서브)
      const spotifyPromise = (async () => {
        if (SPOTIFY_CLIENT_ID === 'YOUR_SPOTIFY_CLIENT_ID') return [];
        const token = await getSpotifyAccessToken();
        if (!token) return [];

        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        return data.tracks?.items || [];
      })();

      const [itunesResults, spotifyResults] = await Promise.all([itunesPromise, spotifyPromise]);

      // iTunes 트랙 포맷팅
      const formattedItunes = itunesResults.map(t => ({
        id: `itunes_${t.trackId}`,
        title: t.trackName,
        artist: t.artistName,
        coverUrl: t.artworkUrl100.replace('100x100bb', '600x600bb'),
        platform: 'iTunes',
        isMain: true
      }));

      // Spotify 트랙 포맷팅
      const formattedSpotify = spotifyResults.map(t => ({
        id: `spotify_${t.id}`,
        title: t.name,
        artist: t.artists.map(a => a.name).join(', '),
        coverUrl: t.album.images[0]?.url || 'https://via.placeholder.com/300',
        platform: 'Spotify',
        isMain: false
      }));

      // 3. 중복 제거 (iTunes 항목 우선 유지)
      const combined = [...formattedItunes, ...formattedSpotify];
      const uniqueMap = new Map();

      combined.forEach(track => {
        const key = `${normalizeText(track.title)}_${normalizeText(track.artist)}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, track);
        } else {
          // 이미 존재할 경우 메인(iTunes) 트랙을 계속 유지
          const existing = uniqueMap.get(key);
          if (!existing.isMain && track.isMain) {
            uniqueMap.set(key, track);
          }
        }
      });

      setResults(Array.from(uniqueMap.values()));
    } catch (err) {
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 파스텔톤 배경 추출
  const convertToPastelRgb = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    const hueDegree = Math.round(h * 360);
    const pastelSaturation = Math.min(Math.max(Math.round(s * 100), 35), 50);
    const pastelLightness = Math.round(l * 100) < 60 ? 86 : Math.min(Math.max(Math.round(l * 100), 80), 88);
    return `hsl(${hueDegree}, ${pastelSaturation}%, ${pastelLightness}%)`;
  };

  const extractDominantColor = (imageUrl) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(Math.floor(img.width * 0.25), Math.floor(img.height * 0.25), Math.floor(img.width * 0.5), Math.floor(img.height * 0.5));
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
        setBgColor(convertToPastelRgb(Math.floor(r / count), Math.floor(g / count), Math.floor(b / count)));
      } catch (e) {
        setBgColor('hsl(200, 40%, 86%)');
      }
    };
    img.onerror = () => setBgColor('hsl(200, 40%, 86%)');
  };

  const handleSelectTrack = async (track) => {
    setCardData({ title: track.title, artist: track.artist, coverUrl: track.coverUrl });
    extractDominantColor(track.coverUrl);
    setLyricLines(['가사를 불러오는 중...']);
    setSelectedIndices([]);

    const lines = await fetchLyrics(track.artist, track.title);
    if (lines.length > 0) {
      setLyricLines(lines);
      setSelectedIndices([0, 1].filter((i) => i < lines.length));
    } else {
      setLyricLines(['등록된 가사가 없습니다.']);
    }
  };

  const toggleLyricSelection = (index) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const handleDownload = async () => {
    const cardEl = innerCardRef.current;
    if (!cardEl) return;

    try {
      if (document.fonts) await document.fonts.ready;
      const html2canvas = (await import('html2canvas')).default;

      const rect = cardEl.getBoundingClientRect();
      const targetRatio = 16 / 9;
      const currentRatio = rect.width / rect.height;

      let frameWidth = rect.width;
      let frameHeight = rect.height;

      if (currentRatio > targetRatio) {
        frameHeight = rect.width / targetRatio;
      } else {
        frameWidth = rect.height * targetRatio;
      }

      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.top = '-9999px';
      wrapper.style.left = '-9999px';
      wrapper.style.width = `${frameWidth}px`;
      wrapper.style.height = `${frameHeight}px`;
      wrapper.style.backgroundColor = 'transparent';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.fontFamily = getCurrentFontFamily();

      const clonedCard = cardEl.cloneNode(true);
      wrapper.appendChild(clonedCard);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, { backgroundColor: null, useCORS: true, scale: 2 });
      document.body.removeChild(wrapper);

      const link = document.createElement('a');
      link.download = `${cardData.title}-lyric-card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      alert('이미지 생성 중 오류가 발생했습니다.');
    }
  };

  const selectedLyricsText = selectedIndices.map((i) => lyricLines[i]).join('\n');

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
              <div key={track.id} onClick={() => handleSelectTrack(track)} style={styles.resultItem}>
                <img src={track.coverUrl} alt={track.title} style={styles.thumb} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.95rem' }}>{track.title}</strong>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>{track.artist}</p>
                </div>
                <span style={styles.platformTag}>{track.platform}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. 폰트 선택 옵션 영역 */}
      <section style={styles.section}>
        <p style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '10px' }}>
          🔤 폰트 선택
        </p>
        <div style={styles.fontOptionGroup}>
          <select value={selectedFont} onChange={(e) => setSelectedFont(e.target.value)} style={styles.selectInput}>
            <option value="poppins">Poppins (기본)</option>
            <option value="montserrat">Montserrat</option>
            <option value="inter">Inter</option>
            <option value="system">기본 시스템 폰트</option>
            {customFontName && <option value="custom">사용자 지정 폰트</option>}
          </select>

          <label style={styles.fileUploadLabel}>
            폰트 파일 업로드 (.ttf, .otf, .woff)
            <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleCustomFontUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </section>

      {/* 3. 가사 선택 영역 */}
      {lyricLines.length > 0 && (
        <section style={styles.section}>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '12px' }}>원하는 가사 구절을 클릭하여 선택하세요:</p>
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
                    fontFamily: getCurrentFontFamily(),
                  }}
                >
                  {line}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. 카드 미리보기 영역 */}
      <section style={styles.previewSection}>
        <p style={{ fontWeight: 'bold', color: '#4a5568' }}>[ 가사 카드 미리보기 ]</p>
        <div style={styles.transparentCheckerboard}>
          <div ref={innerCardRef} style={{ ...styles.innerCard, backgroundColor: bgColor, fontFamily: getCurrentFontFamily() }}>
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
        <button onClick={handleDownload} style={styles.downloadBtn}>16:9 투명 이미지 다운로드</button>
      </section>
    </div>
  );
}

const styles = {
  container: { maxWidth: '520px', margin: '30px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' },
  section: { background: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  inputGroup: { display: 'flex', gap: '8px' },
  input: { flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none' },
  searchButton: { padding: '12px 18px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' },
  resultsList: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', maxHeight: '220px', overflowY: 'auto' },
  resultItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f7fafc', borderRadius: '10px', cursor: 'pointer' },
  thumb: { width: '44px', height: '44px', borderRadius: '6px', objectFit: 'cover' },
  platformTag: { fontSize: '0.75rem', padding: '3px 8px', background: '#edf2f7', color: '#4a5568', borderRadius: '6px', fontWeight: '600' },
  fontOptionGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  selectInput: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' },
  fileUploadLabel: { display: 'inline-block', padding: '10px 12px', background: '#edf2f7', color: '#4a5568', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', textAlign: 'center', cursor: 'pointer', border: '1px dashed #cbd5e0' },
  lyricsGroup: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' },
  lyricButton: { width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', fontSize: '0.95rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', lineHeight: '1.4' },
  previewSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' },
  transparentCheckerboard: { width: '100%', padding: '24px 16px', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', backgroundImage: `linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)`, backgroundSize: '16px 16px', backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px', boxSizing: 'border-box' },
  innerCard: { width: '100%', maxWidth: '420px', borderRadius: '16px', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px', transition: 'background-color 0.4s ease', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '14px' },
  cardCover: { width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover' },
  cardMeta: { display: 'flex', flexDirection: 'column', gap: '2px' },
  cardTitle: { margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1a202c' },
  cardArtist: { margin: 0, fontSize: '0.88rem', color: '#4a5568', fontWeight: '600' },
  cardBody: { backgroundColor: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(8px)', padding: '14px 18px', borderRadius: '12px' },
  cardLyrics: { margin: 0, fontSize: '0.92rem', lineHeight: '1.5', color: '#1a202c', whiteSpace: 'pre-wrap', fontWeight: '600' },
  downloadBtn: { width: '100%', padding: '14px', background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' },
};