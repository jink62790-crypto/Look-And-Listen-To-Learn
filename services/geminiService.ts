import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TranscriptionResponse, WordDefinition, PronunciationScore, TranscriptionSegment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TRANSCRIPTION_MODEL = "gemini-2.5-flash"; 
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

/**
 * Converts a File/Blob to Base64 string (without Data URI prefix).
 */
const fileToBase64 = async (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove "data:audio/xyz;base64," prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Post-processes segments to merge short "filler" segments into the next one.
 * e.g. ["Okay, now,", "I want to share..."] -> ["Okay, now, I want to share..."]
 */
const mergeShortSegments = (segments: TranscriptionSegment[]): TranscriptionSegment[] => {
  const MIN_WORDS = 4; // Threshold for a "short" segment
  const merged: TranscriptionSegment[] = [];
  
  if (segments.length === 0) return [];

  let current = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    const currentWordCount = current.text.split(/\s+/).length;
    const duration = current.end - current.start;

    // Merge if current is short AND duration is short (less than 2 seconds),
    // This prevents merging a very slow emphatic "No!" unless it's really a throwaway filler.
    if (currentWordCount < MIN_WORDS && duration < 2.0) {
      current = {
        ...current,
        end: next.end,
        text: `${current.text} ${next.text}`,
        translation: `${current.translation} ${next.translation}`,
        // Prefer the next segment's idiomatic expression as short fillers rarely have good ones
        idiomatic: next.idiomatic || current.idiomatic, 
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
};

/**
 * Transcribes audio with Translation and Idiomatic Expressions.
 */
export const transcribeAudio = async (file: File): Promise<TranscriptionResponse> => {
  const base64Audio = await fileToBase64(file);

  const systemPrompt = `
    You are an expert English learning assistant.
    1. Transcribe the audio accurately (en-US). 
       IMPORTANT: Combine short filler phrases (e.g., "Okay now", "So then") with the following sentence. Avoid creating segments with fewer than 4 words unless it is a complete, standalone sentence.
    2. For EACH segment, provide:
       - 'text': The original English text.
       - 'translation': A natural Chinese translation.
       - 'idiomatic': An alternative American idiomatic expression conveying the same meaning (e.g., "I'm very hungry" -> "I could eat a horse").
    3. Analyze the overall audio to estimate word count, CEFR level (A1-C2), and speed.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      language: { type: Type.STRING },
      meta: {
        type: Type.OBJECT,
        properties: {
            wordCount: { type: Type.NUMBER },
            estimatedLevel: { type: Type.STRING },
            speed: { type: Type.STRING }
        }
      },
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.NUMBER },
            end: { type: Type.NUMBER },
            text: { type: Type.STRING },
            translation: { type: Type.STRING },
            idiomatic: { type: Type.STRING },
          },
          required: ["start", "end", "text", "translation", "idiomatic"],
        },
      },
    },
    required: ["language", "segments", "meta"],
  };

  try {
    const response = await ai.models.generateContent({
      model: TRANSCRIPTION_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type || 'audio/mp3',
              data: base64Audio
            }
          },
          { text: "Transcribe and analyze this audio for an English learner." }
        ]
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text) as TranscriptionResponse;
      // Client-side safeguard: Merge short segments if the model didn't do it perfectly
      parsed.segments = mergeShortSegments(parsed.segments);
      return parsed;
    }
    throw new Error("Empty response from Gemini");

  } catch (error) {
    console.error("Transcription failed:", error);
    throw error;
  }
};

/**
 * Text-to-Speech for Idiomatic Expressions.
 */
export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore', 'Puck', 'Fenrir', etc.
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (audioData) return audioData;
    throw new Error("No audio data returned");
  } catch (error) {
    console.error("TTS failed:", error);
    throw error;
  }
};

/**
 * Scores user pronunciation.
 */
export const scorePronunciation = async (userAudio: Blob, referenceText: string): Promise<PronunciationScore> => {
  const base64Audio = await fileToBase64(userAudio);

  const prompt = `
    Listen to this user recording and compare it to the text: "${referenceText}".
    Grade the pronunciation accuracy from 0 to 100.
    Provide brief feedback.
    Return JSON: { score: number, feedback: string, accuracy: 'good'|'average'|'poor' }
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      feedback: { type: Type.STRING },
      accuracy: { type: Type.STRING, enum: ['good', 'average', 'poor'] }
    },
    required: ["score", "feedback", "accuracy"]
  };

  try {
    const response = await ai.models.generateContent({
      model: TRANSCRIPTION_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as PronunciationScore;
    }
    throw new Error("Scoring failed");
  } catch (error) {
    console.error("Scoring failed:", error);
    throw error;
  }
};

export const getWordDefinition = async (word: string, contextSentence: string): Promise<WordDefinition> => {
  const prompt = `Define "${word}" in context: "${contextSentence}". JSON output.`;
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING },
      definition: { type: Type.STRING },
      example: { type: Type.STRING },
      phonetic: { type: Type.STRING },
    },
    required: ["word", "definition", "example"],
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema }
  });
  
  return JSON.parse(response.text!) as WordDefinition;
};