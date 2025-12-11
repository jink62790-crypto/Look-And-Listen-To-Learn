import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { TranscriptView } from './components/TranscriptView';
import { AudioPlayer } from './components/AudioPlayer';
import { ShadowingView } from './components/ShadowingView';
import { transcribeAudio } from './services/geminiService';
import { AppState, TranscriptionResponse, AudioFileMetadata } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [audioFile, setAudioFile] = useState<AudioFileMetadata | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionResponse | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'original' | 'notes' | 'favorites'>('original');

  useEffect(() => {
    return () => {
      if (audioFile?.url) URL.revokeObjectURL(audioFile.url);
    };
  }, [audioFile]);

  const handleFileSelected = async (file: File) => {
    try {
      setAppState(AppState.PROCESSING);
      const url = URL.createObjectURL(file);
      setAudioFile({
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        originalFile: file
      });

      const result = await transcribeAudio(file);
      setTranscription(result);
      setAppState(AppState.READY);
    } catch (err: any) {
      console.error(err);
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setAudioFile(null);
    setTranscription(null);
    setCurrentTime(0);
  };

  const handleToggleFavorite = (index: number) => {
    if (!transcription) return;
    const newSegments = [...transcription.segments];
    newSegments[index] = {
      ...newSegments[index],
      isFavorite: !newSegments[index].isFavorite
    };
    setTranscription({
      ...transcription,
      segments: newSegments
    });
  };

  // Filter segments for the Favorites tab
  const displayedSegments = activeTab === 'favorites' && transcription
    ? transcription.segments.filter(s => s.isFavorite)
    : transcription?.segments || [];

  return (
    <div className="h-screen w-full flex justify-center bg-gray-100">
    <div className="h-full w-full max-w-md bg-slate-50 shadow-2xl overflow-hidden relative flex flex-col font-sans">
      
      {/* Header */}
      <header className="bg-white px-4 pt-12 pb-2 shadow-sm shrink-0 z-20">
        <div className="flex items-center justify-between mb-4">
            <button onClick={handleReset} className="p-2 -ml-2 text-slate-400 hover:text-slate-800">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-lg font-bold text-slate-800">LinguaSync</h1>
            <div className="flex gap-2">
                <button className="p-2 text-slate-400 hover:text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
            </div>
        </div>

        {/* Tab Bar */}
        {appState === AppState.READY && (
            <div className="flex items-center gap-6 px-2 border-b border-transparent">
                {(['original', 'notes', 'favorites'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 text-sm font-bold transition-colors capitalize border-b-2 ${activeTab === tab ? 'text-slate-900 border-blue-600' : 'text-slate-400 border-transparent'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative bg-slate-50">
        
        {appState === AppState.IDLE && (
          <div className="h-full flex flex-col justify-center px-6">
            <FileUpload onFileSelected={handleFileSelected} appState={appState} />
          </div>
        )}

        {appState === AppState.PROCESSING && (
          <div className="h-full flex flex-col items-center justify-center space-y-4 px-6">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Analyzing audio...</p>
          </div>
        )}

        {appState === AppState.READY && transcription && audioFile && (
           activeTab === 'notes' ? (
               <div className="h-full flex items-center justify-center text-slate-400">
                   <p>No notes yet.</p>
               </div>
           ) : (
              // For Original and Favorites, we use TranscriptView
              // Note: If in Favorites, displayedSegments is filtered. 
              // We pass the full transcription to 'onToggleFavorite' index lookups if we used global index,
              // but here we map locally. We need to handle index alignment.
              // Simplest approach: Pass "isFavoritesMode" to view or just the list.
              // To support toggling correctly in filtered view, we need the original index.
              // Let's modify how we map in TranscriptView or pass a handler that takes the *text* ID or similar.
              // For now, let's just pass the segments. If we are in Favorites, we only pass favorite segments.
              // The drawback is 'currentTime' highligting might not work if the playing segment is hidden.
              activeTab === 'favorites' && displayedSegments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                     <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                     <p>No favorites yet.</p>
                  </div>
              ) : (
                <TranscriptView 
                    segments={displayedSegments}
                    currentTime={currentTime}
                    onSegmentClick={(time) => setCurrentTime(time)}
                    meta={transcription.meta}
                    onToggleFavorite={(segment) => {
                        // Find index in original list
                        const idx = transcription.segments.indexOf(segment);
                        if (idx !== -1) handleToggleFavorite(idx);
                    }}
                />
              )
           )
        )}
      </main>

      {/* Footer / Shadowing Overlay */}
      {appState === AppState.SHADOWING && transcription && (
        <ShadowingView 
            segments={transcription.segments} 
            onClose={() => setAppState(AppState.READY)}
        />
      )}

      {appState === AppState.READY && audioFile && (
        <AudioPlayer 
            audioUrl={audioFile.url}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            onEnterShadowing={() => setAppState(AppState.SHADOWING)}
        />
      )}

    </div>
    </div>
  );
};

export default App;