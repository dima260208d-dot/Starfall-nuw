import { useEffect, useRef, useState } from "react";
import { sendFriendRequestAsync } from "../utils/social/friends";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";
import { EmojiIcon } from "./EmojiIcon";

interface Props {
  x: number;
  y: number;
  playerId?: string;
  displayName: string;
  onViewProfile: (playerId: string) => void;
  onClose: () => void;
}

export default function BattleHistoryPlayerMenu({
  x, y, playerId, displayName, onViewProfile, onClose,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: Math.min(x, window.innerWidth - 180),
        top: Math.min(y, window.innerHeight - 120),
        zIndex: 150,
        background: "rgba(20,28,50,0.95)",
        border: "1px solid rgba(120,160,255,0.45)",
        borderRadius: 12,
        padding: 8,
        minWidth: 160,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginBottom: 6, padding: "0 4px" }}>
        {displayName}
      </div>
      {playerId ? (
        <>
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            style={{ width: "100%", marginBottom: 4, fontSize: 12, justifyContent: "flex-start" }}
            onClick={() => { onViewProfile(playerId); onClose(); }}
          >
            <EmojiIcon emoji="👤" size={18} /> <Tr id="battleHistory.viewProfile" />
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            style={{ width: "100%", fontSize: 12, justifyContent: "flex-start" }}
            onClick={() => {
              void sendFriendRequestAsync(playerId).then((r) => {
                setMsg(r.success ? t("friends.requestSent") : (r.error ?? t("common.error")));
                setTimeout(onClose, 1200);
              });
            }}
          >
            <EmojiIcon emoji="➕" size={18} /> <Tr id="battleHistory.addFriend" />
          </button>
        </>
      ) : (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", padding: "4px 6px" }}>
          <Tr id="battleHistory.botPlayer" />
        </div>
      )}
      {msg && (
        <div style={{ fontSize: 10, marginTop: 6, color: "#69F0AE", padding: "0 4px" }}>{msg}</div>
      )}
    </div>
  );
}
