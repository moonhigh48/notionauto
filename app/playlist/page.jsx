"use client";

/**
 * TRACKLIST — YouTube 검색 기반 믹스테이프 플레이리스트
 * -----------------------------------------------------------
 * - YouTube Data API v3 (search.list) 로 노래 검색, 트랙 수 제한 없음
 * - 플레이리스트에 추가되는 순간, iTunes Search API(키 불필요)로 같은 곡을
 *   찾아 앨범 아트를 가져와 오른쪽 트랙 썸네일을 앨범 커버로 교체
 *   (매칭 실패 시 유튜브 썸네일을 그대로 사용)
 * - YouTube IFrame Player API로 실제 재생/일시정지 상태를 제어
 * - 자동재생(다음 곡으로 자동 진행) on/off, 반복 모드(안함/전체/한 곡) 지원
 * - 드래그 핸들(⋮⋮)로 플레이리스트 순서를 사이트 톤에 맞게 커스텀 드래그 정렬
 * - 재생 중인 곡은 바이닐(LP) 아트가 회전하는 시그니처 인터랙션 (앨범 아트가 있으면 그걸 라벨로 사용)
 * - 각 트랙의 썸네일(앨범 아트 우선) 이미지를 로컬에 저장(다운로드) 가능
 *
 * 사용 방법
 * -----------------------------------------------------------
 * 1) 우측 상단 "API 키" 버튼을 눌러 YouTube Data API v3 키를 입력하세요.
 *    (브라우저 localStorage에만 저장되며, 서버로 전송되지 않습니다.)
 * 2) 검색창에 곡 제목/아티스트를 입력하고 검색하세요.
 * 3) 검색 결과 카드의 + 버튼으로 플레이리스트에 추가하세요.
 *    → 추가와 동시에 iTunes에서 앨범 아트를 자동으로 찾아옵니다.
 * 4) 플레이리스트에서 트랙을 클릭하면 재생됩니다. 드래그 핸들로 순서를 바꿀 수 있어요.
 * 5) 자동재생 / 반복 모드는 플레이리스트 상단 툴바에서 설정하세요.
 * 6) 각 카드의 저장 아이콘으로 썸네일(앨범 아트) 이미지를 다운로드할 수 있습니다.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "tracklist_yt_api_key";
const SEARCH_CACHE_KEY = "tracklist_search_cache";
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간 — YouTube 일일 쿼터 리셋 주기에 맞춤
const SEARCH_CACHE_MAX_ENTRIES = 60; // localStorage 용량 관리를 위한 캐시 상한
const USAGE_KEY = "tracklist_api_usage";

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [showKeyPanel, setShowKeyPanel] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [resultFromCache, setResultFromCache] = useState(false);
  const [apiCallsToday, setApiCallsToday] = useState(0);

  const [playlist, setPlaylist] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [repeatMode, setRepeatMode] = useState("off"); // 'off' | 'all' | 'one'

  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // YouTube IFrame Player API 연동용 ref
  const playerContainerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
  const playerRef = useRef(null);
  const [ytApiReady, setYtApiReady] = useState(false);

  // 이벤트 콜백에서 최신 값을 읽기 위한 ref (클로저 stale 문제 방지)
  const playlistRef = useRef(playlist);
  const currentIdRef = useRef(currentId);
  const autoPlayRef = useRef(autoPlay);
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

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
    setApiCallsToday(loadUsageCount());
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
    if (searching) return; // 이미 요청 중이면 중복 호출 방지

    setSearchError("");
    setHasSearched(true);
    setResultFromCache(false);

    // 1) 캐시 확인 — 24시간 이내에 같은 검색어를 찾았다면 API를 호출하지 않고 재사용
    const cacheKeyQ = normalizeQuery(q);
    const cache = loadSearchCache();
    const cached = cache[cacheKeyQ];
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
      setResults(cached.items);
      setResultFromCache(true);
      if (cached.items.length === 0) {
        setSearchError("검색 결과가 없어요. 다른 검색어를 시도해 보세요.");
      }
      return;
    }

    // 2) 캐시에 없을 때만 실제 API 호출
    setSearching(true);
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

      // 3) 결과를 캐시에 저장하고, 실제 API 호출 횟수 카운트 증가
      saveSearchCache({ ...cache, [cacheKeyQ]: { items, timestamp: Date.now() } });
      setApiCallsToday(bumpUsageCount());
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
    // 유튜브 제목에서 "아티스트 - 곡명" 등 노이즈를 정리해 깔끔한 제목을 미리 뽑아둠
    // (앨범 아트 검색에 쓰는 것과 같은 파서를 재사용)
    const { song } = parseArtistAndSong(track.title, track.channel);

    // 우선 유튜브 썸네일로 즉시 추가하고, 앨범 아트는 비동기로 찾아서 교체
    setPlaylist((prev) => [
      ...prev,
      { ...track, cleanTitle: song || track.title, albumArt: null, artLoading: true },
    ]);
    showToast(`"${track.title}" 추가됨 · 앨범 아트 찾는 중...`);

    fetchAlbumArt(track.title, track.channel).then((artUrl) => {
      setPlaylist((prev) =>
        prev.map((t) =>
          t.id === track.id ? { ...t, albumArt: artUrl, artLoading: false } : t
        )
      );
    });
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

  function togglePlayPause() {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }

  function cycleRepeatMode() {
    setRepeatMode((prev) => {
      const next = prev === "off" ? "all" : prev === "all" ? "one" : "off";
      const labels = { off: "반복 안 함", all: "전체 반복", one: "한 곡 반복" };
      showToast(labels[next]);
      return next;
    });
  }

  function toggleAutoPlay() {
    setAutoPlay((prev) => {
      showToast(!prev ? "자동재생 켜짐" : "자동재생 꺼짐");
      return !prev;
    });
  }

  // 현재 곡이 끝났을 때: 반복 모드 / 자동재생 설정에 따라 다음 동작 결정
  function handleTrackEnd() {
    const list = playlistRef.current;
    const curId = currentIdRef.current;

    if (repeatModeRef.current === "one") {
      playerRef.current?.seekTo(0);
      playerRef.current?.playVideo();
      return;
    }

    if (!autoPlayRef.current) {
      setIsPlaying(false);
      return;
    }

    const idx = list.findIndex((t) => t.id === curId);
    const nextTrack = list[idx + 1];
    if (nextTrack) {
      playTrack(nextTrack.id);
    } else if (repeatModeRef.current === "all" && list.length > 0) {
      playTrack(list[0].id);
    } else {
      setIsPlaying(false);
    }
  }

  // 드래그 정렬: 순서 배열 재배치
  function reorderPlaylist(fromIndex, toIndex) {
    setPlaylist((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleDragStart(e, index) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(index));
    } catch (err) {}
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (index !== dragOverIndex) setDragOverIndex(index);
  }

  function handleDrop(e, index) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      reorderPlaylist(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // YouTube IFrame Player API 스크립트를 한 번만 로드
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }
    const existing = document.getElementById("youtube-iframe-api");
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === "function") prevCallback();
      setYtApiReady(true);
    };
    if (!existing) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // currentTrack이 바뀌면 플레이어를 생성하거나 영상을 교체
  useEffect(() => {
    if (!ytApiReady || !currentId) return;

    if (!playerRef.current) {
      playerRef.current = new window.YT.Player(playerContainerId.current, {
        videoId: currentId,
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onReady: (e) => {
            e.target.playVideo();
          },
          onStateChange: (e) => {
            const YTState = window.YT.PlayerState;
            if (e.data === YTState.PLAYING) setIsPlaying(true);
            else if (e.data === YTState.PAUSED) setIsPlaying(false);
            else if (e.data === YTState.ENDED) handleTrackEnd();
          },
        },
      });
    } else {
      playerRef.current.loadVideoById(currentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytApiReady, currentId]);

  async function saveThumbnail(track) {
    const imageUrl = track.albumArt || track.thumb;
    try {
      const res = await fetch(imageUrl, { mode: "cors" });
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
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      showToast("새 탭에서 열었어요. 이미지를 우클릭해 저장하세요");
    }
  }

  const currentTrack = playlist.find((t) => t.id === currentId) || null;

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
        <p className="usage-hint">
          오늘 YouTube API 검색 호출 <strong>{apiCallsToday}회</strong> · 같은
          검색어는 24시간 동안 캐시에서 불러와 쿼터를 아껴요
        </p>
      </section>

      <main className="layout">
        {/* 검색 결과 */}
        <section className="panel results-panel">
          <div className="panel-head">
            <h3>검색 결과</h3>
            {results.length > 0 && (
              <span className="count">
                {results.length}곡
                {resultFromCache && <span className="cache-badge">⚡ 캐시됨</span>}
              </span>
            )}
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

        {/* 플레이리스트 (믹스테이프, 무제한) */}
        <section className="panel playlist-panel">
          <div className="panel-head">
            <h3>믹스테이프</h3>
            <span className="count">{playlist.length}곡</span>
          </div>

          <div className="playback-toolbar">
            <button
              className={`toggle-pill ${autoPlay ? "on" : ""}`}
              onClick={toggleAutoPlay}
              title="자동재생"
            >
              <span className="toggle-dot" />
              자동재생
            </button>
            <button className="toggle-pill" onClick={cycleRepeatMode} title="반복 모드">
              <span className="repeat-icon">
                {repeatMode === "one" ? "🔂" : "🔁"}
              </span>
              {repeatMode === "off" && "반복 안 함"}
              {repeatMode === "all" && "전체 반복"}
              {repeatMode === "one" && "한 곡 반복"}
            </button>
          </div>

          {playlist.length === 0 && (
            <div className="empty-state">
              <p>검색 결과에서 + 버튼을 눌러 곡을 추가하세요.</p>
            </div>
          )}

          <ol className="tracklist">
            {playlist.map((track, i) => (
              <li
                key={track.id}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={[
                  "track-row",
                  currentId === track.id ? "active" : "",
                  dragIndex === i ? "dragging" : "",
                  dragOverIndex === i && dragIndex !== null && dragIndex !== i
                    ? "drag-over"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="drag-handle" title="드래그로 순서 변경">
                  ⋮⋮
                </span>
                <span className="track-num">{String(i + 1).padStart(2, "0")}</span>
                <button className="track-main" onClick={() => playTrack(track.id)}>
                  <span className="track-thumb-wrap">
                    <img
                      src={track.albumArt || track.thumb}
                      alt=""
                      className="track-thumb"
                    />
                    {track.artLoading && <span className="art-loading" title="앨범 아트 찾는 중" />}
                    {currentId === track.id && isPlaying && (
                      <span className="playing-indicator" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </span>
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
          </ol>
        </section>
      </main>

      {/* 재생 영역 */}
      <section className="player-section">
        <div className="vinyl-wrap">
          <div className={`vinyl ${isPlaying && currentTrack ? "spinning" : ""}`}>
            <div className="vinyl-grooves" />
            {currentTrack ? (
              <img
                src={currentTrack.albumArt || currentTrack.thumb}
                alt=""
                className="vinyl-label"
              />
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
              <h3>{currentTrack.cleanTitle || currentTrack.title}</h3>
              <p className="np-channel">{currentTrack.channel}</p>
              <div className="player-frame">
                <div id={playerContainerId.current} className="yt-player-target" />
              </div>
              <div className="np-actions">
                <button className="btn-outline" onClick={togglePlayPause}>
                  {isPlaying ? "일시정지" : "재생"}
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
        .usage-hint {
          margin: 12px 0 0;
          font-family: "Space Mono", monospace;
          font-size: 11.5px;
          color: var(--text-muted);
        }
        .usage-hint strong {
          color: var(--accent);
          font-weight: 700;
        }
        .cache-badge {
          margin-left: 6px;
          font-family: "Space Mono", monospace;
          font-size: 10px;
          color: var(--accent);
          border: 1px solid var(--accent-soft);
          background: var(--accent-soft);
          padding: 1px 6px;
          border-radius: 999px;
          text-transform: uppercase;
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

        .playback-toolbar {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }
        .toggle-pill {
          display: flex;
          align-items: center;
          gap: 7px;
          background: var(--bg-elev-2);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-family: "Space Mono", monospace;
          cursor: pointer;
        }
        .toggle-pill:hover {
          border-color: var(--accent);
        }
        .toggle-pill.on {
          color: var(--accent);
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .toggle-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #55505a;
        }
        .toggle-pill.on .toggle-dot {
          background: var(--accent);
        }
        .repeat-icon {
          font-size: 12px;
          line-height: 1;
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
          border: 1px solid transparent;
          transition: opacity 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .track-row.active {
          outline: 1px solid var(--accent);
        }
        .track-row.dragging {
          opacity: 0.35;
        }
        .track-row.drag-over {
          border-color: var(--accent);
          border-style: dashed;
          transform: translateY(-1px);
        }
        .drag-handle {
          flex-shrink: 0;
          width: 16px;
          text-align: center;
          font-size: 12px;
          letter-spacing: -2px;
          color: var(--text-muted);
          cursor: grab;
          user-select: none;
        }
        .drag-handle:active {
          cursor: grabbing;
        }
        .track-row:hover .drag-handle {
          color: var(--accent);
        }
        .track-num {
          font-family: "Space Mono", monospace;
          font-size: 12px;
          color: var(--accent);
          width: 22px;
          flex-shrink: 0;
          text-align: center;
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
        .track-thumb-wrap {
          position: relative;
          flex-shrink: 0;
          width: 42px;
          height: 42px;
        }
        .track-thumb {
          width: 42px;
          height: 42px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .art-loading {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 0 2px var(--bg-elev-2);
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.75);
          }
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
        .playing-indicator {
          position: absolute;
          inset: 0;
          background: rgba(18, 16, 20, 0.55);
          border-radius: 6px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 2px;
          padding-bottom: 6px;
        }
        .playing-indicator i {
          width: 2px;
          background: var(--accent);
          border-radius: 1px;
          animation: eq 0.9s ease-in-out infinite;
        }
        .playing-indicator i:nth-child(1) {
          height: 40%;
          animation-delay: 0s;
        }
        .playing-indicator i:nth-child(2) {
          height: 90%;
          animation-delay: 0.2s;
        }
        .playing-indicator i:nth-child(3) {
          height: 60%;
          animation-delay: 0.4s;
        }
        @keyframes eq {
          0%, 100% {
            transform: scaleY(0.4);
          }
          50% {
            transform: scaleY(1);
          }
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
          position: relative;
        }
        .player-frame :global(iframe) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .yt-player-target {
          position: absolute;
          inset: 0;
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

// 유튜브 제목에서 노이즈(공식영상/가사 표기 등)를 제거
function stripNoise(str) {
  return str
    .replace(
      /official\s*(music\s*)?video|official\s*audio|lyrics?\s*video|lyrics?|m\/?v|hd|4k|visualizer|audio\s*only/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

// "Christopher - Orbit" 같은 "아티스트 - 곡명" 포맷을 인식해서 분리.
// 구분자가 없으면 채널명을 아티스트로, 제목 전체를 곡명으로 취급.
function parseArtistAndSong(rawTitle, channel) {
  const cleaned = stripNoise(rawTitle.replace(/\(.*?\)/g, " ").replace(/\[.*?\]/g, " "));
  const parts = cleaned.split(/\s[-–—]\s/); // " - " / " – " / " — " 기준 분리

  if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
    return { artist: parts[0].trim(), song: parts.slice(1).join(" - ").trim() };
  }
  return { artist: channel.replace(/\s*-\s*Topic$/i, "").trim(), song: cleaned };
}

// iTunes Search API(무료, 키 불필요)로 앨범 아트 URL을 찾는다.
// 1차: "아티스트 + 곡명"으로 검색 → 실패 시 2차: 채널명 + 곡명으로 재시도.
// 둘 다 실패하면 null을 반환해 유튜브 썸네일로 폴백한다.
async function fetchAlbumArt(rawTitle, channel) {
  const { artist, song } = parseArtistAndSong(rawTitle, channel);

  const tryQuery = async (term) => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        term
      )}&media=music&entity=song&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const hit = data.results?.[0];
      if (!hit?.artworkUrl100) return null;
      return hit.artworkUrl100.replace("100x100bb", "600x600bb");
    } catch (err) {
      return null;
    }
  };

  const primary = await tryQuery(`${artist} ${song}`.trim());
  if (primary) return primary;

  // 파싱된 아티스트가 채널명과 다르면, 채널명 기준으로 한 번 더 시도
  const channelClean = channel.replace(/\s*-\s*Topic$/i, "").trim();
  if (channelClean && channelClean.toLowerCase() !== artist.toLowerCase()) {
    const fallback = await tryQuery(`${channelClean} ${song}`.trim());
    if (fallback) return fallback;
  }

  return null;
}

// 검색어 정규화 (대소문자/공백 차이로 캐시가 갈리지 않도록)
function normalizeQuery(q) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

// 검색 결과 캐시(localStorage) 불러오기 — 실패 시 빈 객체로 폴백
function loadSearchCache() {
  try {
    return JSON.parse(window.localStorage.getItem(SEARCH_CACHE_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

// 검색 결과 캐시 저장. 항목이 너무 많아지면 최신 것만 남기고 정리(용량 관리)
function saveSearchCache(cache) {
  try {
    const entries = Object.entries(cache);
    let trimmed = cache;
    if (entries.length > SEARCH_CACHE_MAX_ENTRIES) {
      trimmed = Object.fromEntries(
        entries
          .sort((a, b) => b[1].timestamp - a[1].timestamp)
          .slice(0, SEARCH_CACHE_MAX_ENTRIES)
      );
    }
    window.localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // 저장 공간 초과 등은 조용히 무시 (캐시는 있으면 좋은 최적화일 뿐, 필수 아님)
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// 오늘 실제로 호출한 search.list 횟수 불러오기
function loadUsageCount() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(USAGE_KEY) || "{}");
    return raw[todayKey()] || 0;
  } catch (e) {
    return 0;
  }
}

// 실제 API 호출이 성공했을 때만 호출 — 오늘 날짜 기준으로 카운트 증가
function bumpUsageCount() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(USAGE_KEY) || "{}");
    const key = todayKey();
    const next = (raw[key] || 0) + 1;
    // 지난 날짜 기록은 필요 없으니 오늘 것만 유지
    window.localStorage.setItem(USAGE_KEY, JSON.stringify({ [key]: next }));
    return next;
  } catch (e) {
    return 0;
  }
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
