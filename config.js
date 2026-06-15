// Central knobs for the app. Override any of these in your .env file.

// Live API model. We use the stable "latest" alias for the 2.5 native-audio
// model — it gives affective (emotion-aware) native voice and won't expire on a
// fixed date the way the dated previews do.
// Other options your key can reach: gemini-2.5-flash-native-audio-preview-12-2025,
// gemini-3.1-flash-live-preview.
export const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-latest';

// One voice per character. Gemini has 30 prebuilt voices — preview them in
// Google AI Studio and swap the names below (or set LUC_VOICE / JEENIE_VOICE
// in .env) until they sound right to you.
//   male-leaning examples:   Puck, Charon, Fenrir, Orus, Iapetus
//   female-leaning examples: Kore, Aoede, Leda, Zephyr, Autonoe
export const VOICES = {
  Luc: process.env.LUC_VOICE || 'Puck',     // upbeat, energetic
  Jeenie: process.env.JEENIE_VOICE || 'Kore', // calm, clear
};

export const PORT = Number(process.env.PORT) || 3000;

// Audio formats are fixed by the Live API:
//   input  = 16 kHz, 16-bit, mono, little-endian PCM
//   output = 24 kHz, 16-bit, mono PCM
export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
