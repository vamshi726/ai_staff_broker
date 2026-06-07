// Sarvam AI helpers — STT, translation, TTS.
// Docs: https://docs.sarvam.ai

const SARVAM_BASE = "https://api.sarvam.ai";

function key() {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new Error("Missing SARVAM_API_KEY");
  return k;
}

// Map our app's 2-letter codes to Sarvam BCP-47-ish codes.
const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
  ta: "ta-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  or: "od-IN",
};

export function toSarvamLang(code: string | null | undefined): string {
  if (!code) return "en-IN";
  return LANG_MAP[code] ?? code;
}

export async function sarvamSTT(opts: {
  audio: Blob | ArrayBuffer | Uint8Array;
  language?: string | null;
  filename?: string;
}): Promise<{ transcript: string; language_code: string }> {
  const form = new FormData();
  const blob =
    opts.audio instanceof Blob
      ? opts.audio
      : new Blob([opts.audio as BlobPart], { type: "audio/webm" });
  form.append("file", blob, opts.filename ?? "voice.webm");
  form.append("model", "saarika:v2.5");
  form.append("language_code", toSarvamLang(opts.language));
  form.append("with_timestamps", "false");

  const res = await fetch(`${SARVAM_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": key() },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sarvam STT failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { transcript: string; language_code: string };
  return data;
}

export async function sarvamTranslate(opts: {
  input: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<string> {
  if (opts.sourceLanguage === opts.targetLanguage) return opts.input;
  const res = await fetch(`${SARVAM_BASE}/translate`, {
    method: "POST",
    headers: {
      "api-subscription-key": key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: opts.input,
      source_language_code: toSarvamLang(opts.sourceLanguage),
      target_language_code: toSarvamLang(opts.targetLanguage),
      mode: "formal",
      model: "mayura:v1",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sarvam translate failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { translated_text: string };
  return data.translated_text;
}

export async function sarvamTTS(opts: {
  text: string;
  language: string;
}): Promise<string> {
  // Returns base64 wav data URL (the API returns base64 audio chunks).
  const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [opts.text.slice(0, 500)],
      target_language_code: toSarvamLang(opts.language),
      speaker: "anushka",
      model: "bulbul:v2",
      pitch: 0,
      pace: 1,
      loudness: 1,
      enable_preprocessing: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sarvam TTS failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { audios: string[] };
  if (!data.audios?.[0]) throw new Error("Sarvam TTS returned no audio");
  return `data:audio/wav;base64,${data.audios[0]}`;
}
