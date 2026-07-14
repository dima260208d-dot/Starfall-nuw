import { useEffect, useState } from "react";
import {
  getCurrentProfile,
  setCurrentUsername,
  getControlMode,
  setControlMode,
  isGuestProfile,
  type ControlMode,
} from "../utils/localStorageAPI";
import { getAstralSettings, updateAstralSettings, type AstralSettings } from "../utils/subscription";
import {
  isMusicEnabled,
  isVoiceEnabled,
  setMusicEnabled,
  setVoiceEnabled,
  subscribeAudioSettings,
} from "../audio/audioSettings";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import LanguagePicker from "../components/LanguagePicker";
import { EmojiIcon } from "../components/EmojiIcon";
import { useI18n } from "../i18n";
import { textOnTintedAccent } from "../utils/contrastText";
import { Tr } from "../i18n/Tr";
import {
  getBattleHapticSettings,
  setBattleHapticSettings,
} from "../utils/battleHaptics";
import { fetchPlayerReputation, type PlayerReputation } from "../utils/playerReports";

interface SettingsPageProps {
  onBack: () => void;
  onSwitchProfile: () => void;
  onOpenAccount?: () => void;
  onRegister?: () => void;
}

export default function SettingsPage({ onBack, onSwitchProfile, onOpenAccount, onRegister }: SettingsPageProps) {
  const { t } = useI18n();
  const [profile] = useState(getCurrentProfile());
  const guest = isGuestProfile(profile);
  const [msg, setMsg] = useState("");
  const [ctrl, setCtrl] = useState<ControlMode>(getControlMode());
  const [astral, setAstral] = useState<AstralSettings>(getAstralSettings());
  const [musicOn, setMusicOn] = useState(isMusicEnabled());
  const [voiceOn, setVoiceOn] = useState(isVoiceEnabled());
  const [haptics, setHaptics] = useState(getBattleHapticSettings());
  const [reputation, setReputation] = useState<PlayerReputation | null>(null);

  useEffect(() => {
    if (profile?.playerId) {
      void fetchPlayerReputation(profile.playerId).then(setReputation);
    }
  }, [profile?.playerId]);

  useEffect(() => {
    if (getControlMode() !== "mobile") setControlMode("mobile");
    setCtrl("mobile");
  }, []);

  useEffect(() => subscribeAudioSettings(() => {
    setMusicOn(isMusicEnabled());
    setVoiceOn(isVoiceEnabled());
  }), []);

  const toggleAstral = (patch: Partial<AstralSettings>) => {
    updateAstralSettings(patch);
    setAstral(getAstralSettings());
  };

  const pickControlMode = (_m: ControlMode) => {
    setControlMode("mobile");
    setCtrl("mobile");
  };

  const handleSwitchProfile = () => {
    setCurrentUsername(null);
    onSwitchProfile();
  };

  const mobileRows: [string, string][] = [
    [t("settings.controls.mobile.move"), t("settings.controls.mobile.moveKeys")],
    [t("settings.controls.mobile.attack"), t("settings.controls.mobile.attackKeys")],
    [t("settings.controls.mobile.super"), t("settings.controls.mobile.superKeys")],
    [t("settings.controls.mobile.aim"), t("settings.controls.mobile.aimKeys")],
    [t("settings.controls.mobile.autoAim"), t("settings.controls.mobile.autoAimKeys")],
  ];

  const voiceKeys = [
    "settings.astral.voice.star",
    "settings.astral.voice.moon",
    "settings.astral.voice.light",
  ] as const;

  return (
    <PageBg variant="settings" style={{
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--app-font-sans)",
    }}>
      <PageHeader onBack={onBack} title={t("settings.title")} />

      <PageBody style={{ padding: "40px 24px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <Section title={t("settings.section.language")}>
          <LanguagePicker />
        </Section>

        <Section title={t("settings.section.profile")}>
          {profile && (
            <div className="ui-card" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, letterSpacing: "0.02em" }}>{profile.username}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
                <div style={{ color: "var(--c-gold-3)" }}><Tr id="settings.profile.coins" params={{ count: profile.coins }} /></div>
                <div style={{ color: "var(--c-cyan-3)" }}><Tr id="settings.profile.gems" params={{ count: profile.gems }} /></div>
                <div style={{ color: "var(--c-gold-3)" }}><Tr id="settings.profile.power" params={{ count: profile.powerPoints }} /></div>
                <div style={{ color: "var(--t-3)" }}><Tr id="settings.profile.wins" params={{ wins: profile.totalWins, games: profile.totalGamesPlayed }} /></div>
              </div>
            </div>
          )}
          <Button onClick={handleSwitchProfile} color="#40C4FF" label={t("settings.switchAccount")} />
          {!guest && onOpenAccount && (
            <Button onClick={onOpenAccount} color="#FFD54F" label={t("settings.manageAccount")} />
          )}
          {guest && onRegister && (
            <Button onClick={onRegister} color="#FFD54F" label={t("accounts.registerGuest")} />
          )}
        </Section>

        <Section title={t("settings.section.audio")}>
          <div className="ui-card" style={{ padding: 16, marginBottom: 12 }}>
            <ToggleRow
              label={t("settings.audio.music")}
              hint={t("settings.audio.musicHint")}
              value={musicOn}
              onChange={setMusicEnabled}
            />
            <ToggleRow
              label={t("settings.audio.voice")}
              hint={t("settings.audio.voiceHint")}
              value={voiceOn}
              onChange={setVoiceEnabled}
            />
            <ToggleRow
              label={t("settings.audio.recoil")}
              hint={t("settings.audio.recoilHint")}
              value={haptics.recoilEnabled}
              onChange={(v) => {
                setBattleHapticSettings({ recoilEnabled: v });
                setHaptics(getBattleHapticSettings());
              }}
            />
            <ToggleRow
              label={t("settings.audio.vibration")}
              hint={t("settings.audio.vibrationHint")}
              value={haptics.vibrationEnabled}
              onChange={(v) => {
                setBattleHapticSettings({ vibrationEnabled: v });
                setHaptics(getBattleHapticSettings());
              }}
            />
          </div>
        </Section>

        {reputation && (
          <Section title={t("settings.section.reputation")}>
            <div className="ui-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 14, color: "var(--t-2)", lineHeight: 1.5 }}>
                <Tr id="settings.reputation.summary" params={{ count: reputation.reportsInWindow, days: reputation.windowDays }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--t-3)", marginTop: 8 }}>
                <Tr id="settings.reputation.hint" />
              </div>
            </div>
          </Section>
        )}

        <Section title={t("settings.section.controls")}>
          <div className="ui-card" style={{ padding: 16, marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: "var(--t-2)", marginBottom: 10 }}>{t("settings.controls.mobileOnly")}</div>
            {mobileRows.map(([action, key]) => (
              <div key={action} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--bd-1)" }}>
                <span style={{ color: "var(--t-3)", fontSize: 14 }}>{action}</span>
                <span className="ui-pill" style={{ color: "var(--t-1)", fontWeight: 800, fontSize: 12, padding: "3px 12px", letterSpacing: "0.04em" }}>{key}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("settings.section.astral")}>
          <div className="ui-card" style={{ background: "linear-gradient(160deg, rgba(206,147,216,0.16), rgba(8,4,24,0.78))", border: "1px solid var(--bd-violet)", padding: 16, marginBottom: 12, boxShadow: "var(--sh-glow-violet), var(--sh-sm)" }}>
            <ToggleRow
              label={t("settings.astral.enable")}
              hint={t("settings.astral.enableHint")}
              value={astral.enabled}
              onChange={(v) => toggleAstral({ enabled: v })}
            />
            <ToggleRow
              label={t("settings.astral.battleTips")}
              hint={t("settings.astral.battleTipsHint")}
              value={astral.battleTipsEnabled}
              onChange={(v) => toggleAstral({ battleTipsEnabled: v })}
            />
            <ToggleRow
              label={t("settings.astral.menuTips")}
              hint={t("settings.astral.menuTipsHint")}
              value={astral.menuTipsEnabled}
              onChange={(v) => toggleAstral({ menuTipsEnabled: v })}
            />
            <ToggleRow
              label={t("settings.astral.disableBattleCommands")}
              hint={t("settings.astral.disableBattleCommandsHint")}
              value={Boolean(astral.battleCommandsDisabled)}
              onChange={(v) => toggleAstral({ battleCommandsDisabled: v })}
            />
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              {voiceKeys.map((key, i) => (
                <button key={key} onClick={() => toggleAstral({ voice: i as 0 | 1 | 2 })}
                  className={`ui-btn ${astral.voice === i ? "ui-btn--primary" : "ui-btn--secondary"}`}
                  style={{
                    flex: 1, padding: "8px 6px",
                    fontSize: 12,
                    letterSpacing: "0.04em",
                  }}>{t(key)}</button>
              ))}
            </div>
          </div>
        </Section>

        {msg && (
          <div className="ui-glass" style={{ textAlign: "center", padding: 14, color: "#69F0AE", fontWeight: 700, borderColor: "rgba(105,240,174,0.4)" }}>
            {msg}
          </div>
        )}
      </PageBody>
    </PageBg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>{title.toUpperCase()}</div>
      {children}
    </div>
  );
}

