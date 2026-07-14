import { type Club } from "../utils/clubs";
import { DEFAULT_PROFILE_ICON_ID } from "../data/profileIcons";
import { getProfileIconImage } from "../utils/profileIconUtils";

interface Props {
  club: Pick<Club, "name" | "avatarDataUrl" | "avatarProfileIconId">;
  size?: number;
  showBorder?: boolean;
}

export default function ClubAvatar({ club, size = 56, showBorder = true }: Props) {
  const borderStyle = showBorder ? "2px solid rgba(255,255,255,0.25)" : "none";
  const boxShadow = showBorder ? "0 4px 12px rgba(0,0,0,0.4)" : "none";
  const radius = size * 0.18;
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  if (club.avatarDataUrl) {
    return (
      <img
        src={club.avatarDataUrl}
        alt={club.name}
        style={{
          width: size, height: size,
          borderRadius: radius,
          objectFit: "cover",
          border: borderStyle,
          boxShadow,
        }}
      />
    );
  }

  const iconId = club.avatarProfileIconId || DEFAULT_PROFILE_ICON_ID;
  const src = getProfileIconImage(iconId, base);
  return (
    <img
      src={src}
      alt={club.name}
      style={{
        width: size, height: size,
        borderRadius: radius,
        objectFit: "cover",
        border: borderStyle,
        boxShadow,
      }}
    />
  );
}
