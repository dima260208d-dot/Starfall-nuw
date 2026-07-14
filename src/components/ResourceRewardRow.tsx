import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";

export type ResourceRewardItem =
  | { type: "coins"; amount: number }
  | { type: "gems"; amount: number }
  | { type: "power"; amount: number };

export default function ResourceRewardRow({
  items,
  iconSize = 48,
}: {
  items: ResourceRewardItem[];
  iconSize?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
        minHeight: iconSize + 8,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          {item.type === "coins" && <CoinIcon size={iconSize} static />}
          {item.type === "gems" && <GemIcon size={iconSize} static />}
          {item.type === "power" && <PowerIcon size={iconSize} static />}
          <span
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: "rgba(255,255,255,0.92)",
              textShadow: "0 1px 4px rgba(0,0,0,0.75)",
            }}
          >
            +{item.amount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
