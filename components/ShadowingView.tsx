import React, { useState } from 'react';
import { TranscriptionSegment, PronunciationScore } from '../types';
import { AudioRecorder, playPcmData } from '../services/audioUtils';
import { scorePronunciation, generateSpeech } from '../services/geminiService';

interface ShadowingViewProps {
  segments: TranscriptionSegment[];
  onClose: () => void;
}

export const ShadowingView: React.FC<ShadowingViewProps> = ({ segments, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder] = useState(() => new AudioRecorder());
  const [score, setScore] = useState<PronunciationScore | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const currentSegment = segments[currentIndex];

  const handleRecordToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      const audioBlob = await recorder.stop();
      setIsProcessing(true);
      try {
        const result = await scorePronunciation(audioBlob, currentSegment.text);
        setScore(result);
      } catch (e) {
        console.error(e);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setScore(null);
      await recorder.start();
      setIsRecording(true);
    }
  };

  const playOriginal = async () => {
     // Ideally plays from main audio file reference, but for this detached view, we use TTS for simplicity
     // or we could pass a callback to play the specific range in main player.
     // Let's use TTS for the segment to ensure clean audio for shadowing.
     try {
         const audio = await generateSpeech(currentSegment.text);
         playPcmData(audio);
     } catch (e) { console.error(e); }
  };

  const playIdiom = async () => {
      if (currentSegment.idiomatic) {
          const audio = await generateSpeech(currentSegment.idiomatic);
          playPcmData(audio);
      }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="font-bold text-slate-800">Voice Shadowing</h2>
        <div className="w-6"></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 flex flex-col items-center">
        {/* Previous Segment (Ghosted) */}
        {currentIndex > 0 && (
            <div className="w-full opacity-40 grayscale blur-[1px] text-sm text-center">
                <p>{segments[currentIndex - 1].text}</p>
            </div>
        )}

        {/* Current Segment (Active) */}
        <div className="w-full bg-white rounded-2xl shadow-xl p-6 text-center border-t-4 border-blue-500">
            <p className="text-xl font-medium text-slate-900 mb-4">{currentSegment.text}</p>
            <p className="text-slate-500 text-sm">{currentSegment.translation}</p>
        </div>

        {/* Score Card */}
        {score && (
            <div className={`w-full p-4 rounded-xl animate-fade-in-up ${score.score >= 80 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold uppercase text-slate-500">Accuracy Score</span>
                    <span className={`text-2xl font-bold ${score.score >= 80 ? 'text-green-600' : 'text-orange-600'}`}>{score.score}</span>
                </div>
                <p className="text-slate-700 text-sm">{score.feedback}</p>
            </div>
        )}

         {/* Next Segment (Ghosted) */}
         {currentIndex < segments.length - 1 && (
            <div className="w-full opacity-40 grayscale blur-[1px] text-sm text-center">
                <p>{segments[currentIndex + 1].text}</p>
            </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-white border-t border-slate-100 p-6 pb-10">
        <div className="flex items-center justify-between max-w-sm mx-auto">
            {/* Play Original */}
            <button onClick={playOriginal} className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 transition">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <span className="text-xs font-medium">Original</span>
            </button>

            {/* Record Button */}
            <button 
                onClick={handleRecordToggle}
                disabled={isProcessing}
                className={`w-20 h-20 rounded-full shadow-lg flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 scale-110 ring-4 ring-red-200' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {isProcessing ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 3.01-2.45 5.5-5.5 5.5S6 14.01 6 11H4c0 3.53 2.61 6.43 6 6.92V21h4v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                )}
            </button>

            {/* Listen Native */}
            <button onClick={playIdiom} disabled={!currentSegment.idiomatic} className="flex flex-col items-center gap-1 text-slate-500 hover:text-purple-600 transition disabled:opacity-30">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <span className="text-xs font-medium">Native</span>
            </button>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 px-4">
             <button 
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                disabled={currentIndex === 0}
             >
                 Prev
             </button>
             <span className="text-xs text-slate-400 font-mono pt-1">{currentIndex + 1} / {segments.length}</span>
             <button 
                onClick={() => setCurrentIndex(Math.min(segments.length - 1, currentIndex + 1))}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                disabled={currentIndex === segments.length - 1}
             >
                 Next
             </button>
        </div>
      </div>
    </div>
  );
};