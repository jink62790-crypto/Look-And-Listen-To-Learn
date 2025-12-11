import React, { useEffect, useRef, useState } from 'react';
import { TranscriptionSegment, WordDefinition, PronunciationScore } from '../types';
import { getWordDefinition, generateSpeech, scorePronunciation } from '../services/geminiService';
import { playPcmData, AudioRecorder } from '../services/audioUtils';

interface TranscriptViewProps {
  segments: TranscriptionSegment[];
  currentTime: number;
  onSegmentClick: (time: number) => void;
  meta?: { wordCount: number, speed: string, estimatedLevel: string };
  onToggleFavorite?: (segment: TranscriptionSegment) => void;
}

// Subcomponent for Blurred Translation
const BlurredTranslation = ({ text }: { text: string }) => {
  const [isBlurred, setIsBlurred] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
    }
    setIsBlurred(false);
    timeoutRef.current = setTimeout(() => {
        setIsBlurred(true);
    }, 5000);
  };
  
  useEffect(() => {
      return () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
  }, []);

  return (
    <p 
      onClick={handleClick}
      className={`text-sm text-slate-500 leading-relaxed pl-1 border-l-2 border-slate-200 transition-all duration-700 cursor-pointer select-none ${isBlurred ? 'blur-[6px] hover:blur-[3px]' : 'blur-0'}`}
      title="Click to reveal translation"
    >
      {text}
    </p>
  );
};

