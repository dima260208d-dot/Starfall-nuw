import { CHESTS } from "../utils/chests";
import {
  DAILY_WINS_SLOT_COUNT,
  getDailyWinsDayLabel,
  type DailyWinsDayType,
  type DailyWinsSlot,
} from "../utils/dailyWins";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import ChestVisual from "./ChestVisual";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

const DAILY_WINS_CHECK_ICON = `${(import.meta as any).env?.BASE_URL ?? "/"}ui/daily-wins-check.png`;

interface Props {
  dayType: DailyWinsDayType;
  slots: DailyWinsSlot[];
  claimedCount: number;
  compact?: boolean;
}

function DailyWinChestPreview({ rarity, compact }: { rarity: NonNullable<DailyWinsSlot["chestRarity"]>; compact?: boolean }) {
  const renderSize = compact ? 32 : 40;
  const slotFootprint = compact ? 20 : 24;
  return (
    <div
      style={{
        width: slotFootprint,
        height: slotFootprint,
        position: "relative",
        overflow: "visible",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, calc(-50% - 4px))",
          pointerEvents: "none",
        }}
      >
        <ChestVisual rarity={rarity} size={renderSize} animated={false} />
      </div>
    </div>
  );
}

function slotPreview(slot: DailyWinsSlot, size: number, compact?: boolean) {
  if (slot.type === "chest" && slot.chestRarity) {
    return <DailyWinChestPreview rarity={slot.chestRarity} compact={compact} />;
  }
  if (slot.type === "gems") return <GemIcon size={size} />;
  if (slot.type === "powerPoints") return <PowerIcon size={size} />;
  return <CoinIcon size={size} />;
}

/** Двойная награда (×2 сундук, удвоённые ресурсы в мегасчастливый день). */
function isDoubleDailyWinReward(slot: DailyWinsSlot): boolean {
  return slot.amount > 1;
}

function shouldShowAmountLabel(slot: DailyWinsSlot): boolean {
  if (isDoubleDailyWinReward(slot)) return true;
  if (slot.type === "chest") return false;
  return true;
}

function slotAmountLabel(slot: DailyWinsSlot): string {
  if (slot.type === "chest" && slot.chestRarity && slot.amount > 1) {
    return `×${slot.amount}`;
  }
  return String(slot.amount);
}

const DAY_ACCENT: Record<DailyWinsDayType, string> = {
  normal: "#9E9E9E",
  lucky: "#FFD54F",
  megaLucky: "#FF6D00",
};

export default function DailyWinsStrip({ dayType, slots, claimedCount, compact }: Props) {
  const { t } = useI18n();
  const accent = DAY_ACCENT[dayType];
  const cellW = compact ? 26 : 32;
  const iconSize = compact ? 14 : 18;

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 10,
        background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 100%)",
        border: `1px solid ${accent}66`,
        boxShadow: `0 4px 18px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.08)`,
        overflow: "visible",
      }}
    >
      <div style={{
        textAlign: "center",
        fontSize: compact ? 8 : 9,
        fontWeight: 900,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: accent,
        padding: compact ? "4px 6px" : "5px 8px",
        borderBottom: `1px solid ${accent}44`,
        background: `linear-gradient(90deg, ${accent}18, transparent, ${accent}18)`,
      }}>
        <Tr id="dailyWins.title" params={{ day: getDailyWinsDayLabel(dayType) }} />
      </div>
      <div style={{
        display: "flex",
        flexWrap: "nowrap",
        gap: 3,
        padding: compact ? "5px 6px" : "6px 8px",
        justifyContent: "center",
        overflow: "visible",
      }}>
        {slots.slice(0, DAILY_WINS_SLOT_COUNT).map((slot, i) => {
          const claimed = i < claimedCount;
          const current = i === claimedCount;
          const chestColor = slot.chestRarity ? CHESTS[slot.chestRarity].color : accent;
          const showAmount = shouldShowAmountLabel(slot);
          const isChestSlot = slot.type === "chest" && !showAmount;
          const cellIconSize = showAmount ? iconSize : (compact ? 22 : 28);
          return (
            <div
              key={i}
              title={claimed ? t("dailyWins.claimed") : current ? t("dailyWins.next") : t("dailyWins.pending")}
              style={{
                width: cellW,
                minWidth: cellW,
                minHeight: showAmount ? undefined : (compact ? 30 : 36),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: showAmount || claimed ? 2 : 0,
                padding: showAmount ? "3px 2px" : "4px 2px",
                borderRadius: 6,
                overflow: isChestSlot ? "visible" : undefined,
                background: claimed
                  ? "rgba(76,175,80,0.25)"
                  : current
                    ? `linear-gradient(180deg, ${accent}44, ${accent}18)`
                    : "rgba(255,255,255,0.06)",
                border: claimed
                  ? "1px solid rgba(129,199,132,0.65)"
                  : current
                    ? `1px solid ${accent}`
                    : "1px solid rgba(255,255,255,0.12)",
                boxShadow: current ? `0 0 10px ${accent}88` : undefined,
                opacity: claimed ? 0.85 : 1,
              }}
            >
              <div style={{
                filter: claimed ? "grayscale(0.2)" : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: isChestSlot ? (compact ? 22 : 26) : showAmount ? cellIconSize + 2 : cellIconSize,
                flex: showAmount ? undefined : 1,
                overflow: "visible",
              }}>
                {slotPreview(slot, cellIconSize, compact)}
              </div>
              {(showAmount || claimed) && (
                <span style={{
                  fontSize: compact ? 7 : 8,
                  fontWeight: 900,
                  color: claimed ? "#A5D6A7" : chestColor,
                  lineHeight: 1,
                }}>
                  {claimed ? (
                    <img
                      src={DAILY_WINS_CHECK_ICON}
                      alt=""
                      draggable={false}
                      className="ui-game-icon"
                      style={{ width: compact ? 10 : 12, height: compact ? 10 : 12, objectFit: "contain" }}
                    />
                  ) : slotAmountLabel(slot)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
