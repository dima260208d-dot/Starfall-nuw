import { useMemo, useState } from "react";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { useI18n } from "../i18n";
import {
  listLocalAccounts,
  switchToAccount,
  isGuestProfile,
  getCurrentProfile,
} from "../utils/localStorageAPI";
import { formatPlayerIdDisplay } from "../utils/playerId";
import { Tr } from "../i18n/Tr";

interface Props {
  onBack: () => void;
  onOpenAccount: (username: string) => void;
  onRegister: () => void;
  onAuth: () => void;
}

export default function AccountsPage({ onBack, onOpenAccount, onRegister, onAuth }: Props) {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const accounts = useMemo(() => listLocalAccounts(), [tick]);
  const currentProfile = getCurrentProfile();
  const isGuest = isGuestProfile(currentProfile);

  const handleSwitch = (username: string) => {
    const result = switchToAccount(username);
    if (result.success) {
      setTick((n) => n + 1);
      setMsg(t("accounts.switched"));
      setTimeout(() => setMsg(""), 2500);
    } else {
      setMsg(result.error || t("common.error"));
      setTimeout(() => setMsg(""), 3000);
    }
  };

  return (
    <PageBg variant="accounts" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
      <PageHeader onBack={onBack} title={t("accounts.title")} />
      <PageBody style={{ padding: "24px 20px", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--t-3)", lineHeight: 1.5 }}>
          <Tr id="accounts.subtitle" />
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map((acc) => (
            <div
              key={acc.username}
              className="ui-card"
              style={{
                padding: "16px 18px",
                border: acc.isCurrent ? "1px solid rgba(255,213,79,0.45)" : "1px solid var(--bd-1)",
                background: acc.isCurrent
                  ? "linear-gradient(160deg, rgba(255,213,79,0.12), rgba(8,4,24,0.78))"
                  : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 17, fontWeight: 900 }}>{acc.username}</span>
                    {acc.isCurrent && (
                      <span className="ui-pill" style={{ fontSize: 10, color: "var(--c-gold-3)", borderColor: "var(--bd-gold)" }}>
                        <Tr id="accounts.current" />
                      </span>
                    )}
                    {acc.isGuest && (
                      <span className="ui-pill" style={{ fontSize: 10, color: "var(--t-3)" }}>
                        <Tr id="accounts.guestBadge" />
                      </span>
                    )}
                  </div>
                  {acc.playerId && (
                    <div style={{ fontSize: 12, color: "var(--t-3)", marginTop: 4 }}>
                      ID {formatPlayerIdDisplay(acc.playerId)}
                    </div>
                  )}
                  {acc.email && (
                    <div style={{ fontSize: 12, color: "var(--t-3)", marginTop: 2 }}>{acc.email}</div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--t-3)", marginTop: 6 }}>
                    <Tr id="accounts.stats" params={{ wins: acc.totalWins, games: acc.totalGamesPlayed }} />
                    {" · "}
                    {acc.trophies} 🏆 · {acc.coins} 🪙
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  {!acc.isCurrent && (
                    <button type="button" onClick={() => handleSwitch(acc.username)} className="ui-btn ui-btn--secondary" style={{ fontSize: 12, padding: "8px 12px" }}>
                      <Tr id="accounts.switch" />
                    </button>
                  )}
                  {acc.isCurrent && !acc.isGuest && (
                    <button type="button" onClick={() => onOpenAccount(acc.username)} className="ui-btn ui-btn--primary" style={{ fontSize: 12, padding: "8px 12px" }}>
                      <Tr id="accounts.manage" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {isGuest ? (
            <button type="button" onClick={onRegister} className="ui-btn ui-btn--primary ui-btn--block" style={{ fontWeight: 800 }}>
              <Tr id="accounts.registerGuest" />
            </button>
          ) : null}
          <button type="button" onClick={onAuth} className="ui-btn ui-btn--secondary ui-btn--block" style={{ fontWeight: 800 }}>
            <Tr id="accounts.addAccount" />
          </button>
        </div>

        {msg && (
          <div className="ui-glass" style={{ marginTop: 16, textAlign: "center", padding: 12, color: "#69F0AE", fontWeight: 700 }}>
            {msg}
          </div>
        )}
      </PageBody>
    </PageBg>
  );
}
