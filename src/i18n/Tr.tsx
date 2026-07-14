import { TextWithEmojis } from "../components/EmojiIcon";
import { useI18n } from "./I18nProvider";
import type { TranslateParams } from "./core";
import type { CSSProperties, ReactNode } from "react";

export interface TrProps {
  id: string;
  params?: TranslateParams;
  fallback?: string;
  emojiSize?: number;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}

/** Localized string with emoji rendered as raster PNG icons. */
export function Tr({ id, params, fallback, emojiSize = 27, style, className }: TrProps) {
  const { t } = useI18n();
  return (
    <TextWithEmojis
      text={t(id, params, fallback)}
      emojiSize={emojiSize}
      style={style}
      className={className}
    />
  );
}
