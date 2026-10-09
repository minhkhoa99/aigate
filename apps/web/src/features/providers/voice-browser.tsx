import { useEffect, useRef, useState } from "react";
import { Button, Field, Panel, StateBlock, Table } from "../../shared/ui";
import { useToast } from "../../shared/toast";
import { toProblem } from "../../shared/errors";
import { useLocale } from "../../shared/locale";
import type { Language, MessageKey } from "../../shared/i18n";
import { previewTtsVoice, useProvider, useTtsVoices, type Connection, type ProviderSummary, type TtsVoice } from "./api";

const sample = "Hello, this is an AIGate voice preview.";
// Account catalogs can hold thousands of voices; the filters narrow them.
const MAX_ROWS = 200;
const genderKeys: Record<string, MessageKey> = { male: "voice.gender.male", female: "voice.gender.female", neutral: "voice.gender.neutral" };
const localeParts = (locale: string) => {
  try { const parsed = new Intl.Locale(locale.replace("_", "-")); return { language: parsed.language, region: parsed.region ?? "" }; }
  catch { return { language: "", region: "" }; }
};
const display = (type: "language" | "region", code: string, appLanguage: Language) => {
  if (!code) return "";
  try { return new Intl.DisplayNames([appLanguage === "vi" ? "vi-VN" : "en-US"], { type }).of(code) ?? code; }
  catch { return code; }
};

