'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';

interface Track {
  title: string;
  artist: string;
  coverUrl: string;
  youtubeId: string;
}

const initialTracks: Track[] = [
  { title: "Song 1", artist: "Artist 1", coverUrl: "https://via.placeholder.com/150", youtubeId: "dQw4w9WgXcQ" },
  { title: "Song 2", artist: "Artist 2", coverUrl: "https://via.placeholder.com/150", youtubeId: "3JZ_D3ELwOQ" },
  { title: "Song 3", artist: "Artist 3", coverUrl: "https://via.placeholder.com/150", youtubeId: "L_jWHffIx5E" },
  { title: "Song 4", artist: "Artist 4", coverUrl: "https://via.placeholder.com/150", youtubeId: "kJQP7kiw5Fk" },
  { title: "Song 5", artist: "Artist 5", coverUrl: "https://via.placeholder.com/150", youtubeId: "fJ9rUzIMcZQ" },
  { title: "Song 6", artist: "Artist 6", coverUrl: "https://via.placeholder.com/150", youtubeId: "OPf0YbXqDm0" },
];

export default function PlaylistPage() {
  const [tracks] = useState<Track[]>(initialTracks);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player('yt-player', {
        height: '0',
        width: '0',
        videoId: tracks[0].youtubeId,
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onStateChange: (event: any) => {
            if (event.data === 0) {
              handleNext();
            }
          },
        },
      });
    };
  }, []);

  const playTrack = (index: number) => {
    setCurrentTrackIndex(index);
    if (playerRef.current) {
      playerRef.current.loadVideoById(tracks[index].youtubeId);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current, { cacheBust: true });
    const link = document.createElement('a');
    link.download = 'my-playlist.png';
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div 
        ref={cardRef} 
        className="bg-neutral-900 text-white p-6 rounded-2xl shadow-xl space-y-4"
      >
        <h2 className="text-xl font-bold">MY 6 TRACKS</h2>
        <div className="grid grid-cols-2 gap-4">
          {tracks.map((track, idx) => (
            <div 
              key={idx} 
              onClick={() => playTrack(idx)}
              className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition ${
                currentTrackIndex === idx ? 'bg-neutral-700' : 'bg-neutral-800 hover:bg-neutral-750'
              }`}
            >
              <img src={track.coverUrl} alt={track.title} className="w-12 h-12 rounded-md object-cover" />
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate">{track.title}</p>
                <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between bg-neutral-800 text-white p-4 rounded-xl">
        <div>
          <p className="text-xs text-neutral-400">현재 재생 중</p>
          <p className="text-sm font-bold">{tracks[currentTrackIndex].title}</p>
        </div>
        <button 
          onClick={togglePlay}
          className="px-4 py-2 bg-emerald-500 rounded-lg font-bold hover:bg-emerald-600 transition"
        >
          {isPlaying ? '일시정지' : '재생'}
        </button>
      </div>

      <button 
        onClick={handleDownloadImage}
        className="w-full py-2 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition"
      >
        이미지로 저장하기
      </button>

      <div id="yt-player" className="hidden" />
    </div>
  );
}