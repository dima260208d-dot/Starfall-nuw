import { useEffect, useState } from "react";
import { FRIENDSHIP_TITLE_MAX_LEN } from "../../data/friendshipLevels";
import {
  canCreateFriendshipTitle,
  dismissFriendshipTitlePrompt,
  getFriendshipTitleState,
  submitFriendshipTitleProposal,
  voteFriendshipTitle,
} from "../../utils/social/friendship";
import { useI18n } from "../../i18n";
import { Tr } from "../../i18n/Tr";

export default function FriendshipTitleModal({
  friendPlayerId,
  friendUsername,
  onClose,
  onDone,
}: {
  friendPlayerId: string;
  friendUsername: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);
  void tick;

  const ready = canCreateFriendshipTitle(friendPlayerId);
  const state = getFriendshipTitleState(friendPlayerId);

  useEffect(() => {
    if (state.confirmedTitle) onDone();
  }, [state.confirmedTitle, onDone]);

  if (!ready || state.confirmedTitle) return null;

  const handlePropose = () => {
    const r = submitFriendshipTitleProposal(friendPlayerId, text);
    if (!r.success) {
      setMsg(r.error ? t(r.error) : t("common.error"));
      return;
    }
    if (r.confirmed) {
      onDone();
      return;
    }
    setMsg(t("friendship.titleWaiting"));
    refresh();
  };

  const handleVote = (choice: string) => {
    const r = voteFriendshipTitle(friendPlayerId, choice);
    if (!r.success) {
      setMsg(r.error ? t(r.error) : t("common.error"));
      return;
    }
    if (r.confirmed) {
      onDone();
      return;
    }
    setMsg(t("friendship.titleWaiting"));
    refresh();
  };

  const handleSkip = () => {
    dismissFriendshipTitlePrompt(friendPlayerId);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9100,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, rgba(45,28,80,0.98), rgba(10,5,28,0.99))",
          border: "2px solid rgba(255,215,64,0.5)",
          borderRadius: 16,
          padding: 18,
          maxWidth: 400,
          width: "100%",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 900, color: "#FFD740", marginBottom: 6 }}>
          <Tr id="friendship.titleModalTitle" />
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}>
          <Tr id="friendship.titleModalHint" params={{ name: friendUsername, max: String(FRIENDSHIP_TITLE_MAX_LEN) }} />
        </div>

        {(state.myText || state.partnerText) && (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.5)" }}>
              <Tr id="friendship.titleProposals" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <ProposalBox label={t("friendship.titleYours")} text={state.myText || "—"} match={state.textsMatch} />
              <ProposalBox label={t("friendship.titleTheirs", { name: friendUsername })} text={state.partnerText || "—"} match={state.textsMatch} />
            </div>
            {state.textsMatch && state.myText && (
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => handleVote(state.myText)}>
                <Tr id="friendship.titleConfirmMatch" />
              </button>
            )}
            {!state.textsMatch && (state.myText || state.partnerText) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {state.myText && (
                  <button type="button" className="ui-btn ui-btn--secondary" onClick={() => handleVote(state.myText)}>
                    <Tr id="friendship.titleVoteMine" params={{ text: state.myText }} />
                  </button>
                )}
                {state.partnerText && state.partnerText !== state.myText && (
                  <button type="button" className="ui-btn ui-btn--secondary" onClick={() => handleVote(state.partnerText)}>
                    <Tr id="friendship.titleVoteTheirs" params={{ text: state.partnerText }} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <label style={{ fontSize: 10, fontWeight: 800, display: "block", marginBottom: 4 }}>
          <Tr id="friendship.titleInputLabel" />
        </label>
        <input
          className="ui-input"
          value={text}
          maxLength={FRIENDSHIP_TITLE_MAX_LEN}
          onChange={e => setText(e.target.value)}
          placeholder={t("friendship.titlePlaceholder")}
          style={{ width: "100%", marginBottom: 8, fontSize: 14, fontWeight: 800 }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button type="button" className="ui-btn ui-btn--primary" style={{ flex: 1 }} onClick={handlePropose}>
            <Tr id="friendship.titleSubmit" />
          </button>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={handleSkip}>
            <Tr id="friendship.titleSkip" />
          </button>
        </div>
        {msg && <div style={{ fontSize: 11, color: "#FFD740", fontWeight: 700 }}>{msg}</div>}
        <button type="button" className="ui-btn ui-btn--secondary" style={{ width: "100%", marginTop: 8 }} onClick={onClose}>
          <Tr id="common.cancel" />
        </button>
      </div>
    </div>
  );
}

function ProposalBox({ label, text, match }: { label: string; text: string; match: boolean }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: "rgba(0,0,0,0.35)",
        border: match ? "1px solid #FFD740" : "1px solid rgba(255,255,255,0.15)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>{label}</div>
      <div className="friendship-title-shimmer" style={{ fontSize: 13, fontWeight: 900 }}>{text}</div>
    </div>
  );
}