export function VoiceBrowser({ providers, connections, initialProvider = "openai" }: { providers: ProviderSummary[]; connections: Connection[]; initialProvider?: string }) {
  const { language: appLanguage, t } = useLocale();
  const genderLabel = (value: string) => value ? (genderKeys[value.toLowerCase()] ? t(genderKeys[value.toLowerCase()]) : value) : t("voice.notSpecified");
  const showToast = useToast();
  const [chosenProvider, setChosenProvider] = useState(initialProvider);
  const [chosenModel, setChosenModel] = useState("");
  const [language, setLanguage] = useState("");
  const [region, setRegion] = useState("");
  const [gender, setGender] = useState("");
  const [search, setSearch] = useState("");
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
  // docs/contracts/speech.md: any provider with a TTS route plays through the saved connection.
  const routable = Boolean(provider?.routeKinds.includes("tts"));
  const canPreview = isLocal || (routable && active);
  const voicesProblem = voicesQuery.isError ? toProblem(voicesQuery.error, appLanguage) : undefined;
  const languages = [...new Set(voices.map((voice) => localeParts(voice.locale).language).filter(Boolean))].sort();
  const regions = [...new Set(voices.map((voice) => localeParts(voice.locale).region).filter(Boolean))].sort();
  const genders = [...new Set(voices.map((voice) => voice.gender.toLowerCase()).filter(Boolean))].sort();
  const filtered = voices.filter((voice) => {
    const locale = localeParts(voice.locale);
    const needle = search.trim().toLowerCase();
    return (!language || locale.language === language) && (!region || locale.region === region) && (!gender || voice.gender.toLowerCase() === gender)
      && (!needle || voice.name.toLowerCase().includes(needle) || voice.id.toLowerCase().includes(needle));
  });
  const shown = filtered.slice(0, MAX_ROWS);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const update = () => setLocalVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", update); window.speechSynthesis.cancel(); };
  }, []);
  useEffect(() => () => previewAbort.current?.abort(), []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const reset = () => { previewAbort.current?.abort(); setPreviewing(""); setLanguage(""); setRegion(""); setGender(""); setSearch(""); setAudioUrl(""); window.speechSynthesis?.cancel(); };
  // The string /v1/audio/speech takes as its model: provider/model/voice.
  const copyModel = (voice: TtsVoice) => navigator.clipboard.writeText(`${providerId}/${model}/${voice.id}`).then(
    () => showToast({ tone: "success", localized: { key: "voice.copied", params: { model: `${providerId}/${model}/${voice.id}` } } }),
    () => showToast({ tone: "error", localized: { key: "voice.copyFailed" } }),
  );
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
    } catch (error) { if (!controller.signal.aborted) showToast({ tone: "error", error }); }
    finally { if (previewAbort.current === controller) { previewAbort.current = null; setPreviewing(""); } }
  };

  return <Panel title={t("voice.title")} detail={t("voice.detail")} className="section-gap">
    <div className="voice-filters">
      <Field label={t("voice.provider")}><select className="input" value={providerId} onChange={(event) => { setChosenProvider(event.target.value); setChosenModel(""); reset(); }}>{providers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
      <Field label={t("voice.model")}><select className="input" value={model} disabled={models.length === 0} onChange={(event) => { setChosenModel(event.target.value); reset(); }}>{models.length ? models.map((item) => <option value={item.id} key={item.id}>{item.name}</option>) : <option value="">{t("voice.providerDefault")}</option>}</select></Field>
      <Field label={t("voice.language")}><select className="input" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="">{t("voice.allLanguages")}</option>{languages.map((code) => <option key={code} value={code}>{display("language", code, appLanguage)}</option>)}</select></Field>
      <Field label={t("voice.region")}><select className="input" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">{t("voice.allRegions")}</option>{regions.map((code) => <option key={code} value={code}>{display("region", code, appLanguage)}</option>)}</select></Field>
      <Field label={t("voice.search")}><input className="input" type="search" value={search} placeholder={t("voice.searchPlaceholder")} onChange={(event) => setSearch(event.target.value)} /></Field>
      <Field label={t("voice.gender")}><select className="input" value={gender} onChange={(event) => setGender(event.target.value)}><option value="">{t("voice.allGenders")}</option>{genders.map((value) => <option key={value} value={value}>{genderLabel(value)}</option>)}</select></Field>
    </div>
    {voicesProblem?.code === "NO_ACTIVE_CONNECTION" ? <div className="state-block"><code>{voicesProblem.code}</code><strong>{t("voice.connectToLoad", { provider: provider?.name ?? providerId })}</strong><p>{voicesProblem.message}</p><a className="button button-primary" href={`/providers/connections?provider=${encodeURIComponent(providerId)}`}>{t("media.addConnection")}</a></div>
      : voicesProblem && !isLocal ? <div className="state-block error"><code>{voicesProblem.code}</code><strong>{t("voice.loadFailed")}</strong><p>{voicesProblem.message}</p><Button onClick={() => void voicesQuery.refetch()}>{t("common.retry")}</Button></div>
      : detail.isError ? <StateBlock state="error" code={toProblem(detail.error, appLanguage).code} action={<Button onClick={() => void detail.refetch()}>{t("common.retry")}</Button>} />
      : detail.isPending || (!isLocal && voicesQuery.isPending) ? <StateBlock state="loading" />
        : voices.length === 0 ? <div className="state-block"><strong>{t("voice.none")}</strong><p>{isLocal ? t("voice.noneLocal") : t("voice.noneProvider")}</p></div>
          : <><p className="muted voice-note">{t("voice.count", { filtered: filtered.length, total: voices.length })} {filtered.length > MAX_ROWS && t("voice.truncated", { limit: MAX_ROWS })} {!canPreview && (!routable ? t("voice.noRoute") : t("voice.connectToPlay"))}</p>
            <Table columns={[t("voice.voice"), t("voice.languageRegion"), t("voice.gender"), t("voice.preview")]} rows={shown.map((voice) => {
              const parts = localeParts(voice.locale);
              return [<><strong>{voice.name}</strong><small className="muted voice-id">{voice.id}</small></>, parts.language ? `${display("language", parts.language, appLanguage)}${parts.region ? ` · ${display("region", parts.region, appLanguage)}` : ""}` : t("voice.notSpecified"), genderLabel(voice.gender), <span className="voice-actions"><button className="button button-ghost" aria-label={t("voice.listenTo", { name: voice.name })} disabled={!canPreview || Boolean(previewing)} onClick={() => void preview(voice)}>{previewing === voice.id ? t("voice.generating") : t("voice.listen")}</button>{routable && !isLocal && <button className="button button-ghost" aria-label={t("voice.copyModel", { name: voice.name })} onClick={() => void copyModel(voice)}>{t("voice.copy")}</button>}</span>];
            })} empty={t("voice.emptyFilter")} />
            {audioUrl && <audio className="voice-player" src={audioUrl} controls autoPlay aria-label={t("voice.player")} />}
          </>}
  </Panel>;
}
