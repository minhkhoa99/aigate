// Preset voice IDs from the reference TTS catalog. Live, account-specific voices need a provider API.
export interface TtsVoice { id: string; name: string; locale: string; gender: string }

const voices = (ids: readonly string[]): TtsVoice[] => ids.map((id) => ({ id, name: id, locale: "", gender: "" }));
const openaiStandard = voices(["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]);
const openaiFull = voices(["alloy", "ash", "ballad", "cedar", "coral", "echo", "fable", "marin", "nova", "onyx", "sage", "shimmer", "verse"]);
// gemini.js PREBUILT_VOICES: 9router labels every one "en", but the voices speak whatever language the text is in.
const geminiFemale = new Set(["Zephyr", "Kore", "Leda", "Aoede", "Callirrhoe", "Autonoe", "Despina", "Erinome", "Laomedeia", "Achernar", "Gacrux", "Pulcherrima", "Vindemiatrix", "Sulafat"]);
const gemini = voices([
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar", "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
]).map((voice) => ({ ...voice, gender: geminiFemale.has(voice.id) ? "Female" : "Male" }));
const mimo = voices(["mimo_default", "冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe", "Milo", "Dean"]);
const edgeGender: Record<string, string> = { Aria: "Female", Guy: "Male", Sonia: "Female", HoaiMy: "Female", NamMinh: "Male", Xiaoxiao: "Female", Yunxi: "Male", Denise: "Female", Katja: "Female", Nanami: "Female", SunHi: "Female" };
const edge = ["en-US-AriaNeural", "en-US-GuyNeural", "en-GB-SoniaNeural", "vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural", "zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "fr-FR-DeniseNeural", "de-DE-KatjaNeural", "ja-JP-NanamiNeural", "ko-KR-SunHiNeural"]
  .map((id) => { const name = id.split("-").slice(2).join("-").replace(/Neural$/, ""); return { id, name, locale: id.split("-").slice(0, 2).join("-"), gender: edgeGender[name] ?? "" }; });

export function ttsVoices(provider: string, model: string): readonly TtsVoice[] {
  if (provider === "openai" || provider === "openrouter") {
    const id = model.replace(/^openai\//, "");
    if (id === "gpt-4o-mini-tts") return openaiFull;
    if (id === "tts-1" || id === "tts-1-hd") return openaiStandard;
  }
  if (provider === "gemini" && /^gemini-(?:3\.1-flash-tts-preview|2\.5-(?:flash|pro)-preview-tts)$/.test(model)) return gemini;
  if (provider === "xiaomi-mimo" && model === "mimo-v2.5-tts") return mimo;
  if (provider === "edge-tts") return edge;
  return [];
}