export const TranscriptView: React.FC<TranscriptViewProps> = ({ segments, currentTime, onSegmentClick, meta, onToggleFavorite }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  
  // Word Definition State
  const [definition, setDefinition] = useState<WordDefinition | null>(null);

  // Audio Playback State (Caching)
  const [audioCache, setAudioCache] = useState<Record<string, string>>({}); // text -> base64
  const [loadingIdiomText, setLoadingIdiomText] = useState<string | null>(null);
  const [playingIdiomText, setPlayingIdiomText] = useState<string | null>(null);
  
  // Shadowing/Scoring State for Idioms
  const [recorder] = useState(() => new AudioRecorder());
  const [recordingIdiomText, setRecordingIdiomText] = useState<string | null>(null);
  const [scoringIdiomText, setScoringIdiomText] = useState<string | null>(null);
  const [idiomScores, setIdiomScores] = useState<Record<string, PronunciationScore>>({});
  
  // User Recordings (Blob URLs) for playback
  const [userRecordings, setUserRecordings] = useState<Record<string, string>>({});

  // Removed aggressive pre-fetching useEffect to prevent 429 Resource Exhausted errors.
  // Audio will be fetched on-demand when the user clicks "Listen".

  // Auto-scroll logic
  useEffect(() => {
    // Only auto-scroll if we have active highlight and it's likely a sequence play
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime, segments]);

  const handleWordClick = async (e: React.MouseEvent, word: string, segmentText: string) => {
    e.stopPropagation();
    const cleanWord = word.replace(/[^\w']/g, "");
    if (!cleanWord) return;
    try {
      const def = await getWordDefinition(cleanWord, segmentText);
      setDefinition(def);
    } catch (err) { console.error(err); }
  };

  const handlePlayIdiom = async (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (loadingIdiomText) return;
    try {
      setPlayingIdiomText(text);
      let audioData = audioCache[text];
      if (!audioData) {
          setLoadingIdiomText(text);
          audioData = await generateSpeech(text);
          setAudioCache(prev => ({...prev, [text]: audioData}));
          setLoadingIdiomText(null);
      }
      await playPcmData(audioData);
    } catch (e) {
      console.error(e);
      setLoadingIdiomText(null);
    } finally {
      setPlayingIdiomText(null);
    }
  };

  const handleToggleRecordIdiom = async (e: React.MouseEvent, text: string) => {
    e.stopPropagation();

    if (recordingIdiomText === text) {
        // Stop Recording
        setRecordingIdiomText(null);
        setScoringIdiomText(text);
        try {
            const blob = await recorder.stop();
            
            // Save recording URL for playback
            const url = URL.createObjectURL(blob);
            setUserRecordings(prev => ({...prev, [text]: url}));

            const result = await scorePronunciation(blob, text);
            setIdiomScores(prev => ({...prev, [text]: result}));
        } catch (e) {
            console.error(e);
        } finally {
            setScoringIdiomText(null);
        }
        return;
    }

    if (recordingIdiomText) return; // Busy

    // Start Recording
    try {
        await recorder.start();
        setRecordingIdiomText(text);
        setIdiomScores(prev => {
            const next = {...prev};
            delete next[text];
            return next;
        });
    } catch (e) {
        console.error(e);
    }
  };

  const handlePlayUserRecording = (e: React.MouseEvent, text: string) => {
      e.stopPropagation();
      const url = userRecordings[text];
      if (url) {
          const audio = new Audio(url);
          audio.play().catch(e => console.error("Playback failed", e));
      }
  };

  return (
    <div className="relative h-full flex flex-col bg-slate-50">
      {/* Meta Header */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 sticky top-0 z-10 shadow-sm">
        <div className="flex gap-4">
            <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                {meta?.wordCount || 0} words
            </span>
            <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {meta?.speed || '120 wpm'}
            </span>
        </div>
        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
            {meta?.estimatedLevel || 'B2'}
        </span>
      </div>

      {/* Content List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-40 no-scrollbar">
        {/* Placeholder Image */}
        <div className="w-full h-40 bg-slate-200 rounded-xl overflow-hidden mb-6 flex items-center justify-center text-slate-400">
             <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>

        {segments.map((segment, index) => {
          const isActive = currentTime >= segment.start && currentTime < segment.end;
          
          return (
            <div
              key={index}
              ref={isActive ? activeRef : null}
              className={`transition-all duration-300 rounded-xl p-4 cursor-pointer border relative group ${
                isActive 
                  ? 'bg-white border-blue-200 shadow-md ring-1 ring-blue-100' 
                  : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm'
              }`}
              onClick={() => onSegmentClick(segment.start)}
            >
              {/* Bookmark Icon */}
              {onToggleFavorite && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(segment); }}
                    className={`absolute top-4 right-4 p-1 rounded-full transition-colors ${segment.isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-slate-200 hover:text-slate-400'}`}
                  >
                      <svg className="w-5 h-5" fill={segment.isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  </button>
              )}

              {/* Original Text - Added whitespace-pre-wrap and break-words for better wrapping */}
              <p className={`text-base break-words whitespace-pre-wrap leading-relaxed mb-4 pr-8 ${isActive ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                {segment.text.split(' ').map((word, wIndex) => (
                  <span 
                    key={wIndex}
                    className="hover:text-blue-600 hover:underline decoration-blue-300 decoration-2 cursor-pointer mx-0.5"
                    onClick={(e) => handleWordClick(e, word, segment.text)}
                  >
                    {word}
                  </span>
                ))}
              </p>

              {/* Idiomatic Expression */}
              {segment.idiomatic && (
                  <div className="mb-4 bg-blue-50 rounded-lg p-3 border-l-4 border-blue-400 shadow-sm overflow-hidden">
                    <div className="mb-3">
                        <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider mb-1 flex items-center gap-1">
                            <span>🇺🇸 American Native</span>
                        </div>
                        <p className="text-base text-blue-900 font-medium italic leading-relaxed break-words whitespace-pre-wrap">"{segment.idiomatic}"</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100/50">
                        {/* Play Button */}
                        <button 
                            onClick={(e) => handlePlayIdiom(e, segment.idiomatic)}
                            disabled={loadingIdiomText === segment.idiomatic}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                                playingIdiomText === segment.idiomatic 
                                ? 'bg-blue-200 text-blue-800 ring-2 ring-blue-300' 
                                : 'bg-white text-blue-600 hover:bg-blue-100 hover:shadow-md'
                            }`}
                        >
                             {loadingIdiomText === segment.idiomatic ? (
                                 <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                             ) : (
                                 <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                             )}
                             <span>Listen</span>
                        </button>

                        {/* Record/Shadow Button */}
                        <button 
                            onClick={(e) => handleToggleRecordIdiom(e, segment.idiomatic)}
                            disabled={!!scoringIdiomText}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                                recordingIdiomText === segment.idiomatic 
                                ? 'bg-red-500 text-white animate-pulse ring-2 ring-red-300' 
                                : 'bg-white text-slate-500 hover:text-blue-600 hover:bg-slate-50 hover:shadow-md'
                            }`}
                        >
                             {recordingIdiomText === segment.idiomatic ? (
                                <div className="w-2 h-2 rounded bg-white"></div>
                             ) : (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 3.01-2.45 5.5-5.5 5.5S6 14.01 6 11H4c0 3.53 2.61 6.43 6 6.92V21h4v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                             )}
                             <span>{recordingIdiomText === segment.idiomatic ? 'Stop' : 'Shadow'}</span>
                        </button>
                        
                        {/* Play My Record Button (Appears if recording exists and not currently recording) */}
                        {userRecordings[segment.idiomatic] && !recordingIdiomText && !scoringIdiomText && (
                            <button
                                onClick={(e) => handlePlayUserRecording(e, segment.idiomatic)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-500 hover:text-green-600 hover:bg-slate-50 hover:shadow-md transition-all shadow-sm"
                                title="Play my recording"
                            >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                <span>My Rec</span>
                            </button>
                        )}

                        {scoringIdiomText === segment.idiomatic && (
                             <span className="text-xs font-medium text-slate-400 animate-pulse ml-1">Scoring...</span>
                        )}

                        {idiomScores[segment.idiomatic] && !recordingIdiomText && !scoringIdiomText && (
                            <div className={`ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border animate-fade-in-up ${
                                idiomScores[segment.idiomatic].score >= 80 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                                <span className="text-lg leading-none">{idiomScores[segment.idiomatic].score}</span>
                                <span className="text-[9px] uppercase opacity-75 leading-none mt-0.5">{idiomScores[segment.idiomatic].accuracy}</span>
                            </div>
                        )}
                    </div>
                  </div>
              )}

              <BlurredTranslation text={segment.translation} />
            </div>
          );
        })}
      </div>

      {definition && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={() => setDefinition(null)}></div>
          <div className="bg-white w-full sm:w-96 p-6 rounded-t-2xl sm:rounded-2xl shadow-2xl relative pointer-events-auto animate-fade-in-up">
            <h4 className="text-2xl font-bold text-slate-800 capitalize mb-1">{definition.word}</h4>
            {definition.phonetic && <span className="text-slate-400 font-mono text-sm block mb-4">{definition.phonetic}</span>}
            <div className="space-y-4">
                <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Definition</span>
                    <p className="text-slate-700 mt-1">{definition.definition}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Example</span>
                    <p className="text-slate-600 italic mt-1">"{definition.example}"</p>
                </div>
            </div>
            <button onClick={() => setDefinition(null)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};