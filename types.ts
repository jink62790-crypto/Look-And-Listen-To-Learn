export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  translation: string; // Chinese translation
  idiomatic: string;   // American idiomatic expression
  isFavorite?: boolean; // New field for Favorites feature
}

export interface TranscriptionResponse {
  language: string;
  segments: TranscriptionSegment[];
  meta: {
    wordCount: number;
    estimatedLevel: string; // e.g., 'B2', 'C1'
    speed: string; // e.g., '140 wpm'
  }
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  SHADOWING = 'SHADOWING', // New mode for speaking practice
  ERROR = 'ERROR'
}

export interface AudioFileMetadata {
  name: string;
  size: number;
  type: string;
  url: string;
  originalFile: File;
}

export interface WordDefinition {
  word: string;
  definition: string;
  example: string;
  phonetic?: string;
}

export interface PronunciationScore {
  score: number; // 0-100
  feedback: string;
  accuracy: 'good' | 'average' | 'poor';
}