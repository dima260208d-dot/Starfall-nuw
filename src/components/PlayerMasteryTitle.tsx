import type { CSSProperties } from "react";
import { getMasteryTitleText } from "../data/brawlerMastery";
import { DEVELOPER_TITLE_ID, exclusiveTitleI18nKey, isExclusiveTitleId } from "../data/exclusiveTitles";
import { useI18n } from "../i18n";
import { MASTERY_TITLE_STYLE } from "../utils/brawlerMasteryUI";

interface Props {
  titleId?: string | null;
  text?: string | null;
  fontSize?: number;
  style?: CSSProperties;
  /** Golden friendship bond title (custom text). */
  friendship?: boolean;
}

export default function PlayerMasteryTitle({ titleId, text, fontSize = 12, style, friendship }: Props) {
  const { t } = useI18n();
  let label = text ?? null;
  if (!label && titleId) {
    if (isExclusiveTitleId(titleId)) {
      const key = exclusiveTitleI18nKey(titleId);
      label = key ? t(key) : getMasteryTitleText(titleId);
    } else {
      label = getMasteryTitleText(titleId);
    }
  }
  if (!label) return null;
  const isDeveloper = titleId === DEVELOPER_TITLE_ID;
  const shimmerClass = friendship
    ? "friendship-title-shimmer"
    : isDeveloper
      ? "developer-title-shimmer"
      : "mastery-title-shimmer";
  return (
    <div
      className={shimmerClass}
      style={{
        ...MASTERY_TITLE_STYLE,
        fontSize,
        lineHeight: 1.25,
        textAlign: "center",
        maxWidth: "100%",
        ...(isDeveloper ? { letterSpacing: 1.1, textTransform: "uppercase" as const } : {}),
        ...style,
      }}
    >
      {label}
    </div>
  );
}
