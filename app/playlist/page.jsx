"use client";

/**
 * TRACKLIST — YouTube 검색 기반 6곡 믹스테이프 플레이리스트
 * -----------------------------------------------------------
 * - YouTube Data API v3 (search.list) 로 노래 검색
 * - 검색 결과에서 최대 6곡까지 플레이리스트에 담기 (믹스테이프 트랙 01~06)
 * - 플레이리스트에서 곡을 선택하면 하단에 유튜브 플레이어로 재생
 * - 재생 중인 곡은 바이닐(LP) 아트가 회전하는 시그니처 인터랙션
 * - 각 트랙의 썸네일 이미지를 로컬에 저장(다운로드) 가능
 *
 * 사용 방법
 * -----------------------------------------------------------
 * 1) 우측 상단 "API 키" 버튼을 눌러 YouTube Data API v3 키를 입력하세요.
 *    (브라우저 localStorage에만 저장되며, 서버로 전송되지 않습니다.)
 * 2) 검색창에 곡 제목/아티스트를 입력하고 검색하세요.
 * 3) 검색 결과 카드의 + 버튼으로 플레이리스트(최대 6곡)에 추가하세요.
 * 4) 플레이리스트에서 트랙을 클릭하면 재생됩니다.
 * 5) 각 카드의 저장 아이콘으로 썸네일 이미지를 다운로드할 수 있습니다.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const MAX_TRACKS = 6;
const STORAGE_KEY = "tracklist_yt_api_key";

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [showKeyPanel, setShowKeyPanel] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [playlist, setPlaylist] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // 저장된 API 키 불러오기
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setApiKey(saved);
        setApiKeyDraft(saved);
      } else {
        setShowKeyPanel(true);
      }
    } catch (e) {
      // localStorage 접근 불가 환경(예: 프라이빗 모드) — 무시
    }
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  function saveApiKey() {
    const trimmed = apiKeyDraft.trim();
    setApiKey(trimmed);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch (e) {}
    setShowKeyPanel(false);
    showToast(trimmed ? "API 키를 저장했어요" : "API 키를 비웠어요");
  }

  async function handleSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (!apiKey) {
      setShowKeyPanel(true);
      setSearchError("먼저 YouTube API 키를 입력해 주세요.");
      return;
    }
    setSearching(true);
    setSearchError("");
    setHasSearched(true);
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", q);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoCategoryId", "10"); // Music
      url.searchParams.set("maxResults", "12");
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) {
        const message = data?.error?.message || "검색 중 오류가 발생했어요.";
        throw new Error(message);
      }

      const items = (data.items || [])
        .filter((it) => it.id?.videoId)
        .map((it) => ({
          id: it.id.videoId,
          title: decodeHtml(it.snippet.title),
          channel: decodeHtml(it.snippet.channelTitle),
          thumb:
            it.snippet.thumbnails?.high?.url ||
            it.snippet.thumbnails?.medium?.url ||
            it.snippet.thumbnails?.default?.url,
        }));
      setResults(items);
      if (items.length === 0) {
        setSearchError("검색 결과가 없어요. 다른 검색어를 시도해 보세요.");
      }
    } catch (err) {
      setResults([]);
      setSearchError(err.message || "검색 중 오류가 발생했어요.");
    } finally {
      setSearching(false);
    }
  }

  function addToPlaylist(track) {
    if (playlist.some((t) => t.id === track.id)) {
      showToast("이미 플레이리스트에 있는 곡이에요");
      return;
    }
    if (playlist.length >= MAX_TRACKS) {
      showToast(`플레이리스트는 최대 ${MAX_TRACKS}곡까지만 담을 수 있어요`);
      return;
    }
    setPlaylist((prev) => [...prev, track]);
    showToast(`"${track.title}" 추가됨`);
  }

  function removeFromPlaylist(id) {
    setPlaylist((prev) => prev.filter((t) => t.id !== id));
    if (currentId === id) {
      setCurrentId(null);
      setIsPlaying(false);
    }
  }

  function playTrack(id) {
    setCurrentId(id);
    setIsPlaying(true);
  }

  async function saveThumbnail(track) {
    try {
      const res = await fetch(track.thumb, { mode: "cors" });
      if (!res.ok) throw new Error("이미지를 불러올 수 없어요");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${sanitizeFilename(track.title)}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      showToast("썸네일을 저장했어요");
    } catch (err) {
      // CORS 등으로 blob 다운로드가 막히면 새 탭에서 열어 저장하도록 안내
      window.open(track.thumb, "_blank", "noopener,noreferrer");
      showToast("새 탭에서 열었어요. 이미지를 우클릭해 저장하세요");
    }
  }

  const currentTrack = playlist.find((t) => t.id === currentId) || null;
  const emptySlots = Math.max(0, MAX_TRACKS - playlist.length);

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">●</span>
          <h1>TRACKLIST</h1>
        </div>
        <button className="key-btn" onClick={() => setShowKeyPanel((v) => !v)}>
          <span className="key-dot" data-active={Boolean(apiKey)} />
          API 키
        </button>
      </header>

      {showKeyPanel && (
        <div className="key-panel">
          <div className="key-panel-inner">
            <label htmlFor="apikey">YouTube Data API v3 키</label>
            <div className="key-row">
              <input
                id="apikey"
                type="password"
                placeholder="AIza..."
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
              />
              <button className="btn-solid" onClick={saveApiKey}>
                저장
              </button>
            </div>
            <p className="key-hint">
              브라우저에만 저장돼요. Google Cloud Console에서 발급한 키를
              입력하세요.
            </p>
          </div>
        </div>
      )}

      <section className="hero">
        <p className="eyebrow">SEARCH &amp; COLLECT</p>
        <h2>노래를 검색해서 나만의 믹스테이프를 채워보세요</h2>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="곡 제목이나 아티스트를 입력하세요"
          />
          <button type="submit" className="btn-solid" disabled={searching}>
            {searching ? "검색 중..." : "검색"}
          </button>
        </form>
        {searchError && <p className="error-text">{searchError}</p>}
      </section>

      <main className="layout">
        {/* 검색 결과 */}
        <section className="panel results-panel">
          <div className="panel-head">
            <h3>검색 결과</h3>
            {results.length > 0 && <span className="count">{results.length}곡</span>}
          </div>

          {!hasSearched && (
            <div className="empty-state">
              <p>검색어를 입력하면 결과가 여기에 나타나요.</p>
            </div>
          )}

          {hasSearched && !searching && results.length === 0 && !searchError && (
            <div className="empty-state">
              <p>결과가 없어요.</p>
            </div>
          )}

          <ul className="result-list">
            {results.map((track) => {
              const inPlaylist = playlist.some((t) => t.id === track.id);
              return (
                <li key={track.id} className="result-card">
                  <img src={track.thumb} alt="" className="result-thumb" />
                  <div className="result-info">
                    <p className="result-title" title={track.title}>
                      {track.title}
                    </p>
                    <p className="result-channel">{track.channel}</p>
                  </div>
                  <div className="result-actions">
                    <button
                      className="icon-btn"
                      title="썸네일 저장"
                      onClick={() => saveThumbnail(track)}
                    >
                      ⭳
                    </button>
                    <button
                      className="icon-btn add"
                      title="플레이리스트에 추가"
                      onClick={() => addToPlaylist(track)}
                      disabled={inPlaylist}
                    >
                      {inPlaylist ? "✓" : "+"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 플레이리스트 (믹스테이프 트랙 01~06) */}
        <section className="panel playlist-panel">
          <div className="panel-head">
            <h3>믹스테이프</h3>
            <span className="count">
              {playlist.length} / {MAX_TRACKS}
            </span>
          </div>

          <ol className="tracklist">
            {playlist.map((track, i) => (
              <li
                key={track.id}
                className={`track-row ${currentId === track.id ? "active" : ""}`}
              >
                <span className="track-num">{String(i + 1).padStart(2, "0")}</span>
                <button className="track-main" onClick={() => playTrack(track.id)}>
                  <img src={track.thumb} alt="" className="track-thumb" />
                  <span className="track-text">
                    <span className="track-title">{track.title}</span>
                    <span className="track-channel">{track.channel}</span>
                  </span>
                </button>
                <button
                  className="icon-btn ghost"
                  title="저장"
                  onClick={() => saveThumbnail(track)}
                >
                  ⭳
                </button>
                <button
                  className="icon-btn ghost"
                  title="제거"
                  onClick={() => removeFromPlaylist(track.id)}
                >
                  ✕
                </button>
              </li>
            ))}

            {Array.from({ length: emptySlots }).map((_, i) => (
              <li key={`empty-${i}`} className="track-row empty">
                <span className="track-num">
                  {String(playlist.length + i + 1).padStart(2, "0")}
                </span>
                <span className="empty-label">빈 슬롯 — 검색 결과에서 추가하세요</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      {/* 재생 영역 */}
      <section className="player-section">
        <div className="vinyl-wrap">
          <div className={`vinyl ${isPlaying && currentTrack ? "spinning" : ""}`}>
            <div className="vinyl-grooves" />
            {currentTrack ? (
              <img src={currentTrack.thumb} alt="" className="vinyl-label" />
            ) : (
              <div className="vinyl-label vinyl-label-empty" />
            )}
            <div className="vinyl-hole" />
          </div>
          <div className={`tonearm ${isPlaying && currentTrack ? "down" : ""}`} />
        </div>

        <div className="now-playing">
          {currentTrack ? (
            <>
              <p className="eyebrow">NOW PLAYING</p>
              <h3>{currentTrack.title}</h3>
              <p className="np-channel">{currentTrack.channel}</p>
              <div className="player-frame">
                <iframe
                  key={currentTrack.id}
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${currentTrack.id}?autoplay=1`}
                  title={currentTrack.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="np-actions">
                <button
                  className="btn-outline"
                  onClick={() => setIsPlaying((v) => !v)}
                >
                  {isPlaying ? "일시정지 표시" : "재생 표시"}
                </button>
                <button className="btn-outline" onClick={() => saveThumbnail(currentTrack)}>
                  썸네일 저장
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p className="eyebrow">NOW PLAYING</p>
              <p>믹스테이프에서 트랙을 선택하면 여기서 재생돼요.</p>
            </div>
          )}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600&display=swap");
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
        }
      `}</style>

      <style jsx>{`
        :global(html) {
          background: #121014;
        }
        .page {
          --bg: #121014;
          --bg-elev: #1c1a1f;
          --bg-elev-2: #242127;
          --accent: #e8a33d;
          --accent-soft: rgba(232, 163, 61, 0.16);
          --needle: #d64545;
          --text: #f5f0e8;
          --text-muted: #8a8590;
          --border: #2e2a31;

          position: relative;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: "Inter", system-ui, sans-serif;
          padding: 28px 32px 80px;
          max-width: 1180px;
          margin: 0 auto;
        }

        .grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          z-index: 0;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-mark {
          color: var(--accent);
          font-size: 14px;
        }
        .brand h1 {
          font-family: "Bebas Neue", sans-serif;
          letter-spacing: 0.12em;
          font-size: 30px;
          margin: 0;
        }
        .key-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          cursor: pointer;
          font-family: "Space Mono", monospace;
        }
        .key-btn:hover {
          border-color: var(--accent);
        }
        .key-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #55505a;
          display: inline-block;
        }
        .key-dot[data-active="true"] {
          background: #6fbf73;
        }

        .key-panel {
          margin-bottom: 20px;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 18px 20px;
        }
        .key-panel-inner label {
          font-family: "Space Mono", monospace;
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .key-row {
          display: flex;
          gap: 10px;
          margin-top: 8px;
        }
        .key-row input {
          flex: 1;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text);
          font-family: "Space Mono", monospace;
          font-size: 13px;
        }
        .key-row input:focus {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .key-hint {
          margin: 10px 0 0;
          font-size: 12px;
          color: var(--text-muted);
        }

        .hero {
          padding: 34px 0 26px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 26px;
        }
        .eyebrow {
          font-family: "Space Mono", monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          color: var(--accent);
          text-transform: uppercase;
          margin: 0 0 10px;
        }
        .hero h2 {
          font-family: "Bebas Neue", sans-serif;
          font-weight: 400;
          font-size: 40px;
          letter-spacing: 0.01em;
          line-height: 1.15;
          margin: 0 0 22px;
          max-width: 640px;
        }
        .search-form {
          display: flex;
          gap: 10px;
          max-width: 560px;
        }
        .search-form input {
          flex: 1;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 13px 16px;
          color: var(--text);
          font-size: 15px;
        }
        .search-form input:focus {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .error-text {
          margin-top: 12px;
          color: var(--needle);
          font-size: 13px;
        }

        .btn-solid {
          background: var(--accent);
          color: #1a1408;
          border: none;
          border-radius: 10px;
          padding: 13px 20px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
        }
        .btn-solid:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .btn-outline {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 999px;
          padding: 9px 16px;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-outline:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .layout {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 20px;
          position: relative;
          z-index: 1;
        }
        @media (max-width: 860px) {
          .layout {
            grid-template-columns: 1fr;
          }
        }

        .panel {
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px;
        }
        .panel-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .panel-head h3 {
          font-family: "Bebas Neue", sans-serif;
          letter-spacing: 0.06em;
          font-size: 20px;
          margin: 0;
        }
        .count {
          font-family: "Space Mono", monospace;
          font-size: 12px;
          color: var(--text-muted);
        }

        .empty-state {
          padding: 26px 8px;
          color: var(--text-muted);
          font-size: 14px;
        }

        .result-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 560px;
          overflow-y: auto;
        }
        .result-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--bg-elev-2);
          border-radius: 10px;
          padding: 8px;
        }
        .result-thumb {
          width: 64px;
          height: 48px;
          object-fit: cover;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .result-info {
          flex: 1;
          min-width: 0;
        }
        .result-title {
          margin: 0 0 2px;
          font-size: 13.5px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .result-channel {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .result-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .icon-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg-elev);
          color: var(--text);
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-btn.add:not(:disabled):hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .icon-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .icon-btn.ghost {
          background: transparent;
        }

        .tracklist {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .track-row {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 10px;
          padding: 6px;
          background: var(--bg-elev-2);
        }
        .track-row.empty {
          background: transparent;
          border: 1px dashed var(--border);
          color: var(--text-muted);
          font-size: 12.5px;
        }
        .track-row.active {
          outline: 1px solid var(--accent);
        }
        .track-num {
          font-family: "Space Mono", monospace;
          font-size: 12px;
          color: var(--accent);
          width: 22px;
          flex-shrink: 0;
          text-align: center;
        }
        .track-row.empty .track-num {
          color: var(--text-muted);
        }
        .track-main {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          min-width: 0;
          text-align: left;
        }
        .track-thumb {
          width: 42px;
          height: 42px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .track-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .track-title {
          font-size: 13px;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .track-channel {
          font-size: 11px;
          color: var(--text-muted);
        }
        .empty-label {
          padding: 8px 4px;
        }

        .player-section {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 32px;
          align-items: start;
          position: relative;
          z-index: 1;
        }
        @media (max-width: 720px) {
          .player-section {
            grid-template-columns: 1fr;
          }
        }

        .vinyl-wrap {
          position: relative;
          width: 220px;
          height: 220px;
          justify-self: center;
        }
        .vinyl {
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 50%, #2a262e 0%, #17151a 60%, #0e0c10 100%);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .vinyl-grooves {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: repeating-radial-gradient(
            circle at 50% 50%,
            rgba(255, 255, 255, 0.03) 0px,
            rgba(255, 255, 255, 0.03) 1px,
            transparent 2px,
            transparent 4px
          );
        }
        .vinyl-label {
          width: 92px;
          height: 92px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #100e12;
        }
        .vinyl-label-empty {
          background: var(--accent-soft);
        }
        .vinyl-hole {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--bg);
        }
        .vinyl.spinning {
          animation: spin 3.2s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .tonearm {
          position: absolute;
          top: -18px;
          right: -6px;
          width: 90px;
          height: 6px;
          background: #3a353f;
          border-radius: 4px;
          transform-origin: right center;
          transform: rotate(-28deg);
          transition: transform 0.4s ease;
        }
        .tonearm::after {
          content: "";
          position: absolute;
          right: -4px;
          top: -5px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3a353f;
        }
        .tonearm.down {
          transform: rotate(-6deg);
        }

        .now-playing {
          min-width: 0;
        }
        .now-playing h3 {
          font-family: "Bebas Neue", sans-serif;
          font-size: 26px;
          letter-spacing: 0.01em;
          margin: 0 0 4px;
        }
        .np-channel {
          margin: 0 0 16px;
          color: var(--text-muted);
          font-size: 13px;
        }
        .player-frame {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: #000;
        }
        .np-actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }

        .toast {
          position: fixed;
          left: 50%;
          bottom: 26px;
          transform: translateX(-50%);
          background: var(--bg-elev-2);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px 18px;
          border-radius: 999px;
          font-size: 13px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 10;
        }
      `}</style>
    </div>
  );
}

function decodeHtml(str) {
  if (typeof document === "undefined") return str;
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "thumbnail";
}
