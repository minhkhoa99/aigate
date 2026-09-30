import { useEffect, useRef, useState } from "react";
import { Button, Field, Panel, StateBlock, Table } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { previewTtsVoice, useProvider, useTtsVoices, type Connection, type ProviderSummary, type TtsVoice } from "./api";

const sample = "Hello, this is an AIGate voice preview.";
const localeParts = (locale: string) => {
  try { const parsed = new Intl.Locale(locale.replace("_", "-")); return { language: parsed.language, region: parsed.region ?? "" }; }
  catch { return { language: "", region: "" }; }
};
const display = (type: "language" | "region", code: string) => {
  if (!code) return "Not specified";
  try { return new Intl.DisplayNames([navigator.language], { type }).of(code) ?? code; }
  catch { return code; }
};

export function VoiceBrowser({ providers, connections, initialProvider = "openai" }: { providers: ProviderSummary[]; connections: Connection[]; initialProvider?: string }) {
  const showToast = useToast();
  const [chosenProvider, setChosenProvider] = useState(initialProvider);
  const [chosenModel, setChosenModel] = useState("");
  const [language, setLanguage] = useState("");
  const [region, setRegion] = useState("");
  const [gender, setGender] = useState("");
  const [localVoices, setLocalVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewing, setPreviewing] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const previewAbort = useRef<AbortController | null>(null);
  const provider = providers.find((item) => item.id === chosenProvider) ?? providers[0];
  const providerId = provider?.id ?? "";
  const detail = useProvider(providerId, Boolean(providerId));
  const models = (detail.data?.models ?? []).filter((model) => model.kind === "tts");
  const model = models.some((item) => item.id === chosenModel) ? chosenModel : models[0]?.id ?? "";
  const isLocal = providerId === "local-device";
  const voicesQuery = useTtsVoices(providerId, model, Boolean(providerId) && !isLocal && !detail.isPending);
  const voices: TtsVoice[] = isLocal ? localVoices.map((item) => ({ id: item.voiceURI, name: item.name, locale: item.lang, gender: "" })) : voicesQuery.data?.voices ?? [];
  const active = connections.some((item) => item.provider === providerId && item.isActive);
  const canPreview = isLocal || ((providerId === "openai" || providerId === "openrouter") && active);
  const languages = [...new Set(voices.map((voice) => localeParts(voice.locale).language).filter(Boolean))].sort();
  const regions = [...new Set(voices.map((voice) => localeParts(voice.locale).region).filter(Boolean))].sort();
  const genders = [...new Set(voices.map((voice) => voice.gender.toLowerCase()).filter(Boolean))].sort();
  const filtered = voices.filter((voice) => {
    const locale = localeParts(voice.locale);
    return (!language || locale.language === language) && (!region || locale.region === region) && (!gender || voice.gender.toLowerCase() === gender);
  });

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const update = () => setLocalVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", update); window.speechSynthesis.cancel(); };
  }, []);
  useEffect(() => () => previewAbort.current?.abort(), []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const reset = () => { previewAbort.current?.abort(); setPreviewing(""); setLanguage(""); setRegion(""); setGender(""); setAudioUrl(""); window.speechSynthesis?.cancel(); };
  const preview = async (voice: TtsVoice) => {
    if (isLocal) {
      const local = localVoices.find((item) => item.voiceURI === voice.id);
      if (!local) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sample);
      utterance.voice = local;
      window.speechSynthesis.speak(utterance);
      return;
    }
    previewAbort.current?.abort();
    const controller = new AbortController();
    previewAbort.current = controller;
    setPreviewing(voice.id);
    setAudioUrl("");
    try {
      const blob = await previewTtsVoice(providerId, model, voice.id, controller.signal);
      if (!controller.signal.aborted) setAudioUrl(URL.createObjectURL(blob));
    } catch (error) { if (!controller.signal.aborted) showToast({ tone: "error", ...toProblem(error) }); }
    finally { if (previewAbort.current === controller) { previewAbort.current = null; setPreviewing(""); } }
  };

  return <Panel title="Voice browser" detail="Browse preset voices. Preview requests may use provider credit." className="section-gap">
    <div className="voice-filters">
      <Field label="Provider"><select className="input" value={providerId} onChange={(event) => { setChosenProvider(event.target.value); setChosenModel(""); reset(); }}>{providers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label="Model"><select className="input" value={model} disabled={models.length === 0} onChange={(event) => { setChosenModel(event.target.value); reset(); }}>{models.length ? models.map((item) => <option value={item.id} key={item.id}>{item.name}</option>) : <option value="">Provider default</option>}</select></Field>
      <Field label="Language"><select className="input" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="">All languages</option>{languages.map((code) => <option key={code} value={code}>{display("language", code)}</option>)}</select></Field>
      <Field label="Region"><select className="input" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">All regions</option>{regions.map((code) => <option key={code} value={code}>{display("region", code)}</option>)}</select></Field>
      <Field label="Gender"><select className="input" value={gender} onChange={(event) => setGender(event.target.value)}><option value="">All genders</option>{genders.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
    </div>
    {detail.isError || (!isLocal && voicesQuery.isError) ? <StateBlock state="error" code={toProblem(detail.error ?? voicesQuery.error).code} action={<Button onClick={() => { void detail.refetch(); void voicesQuery.refetch(); }}>Retry</Button>} />
      : detail.isPending || (!isLocal && voicesQuery.isPending) ? <StateBlock state="loading" />
        : voices.length === 0 ? <div className="state-block"><strong>No voice IDs available</strong><p>{isLocal ? "This browser has no installed speech voices." : "AIGate does not have a voice catalog for this provider yet."}</p></div>
          : <><p className="muted voice-note">{filtered.length} of {voices.length} voices. {!canPreview && (active ? "Playback is not supported for this provider yet." : "Connect this provider to enable playback where supported.")}</p>
            <Table columns={["Voice", "Language / region", "Gender", "Preview"]} rows={filtered.map((voice) => {
              const parts = localeParts(voice.locale);
              return [<><strong>{voice.name}</strong><small className="muted voice-id">{voice.id}</small></>, parts.language ? `${display("language", parts.language)} · ${display("region", parts.region)}` : "Not specified", voice.gender || "Not specified", <button className="button button-ghost" aria-label={`Listen to ${voice.name}`} disabled={!canPreview || Boolean(previewing)} onClick={() => void preview(voice)}>{previewing === voice.id ? "Generating…" : "Listen"}</button>];
            })} empty="No voices match these filters." />
            {audioUrl && <audio className="voice-player" src={audioUrl} controls autoPlay aria-label="Voice preview" />}
          </>}
  </Panel>;
}
