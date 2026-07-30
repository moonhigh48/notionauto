'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';

interface Track {
  youtubeId: string;
  title: string;
  artist: string;
  coverUrl: string;
}

// 아이콘 컴포넌트 (간단 구현)
const PlayIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const NextIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>;
const PrevIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>;
const DownloadIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black mr-2"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-neutral-400"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;

export default function PlaylistPage() {
  // 상태 관리
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);

  // Ref 참조
  const cardRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // 1. YouTube IFrame API 로드 (한 번만 실행)
  useEffect(() => {
    if ((window as any).YT) {
      setIsApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      setIsApiReady(true);
    };
  }, []);

  // 2. 플레이어 초기화
  useEffect(() => {
    if (!isApiReady || playerRef.current || selectedTracks.length === 0) return;

    playerRef.current = new (window as any).YT.Player('yt-player', {
      height: '0',
      width: '0',
      videoId: selectedTracks[0].youtubeId,
      playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onStateChange: (event: any) => {
          if (event.data === (window as any).YT.PlayerState.ENDED) {
            handleNext();
          } else if (event.data === (window as any).YT.PlayerState.PLAYING) {
            setIsPlaying(true);
          } else if (event.data === (window as any).YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          }
        },
        onError: () => {
          console.error("유튜브 플레이어 오류 발생");
          handleNext(); // 오류 시 다음 곡으로 건너뜀
        }
      },
    });
  }, [isApiReady, selectedTracks]);


  // 3. 노래 검색 함수 (API Route 호출)
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (error) {
      console.error('검색 실패:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 4. 곡 플레이리스트에 추가
  const addTrack = (track: Track) => {
    if (selectedTracks.length >= 6) {
      alert('최대 6곡까지만 담을 수 있습니다.');
      return;
    }
    if (selectedTracks.some((t) => t.youtubeId === track.youtubeId)) {
      alert('이미 추가된 곡입니다.');
      return;
    }
    setSelectedTracks(prev => [...prev, track]);
    setSearchResults([]); // 추가 후 검색 결과 닫기
    setSearchQuery('');
  };

  // 5. 곡 삭제
  const removeTrack = (index: number) => {
    const newTracks = selectedTracks.filter((_, i) => i !== index);
    setSelectedTracks(newTracks);
    
    // 현재 재생 중인 곡이 삭제되거나 리스트가 좁아질 때 인덱스 조정
    if (index === currentTrackIndex) {
      if (newTracks.length > 0) {
        const nextIdx = index % newTracks.length;
        // 약간의 지연을 주어 플레이어가 상태 업데이트를 인식하게 함
        setTimeout(() => playTrack(nextIdx, false), 50);
      } else {
        // 모든 곡 삭제 시
        if (playerRef.current) playerRef.current.stopVideo();
        setIsPlaying(false);
        setCurrentTrackIndex(0);
      }
    } else if (index < currentTrackIndex) {
      setCurrentTrackIndex(prev => prev - 1);
    }
  };

  // 6. 음원 재생 컨트롤
  const playTrack = useCallback((index: number, shouldPlay: boolean = true) => {
    if (!selectedTracks[index] || !playerRef.current) return;
    
    setCurrentTrackIndex(index);
    try {
      if (shouldPlay) {
        playerRef.current.loadVideoById(selectedTracks[index].youtubeId);
        // loadVideoById는 자동으로 재생을 시작하므로 setIsPlaying(true)는 이벤트 리스너에서 처리됨
      } else {
        playerRef.current.cueVideoById(selectedTracks[index].youtubeId);
        setIsPlaying(false);
      }
    } catch (e) {
      console.error("재생 오류:", e);
    }
  }, [selectedTracks]);

  const togglePlay = () => {
    if (!playerRef.current || selectedTracks.length === 0) return;
    try {
      const state = playerRef.current.getPlayerState();
      if (state === (window as any).YT.PlayerState.PLAYING) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {
      // 플레이어가 아직 준비 안 됐거나 로드 안 된 경우
      playTrack(currentTrackIndex);
    }
  };

  const handleNext = useCallback(() => {
    if (selectedTracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % selectedTracks.length;
    playTrack(nextIndex);
  }, [currentTrackIndex, selectedTracks, playTrack]);

  const handlePrev = () => {
    if (selectedTracks.length === 0) return;
    // 인덱스가 음수가 되지 않도록 처리
    const prevIndex = (currentTrackIndex - 1 + selectedTracks.length) % selectedTracks.length;
    playTrack(prevIndex);
  };

  // 7. 이미지 저장 기능
  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    if (selectedTracks.length === 0) {
      alert('곡을 최소 1개 이상 추가해주세요.');
      return;
    }
    
    // 저장 중 아이콘 표시 등 로딩 상태 구현 가능
    const btn = document.getElementById('download-btn');
    if(btn) btn.innerText = "저장 중...";

    try {
      // 고화질 저장을 위해 scale 옵션 추가
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true,
        style: {
          borderRadius: '0' // 저장할 때는 둥근 모서리 해제 (선택사항)
        }
      });
      const link = document.createElement('a');
      link.download = 'my-aesthetic-playlist.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('이미지 저장 실패:', err);
      alert('이미지 생성에 실패했습니다.');
    } finally {
      if(btn) btn.innerHTML = `<svg viewBox="0 0 24 24" class="w-5 h-5 fill-black mr-2"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg> 이미지로 저장하기`;
    }
  };

  // 현재 재생 중인 곡 정보
  const currentTrack = selectedTracks[currentTrackIndex];

  return (
    <div className="p-6 md:p-10 pb-36 max-w-7xl mx-auto space-y-10 bg-[#090909] text-white min-h-screen font-sans relative overflow-x-hidden">
      
      {/* 백그라운드 그라데이션 광원 효과 */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-950 rounded-full blur-[160px] opacity-40 pointer-events-none"></div>
      <div className="absolute top-1/4 -right-40 w-80 h-80 bg-emerald-900 rounded-full blur-[140px] opacity-30 pointer-events-none"></div>

      {/* 헤더 */}
      <header className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-black"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-white">WaveMix <span className="text-xs text-emerald-500 font-medium ml-1">Studio</span></h1>
        </div>
        <button
          id="download-btn"
          onClick={handleDownloadImage}
          className="px-5 py-2.5 bg-emerald-500 text-black rounded-full font-bold hover:bg-emerald-400 transition-all text-sm shadow-lg shadow-emerald-500/20 flex items-center hover:scale-105 active:scale-95"
        >
          <DownloadIcon />
          이미지로 저장하기
        </button>
      </header>

      <div className="grid md:grid-cols-[1fr,2fr] gap-10 relative z-10">
        
        {/* 왼쪽: 검색 및 편집 섹션 */}
        <section className="space-y-8 bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800/50 backdrop-blur-sm">
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
              노래 검색 및 추가
            </h3>
            <p className="text-sm text-neutral-400">유튜브에서 곡을 검색해 최대 6곡을 플레이리스트에 담아보세요.</p>
          </div>

          {/* 검색창 UI */}
          <div className="relative">
            <form onSubmit={handleSearch} className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="제목, 아티스트, 키워드 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // 실시간 검색 기능 구현 가능 (debounce 필요)
                }}
                className="w-full pl-12 pr-28 py-3.5 rounded-full bg-neutral-800 text-white border border-neutral-700/50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-full font-semibold transition disabled:opacity-50 text-sm"
              >
                {isSearching ? '...' : '검색'}
              </button>
            </form>

            {/* 검색 결과 드롭다운 UI */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-3 bg-neutral-800 rounded-2xl space-y-1.5 border border-neutral-700 shadow-2xl z-20 max-h-80 overflow-y-auto p-3 p-y-2 backdrop-blur-lg">
                {searchResults.map((track) => (
                  <div
                    key={track.youtubeId}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-700/60 transition group cursor-pointer"
                    onClick={() => addTrack(track)}
                  >
                    <div className="flex items-center space-x-3.5 overflow-hidden">
                      <img src={track.coverUrl} alt={track.title} className="w-11 h-11 rounded-lg object-cover shrink-0 shadow" />
                      <div className="overflow-hidden space-y-0.5">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-400">{track.title}</p>
                        <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                      </div>
                    </div>
                    <div className="ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-700 group-hover:bg-emerald-500/20 shrink-0 transition">
                       <svg viewBox="0 0 24 24" className="w-5 h-5 fill-neutral-400 group-hover:fill-emerald-500"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && !isSearching && (
                 <div className="absolute top-full left-0 w-full mt-3 bg-neutral-800 rounded-2xl p-4 border border-neutral-700 text-center text-sm text-neutral-500 z-20">검색 결과가 없습니다.</div>
            )}
          </div>

          {/* 담긴 곡 목록 편집 UI */}
          <div className="space-y-4 pt-4 border-t border-neutral-800">
             <div className="flex justify-between items-center">
                 <h4 className="text-sm font-semibold text-neutral-300">현재 에디팅 리스트 ({selectedTracks.length}/6)</h4>
                 {selectedTracks.length > 0 && (
                     <button onClick={() => setSelectedTracks([])} className="text-xs text-neutral-500 hover:text-red-400">전체 삭제</button>
                 )}
             </div>
             
             {selectedTracks.length === 0 ? (
                 <div className="py-10 flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 rounded-2xl text-neutral-600 space-y-2">
                     <SearchIcon />
                     <p className="text-sm">검색하여 곡을 추가해주세요.</p>
                 </div>
             ) : (
                <div className="space-y-2.5">
                    {selectedTracks.map((track, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-2.5 rounded-xl transition ${currentTrackIndex === idx ? 'bg-emerald-950/40 border border-emerald-800/50' : 'bg-neutral-800/40 border border-transparent'}`}>
                             <div className="flex items-center space-x-3 overflow-hidden cursor-pointer flex-1" onClick={() => playTrack(idx)}>
                                <div className="relative w-10 h-10 shrink-0">
                                    <img src={track.coverUrl} alt={track.title} className="w-full h-full rounded-lg object-cover" />
                                    {currentTrackIndex === idx && isPlaying && (
                                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                            <div className="w-4 h-4 flex gap-0.5 items-end">
                                                <div className="w-1 bg-emerald-500 h-2 animate-pulse"></div>
                                                <div className="w-1 bg-emerald-500 h-4 animate-pulse延迟-75"></div>
                                                <div className="w-1 bg-emerald-500 h-3 animate-pulse延迟-150"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-hidden">
                                    <p className={`text-sm font-semibold truncate ${currentTrackIndex === idx ? 'text-emerald-400' : 'text-white'}`}>{track.title}</p>
                                    <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                                </div>
                            </div>
                            <button onClick={() => removeTrack(idx)} className="ml-2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-950 text-neutral-600 hover:text-red-400 transition text-lg shrink-0">✕</button>
                        </div>
                    ))}
                </div>
             )}
          </div>
        </section>

        {/* 오른쪽: 플레이리스트 카드 미리보기 (저장 대상) */}
        <section className="space-y-6">
          <div className="space-y-1">
             <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
                포스터 미리보기
             </h3>
             <p className="text-sm text-neutral-400">저장될 이미지의 모습입니다. 아래 6곡 그리드를 클릭해 재생할 수 있습니다.</p>
          </div>

          {/* 2x3 Grid Poster 카드 UI (html-to-image 대상) */}
          <div className="p-2 bg-neutral-900 rounded-[32px] border border-neutral-800 shadow-inner">
            <div
              ref={cardRef}
              className="bg-[#0b0b0b] text-white p-7 md:p-9 rounded-[28px] space-y-7 border border-neutral-800/50 aspect-[3/4] flex flex-col relative overflow-hidden"
            >
               {/* 카드 배경 그라데이션 효과 */}
               <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-950 rounded-full blur-[100px] opacity-40 pointer-events-none"></div>

              <div className="flex items-center justify-between relative z-10">
                 <div className="space-y-1">
                    <p className="text-xs font-medium text-emerald-500 tracking-wider">AESTHETIC VIBES</p>
                    <h2 className="text-3xl font-extrabold tracking-tighter text-white leading-none">MY TOP 6<br/>TRACKS</h2>
                 </div>
                 <div className="w-12 h-12 bg-neutral-800/80 rounded-2xl border border-neutral-700/50 flex items-center justify-center backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-emerald-500"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                 </div>
              </div>

              {selectedTracks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 rounded-2xl text-neutral-600 text-center p-6 space-y-3">
                  <svg viewBox="0 0 24 24" className="w-12 h-12 fill-neutral-800"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                  <p className="text-sm font-medium">왼쪽에서 노래를 검색해<br/>6곡을 채워 포스터를 완성하세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:gap-5 flex-1 relative z-10">
                  {/* 항상 6개의 슬롯을 보여주기 위한 처리 */}
                  {[...Array(6)].map((_, idx) => {
                    const track = selectedTracks[idx];
                    if (track) {
                      return (
                        <div
                          key={idx}
                          onClick={() => playTrack(idx)}
                          className={`group relative flex flex-col gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${
                            currentTrackIndex === idx ? 'bg-neutral-800/80 border-emerald-500 shadow-xl shadow-emerald-500/10' : 'bg-neutral-800/40 hover:bg-neutral-800/80 border-transparent hover:border-neutral-700'
                          }`}
                        >
                          <img src={track.coverUrl} alt={track.title} className="w-full aspect-square rounded-xl object-cover shadow-lg transition-transform duration-300 group-hover:scale-[1.02]" />
                          <div className="overflow-hidden leading-tight space-y-0.5">
                            <p className="text-sm font-bold text-white truncate group-hover:text-emerald-400">{track.title}</p>
                            <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                          </div>
                          <div className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-emerald-400 font-bold text-xs backdrop-blur-sm border border-neutral-700/50">
                              0{idx+1}
                          </div>
                        </div>
                      );
                    } else {
                      // 빈 슬롯 UI
                      return (
                        <div key={idx} className="bg-neutral-900/40 rounded-2xl border-2 border-dashed border-neutral-800 flex flex-col gap-3 p-4 items-center justify-center text-neutral-700">
                             <div className="w-full aspect-square rounded-xl bg-neutral-800/50 flex items-center justify-center">
                                 <svg viewBox="0 0 24 24" className="w-8 h-8 fill-neutral-700"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                             </div>
                             <div className="w-full h-8 bg-neutral-800/50 rounded-lg"></div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
              
              <div className="pt-5 border-t border-neutral-800 relative z-10 flex justify-between items-center text-neutral-600 text-xs font-mono">
                  <span>CURATED BY WAVEMIX</span>
                  <span>WAVEMIX.STUDIO</span>
              </div>
            </div>
          </div>
        </section>
      </div>


      {/* 하단 고정 음악 플레이어 바 UI (실제 재생 컨트롤) */}
      {selectedTracks.length > 0 && currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#121212]/90 backdrop-blur-xl border-t border-neutral-800 p-4 pb-6 z-50 shadow-2xl animate-slide-up">
          <div className="max-w-7xl mx-auto flex items-center gap-5">
            {/* 곡 정보 */}
            <div className="flex items-center gap-3.5 w-1/3 overflow-hidden">
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-14 h-14 rounded-xl object-cover shadow-lg shrink-0" />
              <div className="overflow-hidden space-y-0.5">
                <p className="text-base font-bold text-white truncate">{currentTrack.title}</p>
                <p className="text-sm text-neutral-400 truncate">{currentTrack.artist}</p>
              </div>
            </div>

            {/* 플레이 컨트롤 */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <button onClick={handlePrev} className="p-2 rounded-full hover:bg-neutral-800 transition group active:scale-95">
                    <PrevIcon />
                </button>
                <button 
                  onClick={togglePlay}
                  className="w-12 h-12 flex items-center justify-center bg-emerald-500 rounded-full hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 active:scale-90"
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={handleNext} className="p-2 rounded-full hover:bg-neutral-800 transition group active:scale-95">
                    <NextIcon />
                </button>
              </div>
              {/* 더미 진행 바 */}
              <div className="w-full max-w-md flex items-center gap-2 text-xs text-neutral-600 font-mono">
                  <span>1:23</span>
                  <div className="flex-1 h-1 bg-neutral-700 rounded-full overflow-hidden group cursor-pointer relative">
                      <div className="absolute inset-0 bg-emerald-500 w-1/3 rounded-full group-hover:bg-emerald-400 transition-all"></div>
                      <div className="absolute left-[33%] top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"></div>
                  </div>
                  <span>3:45</span>
              </div>
            </div>

            {/* 우측 볼륨/기능 (더미) */}
            <div className="w-1/3 flex justify-end items-center gap-3 text-neutral-500">
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">FULL TRACK</span>
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current hover:text-white cursor-pointer"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            </div>
          </div>
        </div>
      )}

      {/* Tailwind 애니메이션 정의 (global.css에 추가해도 됨) */}
      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out forwards;
        }
      `}</style>

      {/* 실제 숨겨진 YouTube Player (오디오 출력용) */}
      <div id="yt-player" className="hidden" />
    </div>
  );
}