function ModeCard({
  active, icon, title, subtitle, onClick, color, selectedLabel,
}: { active: boolean; icon: string; title: string; subtitle: string; onClick: () => void; color: string; selectedLabel: string }) {
  return (
    <button
      onClick={onClick}
      className="ui-card is-interactive"
      style={{
        background: active
          ? `linear-gradient(160deg, ${color}33, rgba(8,4,24,0.85))`
          : "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(8,4,24,0.65))",
        border: `1px solid ${active ? color : "var(--bd-1)"}`,
        borderRadius: "var(--r-lg)",
        padding: "16px 12px",
        color: "var(--t-1)",
        cursor: "pointer",
        textAlign: "center",
        boxShadow: active
          ? `0 0 24px ${color}aa, var(--sh-md), inset 0 1px 0 rgba(255,255,255,0.08)`
          : "var(--sh-sm)",
        transition: "all var(--ease-mid)",
        transform: active ? "translateY(-2px)" : "none",
      }}
    >
      <div style={{ fontSize: 32, lineHeight: 1 }}><EmojiIcon emoji={icon} size={32} /></div>
      <div style={{ marginTop: 8, fontWeight: 900, fontSize: 14, color: active ? color : "var(--t-1)", letterSpacing: "0.04em" }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: "var(--t-3)" }}>{subtitle}</div>
      {active && (
        <div className="ui-eyebrow" style={{ marginTop: 8, color }}>{selectedLabel}</div>
      )}
    </button>
  );
}

