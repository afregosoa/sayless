// Vercel limita la petición de una Server Action a ~4.5 MB (≈4 min de MP3 a 128 kbps).
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export const MAX_AUDIO_MB = MAX_AUDIO_BYTES / (1024 * 1024);
