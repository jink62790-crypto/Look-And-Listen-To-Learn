// Utilities for Audio Recording and PCM Playback

let audioContext: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

// --- PCM Player for Gemini TTS ---

export const playPcmData = async (base64String: string) => {
  const ctx = getAudioContext();
  
  // Base64 decoding
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Convert raw PCM (Int16) to AudioBuffer (Float32)
  // Gemini usually returns 24kHz mono PCM
  const int16Data = new Int16Array(bytes.buffer);
  const audioBuffer = ctx.createBuffer(1, int16Data.length, 24000);
  const channelData = audioBuffer.getChannelData(0);
  
  for (let i = 0; i < int16Data.length; i++) {
    channelData[i] = int16Data[i] / 32768.0;
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start(0);
};

// --- Microphone Recorder ---

export class AudioRecorder {
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data);
    };

    this.mediaRecorder.start();
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return;
      
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    });
  }
}