function ToggleRow({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid var(--bd-1)",
      gap: 14,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "0.01em" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--t-3)", marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 50, height: 26, borderRadius: 13,
        background: value
          ? "linear-gradient(135deg, var(--c-gold-3), var(--c-gold-2))"
          : "rgba(0,0,0,0.4)",
        border: `1px solid ${value ? "var(--bd-gold)" : "var(--bd-2)"}`,
        position: "relative", cursor: "pointer",
        transition: "all var(--ease-mid)",
        boxShadow: value
          ? "0 0 12px rgba(255,213,79,0.5), inset 0 1px 0 rgba(255,255,255,0.18)"
          : "inset 0 1px 2px rgba(0,0,0,0.4)",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2, left: value ? 26 : 2,
          width: 20, height: 20, borderRadius: "50%",
          background: value
            ? "linear-gradient(145deg, #FFF9C4, #FFD54F)"
            : "#FAFAFA",
          transition: "left 200ms, background 200ms, box-shadow 200ms",
          boxShadow: value
            ? "0 0 10px rgba(255,235,59,0.85), 0 2px 6px rgba(0,0,0,0.35)"
            : "0 2px 6px rgba(0,0,0,0.45)",
        }} />
      </button>
    </div>
  );
}

function Button({ onClick, color, label }: { onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className="ui-btn ui-btn--block"
      style={{
        ["--ui-shear-fill" as string]: `linear-gradient(135deg, ${color}44, ${color}18)`,
        ["--ui-shear-border" as string]: color,
        ["--ui-shear-text" as string]: textOnTintedAccent(color),
        ["--ui-shear-shadow" as string]: `0 0 14px ${color}33, var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.08)`,
        fontWeight: 800,
        fontSize: 14,
        padding: "12px 0",
        marginBottom: 8,
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </button>
  );
}
