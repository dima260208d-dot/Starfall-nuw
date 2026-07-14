import type { CSSProperties } from "react";
import type { GiftItem } from "../../utils/gifts";
import { CHESTS } from "../../utils/chests";
import { PETS } from "../../entities/PetData";
import { BRAWLERS } from "../../entities/BrawlerData";
import { getCollectiblePin } from "../../entities/CollectiblePinData";
import { CoinIcon, GemIcon, PowerIcon } from "../GameIcons";
import PetSvg from "../PetSvg";
import PinIcon from "../PinIcon";
import Chest3DViewer from "../Chest3DViewer";
import BrawlerViewer3D from "../BrawlerViewer3D";
import { getProfileIconShopThumb } from "../../utils/profileIconUtils";

function chip(color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: `${color}1A`,
    border: `1px solid ${color}55`,
    borderRadius: 8,
    padding: "4px 8px",
    fontSize: 10,
    fontWeight: 800,
    color: "white",
    whiteSpace: "nowrap",
  };
}

export default function GiftItemBadge({ item, compact }: { item: GiftItem; compact?: boolean }) {
  const iconBox = compact ? 20 : 24;

  if (item.kind === "coins") {
    return (
      <span style={chip("#FFD700")}>
        <CoinIcon size={12} /> +{item.amount}
      </span>
    );
  }
  if (item.kind === "gems") {
    return (
      <span style={chip("#40C4FF")}>
        <GemIcon size={12} /> +{item.amount}
      </span>
    );
  }
  if (item.kind === "powerPoints") {
    return (
      <span style={chip("#CE93D8")}>
        <PowerIcon size={12} /> +{item.amount}
      </span>
    );
  }
  if (item.kind === "chest") {
    const c = CHESTS[item.rarity];
    return (
      <span style={{ ...chip(c.color), padding: "4px 8px" }}>
        <span style={{ width: iconBox, height: iconBox, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Chest3DViewer rarity={item.rarity} size={iconBox - 2} />
        </span>
        {c.shortName}{item.count > 1 ? ` ×${item.count}` : ""}
      </span>
    );
  }
  if (item.kind === "pet") {
    const p = PETS.find(x => x.id === item.petId);
    if (!p) return null;
    return (
      <span style={{ ...chip(p.color), padding: "2px 8px 2px 4px" }}>
        <PetSvg pet={p} size={20} animated={false} haloPulse={false} /> {p.name}
      </span>
    );
  }
  if (item.kind === "brawler") {
    const b = BRAWLERS.find(x => x.id === item.brawlerId);
    if (!b) return null;
    const preview = compact ? 40 : 52;
    return (
      <span style={{ ...chip(b.color), padding: "2px 6px 2px 2px", flexDirection: "column", alignItems: "center", minWidth: preview + 8 }}>
        <span style={{ width: preview, height: preview, display: "block", overflow: "hidden", borderRadius: 8 }}>
          <BrawlerViewer3D brawlerId={b.id} color={b.color} size={preview} efficientPreview pixelRatioCap={1} />
        </span>
        <span style={{ fontSize: 9, marginTop: 2 }}>{b.name}</span>
      </span>
    );
  }
  if (item.kind === "pin") {
    const def = getCollectiblePin(item.pinId);
    return (
      <span style={{ ...chip(def?.color ?? "#CE93D8"), padding: "4px 6px", justifyContent: "center" }}>
        <PinIcon pinId={item.pinId} size={compact ? 36 : 44} animated={false} />
      </span>
    );
  }
  if (item.kind === "profileIcon") {
    return (
      <span style={{ ...chip("#CE93D8"), padding: "2px 6px" }}>
        <img
          src={getProfileIconShopThumb(item.iconId)}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          decoding="async"
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return null;
}
