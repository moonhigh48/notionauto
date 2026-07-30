'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';

interface Track {
  youtubeId: string;
  title: string;
  artist: string;
  coverUrl: string;
}

export default function PlaylistPage() {
  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // 플레이리스트 관련 상태 (최대 6곡)
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Ref 참조
  const cardRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  // 1. YouTube IFrame API 로드
  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player('yt-player', {
        height: '0',
        width: '0',
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onStateChange: (event: any) => {
            // 곡이 끝나면(State 0) 다음 곡 자동 재생
            if (event.data === 0) {
              handleNext();
            }
          },
        },
      });
    };
  }, []);

  // 2. 노래 검색 함수 (API Route 호출)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (error) {
      console.error('검색 실패:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 3. 곡 플레이리스트에 추가 (최대 6곡)
  const addTrack = (track: Track) => {
    if (selectedTracks.length >= 6) {
      alert('플레이리스트에는 최대 6곡까지만 담을 수 있습니다.');
      return;
    }
    // 중복 체크
    if (selectedTracks.some((t) => t.youtubeId === track.youtubeId)) {
      alert('이미 추가된 곡입니다.');
      return;
    }
    setSelectedTracks([...selectedTracks, track]);
  };

  // 4. 곡 삭제
  const removeTrack = (index: number) => {
    const newTracks = selectedTracks.filter((_, i) => i !== index);
    setSelectedTracks(newTracks);
    if (currentTrackIndex >= newTracks.length && newTracks.length > 0) {
      setCurrentTrackIndex(newTracks.length - 1);
    }
  };

  // 5. 음원 재생 컨트롤
  const playTrack = (index: number) => {
    if (selectedTracks.length === 0) return;
    setCurrentTrackIndex(index);
    if (playerRef.current) {
      playerRef.current.loadVideoById(selectedTracks[index].youtubeId);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!playerRef.current || selectedTracks.length === 0) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (selectedTracks.length === 0) return;
    setSelectedTracks((prev) => {
      const nextIndex = (currentTrackIndex + 1) % prev.length;
      playTrack(nextIndex);
      return prev;
    });
  };

  // 6. 이미지 저장 기능
  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    if (selectedTracks.length === 0) {
      alert('저장할 곡을 최소 1개 이상 추가해주세요.');
      return;
    }
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = 'my-playlist.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('이미지 저장 실패:', err);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 bg-neutral-950 text-white min-h-screen">
      <h1 className="text-2xl font-bold text-center">🎵 My Playlist Builder</h1>

      {/* 1. 유튜브 검색 영역 */}
      <section className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="노래 제목이나 아티스트 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {isSearching ? '검색 중...' : '검색'}
          </button>
        </form>

        {/* 검색 결과 목록 */}
        {searchResults.length > 0 && (
          <div className="bg-neutral-900 p-4 rounded-xl space-y-2 border border-neutral-800 max-h-60 overflow-y-auto">
            <p className="text-xs text-neutral-400 mb-2">검색 결과 (클릭 시 추가)</p>
            {searchResults.map((track) => (
              <div
                key={track.youtubeId}
                className="flex items-center justify-between p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded object-cover" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{track.title}</p>
                    <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                  </div>
                </div>
                <button
                  onClick={() => addTrack(track)}
                  className="ml-2 px-3 py-1 text-xs bg-white text-black font-bold rounded hover:bg-neutral-200 shrink-0"
                >
                  + 추가
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. 플레이리스트 이미지 카드 영역 (2x3 Grid) */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-400">담긴 곡 ({selectedTracks.length}/6)</span>
        </div>

        <div
          ref={cardRef}
          className="bg-neutral-900 text-white p-6 rounded-2xl shadow-2xl space-y-4 border border-neutral-800"
        >
          <h2 className="text-xl font-bold tracking-tight text-emerald-400">MY TOP 6 PLAYLIST</h2>

          {selectedTracks.length === 0 ? (
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-xl text-neutral-500 text-sm">
              위에서 노래를 검색해 6곡을 채워보세요.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {selectedTracks.map((track, idx) => (
                <div
                  key={idx}
                  onClick={() => playTrack(idx)}
                  className={`group relative flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer transition ${
                    currentTrackIndex === idx ? 'bg-neutral-700 border border-emerald-500/50' : 'bg-neutral-800 hover:bg-neutral-750'
                  }`}
                >
                  <img src={track.coverUrl} alt={track.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <div className="overflow-hidden pr-6">
                    <p className="text-sm font-semibold truncate">{track.title}</p>
                    <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(idx);
                    }}
                    className="absolute top-2 right-2 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs font-bold p-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. 재생 컨트롤러 & 이미지 저장 버튼 */}
      <section className="space-y-3">
        {selectedTracks.length > 0 && (
          <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 text-white p-4 rounded-xl">
            <div className="overflow-hidden pr-4">
              <p className="text-xs text-emerald-400 font-semibold">NOW PLAYING</p>
              <p className="text-sm font-bold truncate">{selectedTracks[currentTrackIndex]?.title || '선택된 곡 없음'}</p>
            </div>
            <button
              onClick={togglePlay}
              className="px-5 py-2 bg-emerald-500 text-black rounded-lg font-bold hover:bg-emerald-400 transition shrink-0"
            >
              {isPlaying ? '일시정지' : '재생'}
            </button>
          </div>
        )}

        <button
          onClick={handleDownloadImage}
          className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition shadow-lg"
        >
          플레이리스트 이미지로 저장하기
        </button>
      </section>

      {/* 숨겨진 YouTube Player */}
      <div id="yt-player" className="hidden" />
    </div>
  );
}