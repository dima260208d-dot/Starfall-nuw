import { useEffect, useState } from "react";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { getBattleHistory, type BattleRecord, type BattleHistoryParticipant } from "../utils/localStorageAPI";
import { useI18n } from "../i18n";
import BattleReplayViewer from "../components/BattleReplayViewer";
import BattleHistoryCard from "../components/BattleHistoryCard";
import BattleHistoryPlayerMenu from "../components/BattleHistoryPlayerMenu";
import { getMyClub, shareBattleToClub } from "../utils/clubs";
import { battleRecordToClubSharePayload } from "../utils/battleHistoryEnrich";
import { Tr } from "../i18n/Tr";

interface Props {
  onBack: () => void;
  onViewProfile: (playerId: string) => void;
}

export default function BattleHistoryPage({ onBack, onViewProfile }: Props) {
  const { t, localeMeta } = useI18n();
  const [history, setHistory] = useState<BattleRecord[]>(() => getBattleHistory());
  const [replayId, setReplayId] = useState<string | null>(null);
  const [shareConfirmRecord, setShareConfirmRecord] = useState<BattleRecord | null>(null);
  const [sharedRecordIds, setSharedRecordIds] = useState<Set<string>>(() => new Set());
  const [shareError, setShareError] = useState<string | null>(null);
  const canShare = !!getMyClub();
  const [playerMenu, setPlayerMenu] = useState<{
    x: number; y: number; playerId?: string; displayName: string;
  } | null>(null);

  useEffect(() => {
    setHistory(getBattleHistory());
    const refresh = () => setHistory(getBattleHistory());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const confirmShare = () => {
    if (!shareConfirmRecord) return;
    const payload = battleRecordToClubSharePayload(shareConfirmRecord);
    if (!payload) {
      setShareError(t("battleHistory.noReplay"));
      setShareConfirmRecord(null);
      return;
    }
    const res = shareBattleToClub(payload);
    setShareConfirmRecord(null);
    if (res.success) {
      setShareError(null);
      setSharedRecordIds(prev => new Set(prev).add(shareConfirmRecord.id));
    } else {
      setShareError(res.error ?? t("result.shareFailed"));
    }
  };

  const onAvatarClick = (e: React.MouseEvent, p: BattleHistoryParticipant) => {
    e.stopPropagation();
    setPlayerMenu({
      x: e.clientX,
      y: e.clientY,
      playerId: p.playerId,
      displayName: p.displayName,
    });
  };

  return (
    <PageBg variant="collection" style={{ fontFamily: "var(--app-font-sans)" }}>
      <PageHeader onBack={onBack} title={`\u2694\uFE0F $<Tr id="battleHistory.title" />`} />
      <PageBody style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 12px 24px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12, textAlign: "center" }}>
          <Tr id="drawer.battles.sub" />
        </div>
        {!history.length ? (
          <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.4)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{"\u2694\uFE0F"}</div>
            <div><Tr id="drawer.battles.empty" /></div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 960, margin: "0 auto", width: "100%" }}>
            {shareError && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, textAlign: "center",
                background: "rgba(255,82,82,0.12)", border: "1px solid rgba(255,82,82,0.35)",
                color: "#FF8A80", fontSize: 12, fontWeight: 700,
              }}>
                {shareError}
              </div>
            )}
            {history.map(r => (
              <BattleHistoryCard
                key={r.id}
                record={r}
                localeTag={localeMeta.bcp47}
                canShare={canShare}
                shared={sharedRecordIds.has(r.id)}
                onWatch={() => r.replayId && setReplayId(r.replayId)}
                onShare={() => {
                  setShareError(null);
                  setShareConfirmRecord(r);
                }}
                onAvatarClick={onAvatarClick}
              />
            ))}
          </div>
        )}
      </PageBody>

      {replayId && (
        <BattleReplayViewer
          replayId={replayId}
          onClose={() => setReplayId(null)}
          onFinished={() => {
            setReplayId(null);
            onBack();
          }}
        />
      )}
      {playerMenu && (
        <BattleHistoryPlayerMenu
          x={playerMenu.x}
          y={playerMenu.y}
          playerId={playerMenu.playerId}
          displayName={playerMenu.displayName}
          onViewProfile={onViewProfile}
          onClose={() => setPlayerMenu(null)}
        />
      )}

      {shareConfirmRecord && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShareConfirmRecord(null)}
        >
          <div
            style={{
              width: "min(420px, 92vw)",
              background: "linear-gradient(160deg, rgba(18,32,58,0.98), rgba(8,14,28,0.98))",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: "22px 24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "white", marginBottom: 10 }}>
              <Tr id="result.shareConfirmTitle" />
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.45, marginBottom: 18 }}>
              <Tr id="result.shareConfirmBody" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setShareConfirmRecord(null)}>
                <Tr id="common.no" />
              </button>
              <button type="button" className="ui-btn ui-btn--primary" onClick={confirmShare}>
                <Tr id="common.yes" />
              </button>
            </div>
          </div>
        </div>
      )}
    </PageBg>
  );
}
