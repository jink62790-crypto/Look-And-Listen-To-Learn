import React, { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  audioUrl: string | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onEnterShadowing: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioUrl, 
  currentTime, 
  onTimeUpdate,
  onDurationChange,
  onEnterShadowing
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      onTimeUpdate(audioRef.current.currentTime);
    }
  };

  const changeSpeed = () => {
    const rates = [0.75, 1, 1.25, 1.5];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="bg-white border-t border-slate-200 px-4 pt-2 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-2xl z-20">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              if (onDurationChange) onDurationChange(e.currentTarget.duration);
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      
      {/* Function Bar */}
      <div className="flex items-center justify-between mb-4 px-2 pt-2">
         <button onClick={changeSpeed} className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200">
            <span>{playbackRate}x</span>
         </button>
         
         <div className="flex items-center gap-3">
            <button className="text-xs font-semibold text-slate-400 hover:text-blue-600 px-2">
                Seq Play
            </button>
            <button onClick={onEnterShadowing} className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-full shadow-md hover:bg-blue-700 active:scale-95 transition">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                Shadow
            </button>
         </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mb-3">
        <span>{formatTime(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => {
            const time = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            onTimeUpdate(time);
          }}
          className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
          disabled={!audioUrl}
        />
        <span>{formatTime(duration)}</span>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-10">
         <button 
           onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 5; }}
           className="text-slate-400 hover:text-slate-800"
         >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
         </button>

         <button 
            onClick={togglePlay}
            className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
         >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
            ) : (
              <svg className="w-6 h-6 pl-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
         </button>

         <button 
            onClick={() => { if(audioRef.current) audioRef.current.currentTime += 5; }}
            className="text-slate-400 hover:text-slate-800"
         >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
         </button>
      </div>
    </div>
  );
};