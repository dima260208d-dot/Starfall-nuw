import { friendshipProgress } from "../../data/friendshipLevels";
import { getFriendshipBond } from "../../utils/social/friendship";
import { useI18n } from "../../i18n";
import { Tr } from "../../i18n/Tr";
import VolProgressTrack from "../ui/VolProgressTrack";

export default function FriendshipBondBar({ friendPlayerId }: { friendPlayerId: string }) {
  const { t } = useI18n();
  const bond = getFriendshipBond(friendPlayerId);
  const { level, pct, currentXp, nextLevelXp } = friendshipProgress(bond.xp);

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: "#FFD740" }}>
          <Tr id="friendship.levelShort" params={{ level: String(level) }} />
        </span>
        {nextLevelXp != null && (
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
            {currentXp}/{nextLevelXp} <Tr id="friendship.xp" />
          </span>
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <VolProgressTrack
          fitHeight={14}
          fill={pct}
          fillBackground="linear-gradient(90deg, #FFD740, #FF8F00)"
        />
      </div>
    </div>
  );
}
