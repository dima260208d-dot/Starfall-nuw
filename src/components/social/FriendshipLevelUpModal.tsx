import { rewardForFriendshipLevel } from "../../data/friendshipLevels";
import { useI18n } from "../../i18n";
import { EmojiIcon } from "../EmojiIcon";
import { Tr } from "../../i18n/Tr";
import type { FriendshipLevelUpNotice } from "../../utils/social/friendship";

export default function FriendshipLevelUpModal({
  notice,
  onClose,
}: {
  notice: FriendshipLevelUpNotice;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const reward = rewardForFriendshipLevel(notice.level);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.72)",
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
          background: "linear-gradient(160deg, rgba(35,18,70,0.98), rgba(8,4,24,0.99))",
          border: "2px solid rgba(255,215,64,0.55)",
          borderRadius: 16,
          padding: 20,
          maxWidth: 340,
          width: "100%",
          textAlign: "center",
          color: "#fff",
          boxShadow: "0 0 40px rgba(255,215,64,0.25)",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}><EmojiIcon emoji="🤝" size={28} /></div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#FFD740", marginBottom: 4 }}>
          {t("friendship.levelUpTitle")}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>
          {t("friendship.levelUpWith", { name: notice.friendUsername, level: String(notice.level) })}
        </div>
        {reward && (
          <div
            style={{
              background: "rgba(0,0,0,0.35)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.6,
            }}
          >
            {reward.coins ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><EmojiIcon emoji="🪙" size={24} /> +{reward.coins}</div> : null}
            {reward.gems ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><EmojiIcon emoji="💎" size={24} /> +{reward.gems}</div> : null}
            {reward.chest ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><EmojiIcon emoji="📦" size={24} /> {t(`chest.def.${reward.chest}.shortName`)}</div> : null}
            {reward.powerPoints ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><EmojiIcon emoji="⚡" size={24} /> +{reward.powerPoints} {t("common.powerPoints")}</div> : null}
            {reward.exclusiveTitleId ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}><EmojiIcon emoji="🏷" size={24} /> {t("exclusiveTitle.oldFriend")}</div> : null}
          </div>
        )}
        <button type="button" className="ui-btn ui-btn--primary" onClick={onClose} style={{ width: "100%" }}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
