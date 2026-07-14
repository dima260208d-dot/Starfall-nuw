/** Крупный счётчик команд / врагов (вместо миникарты). */
import { useEffect, useRef } from "react";
import type { GameMode, ShowdownFormat } from "../App";
import { useI18n } from "../i18n";
import { getDevBattleMonsters } from "../utils/devBattleMonsters";

interface Brawler { alive: boolean; team?: string; }
interface GameInstance {
  player: Brawler & { team?: string };
  bots?: Brawler[];
  enemies?: Brawler[];
  over: boolean;
}

interface Props {
  gameRef: React.RefObject<GameInstance | null>;
  mode: GameMode;
  showdownFormat?: ShowdownFormat;
}

function countAliveTeams(fighters: Brawler[]): number {
  const teams = new Set<string>();
  for (const f of fighters) if (f.alive && f.team) teams.add(f.team);
  return teams.size;
}

function countAliveEnemies(fighters: Brawler[], playerTeam: string | undefined): number {
  if (!playerTeam) return fighters.filter((f) => f.alive).length;
  return fighters.filter((f) => f.alive && f.team !== playerTeam).length;
}

export default function BattleSurvivorHud({ gameRef, mode, showdownFormat = "solo" }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const useTeamCount = mode === "showdown" && (showdownFormat === "duo" || showdownFormat === "trio");
  const showCounter = mode === "showdown" || mode === "megashowdown" || useTeamCount
    || mode === "bounty" || mode === "gemgrab" || mode === "crystals";

  useEffect(() => {
    if (!showCounter) return;
    const id = setInterval(() => {
      const g = gameRef.current;
      const el = ref.current;
      if (!g || !el || g.over) return;
      const all: Brawler[] = [g.player, ...(g.bots ?? [])];
      let value: number;
      if (useTeamCount) {
        value = countAliveTeams(all);
      } else if (mode === "siege" || mode === "training" || mode === "bossraid" || mode === "monsterInvasion") {
        const devCount = getDevBattleMonsters().filter((m) => m.alive).length;
        const bossCount = mode === "bossraid" ? (g.enemies ?? []).filter((b) => b.alive).length : 0;
        value = devCount + bossCount;
      } else {
        value = countAliveEnemies(g.enemies?.length ? g.enemies : all, g.player.team);
      }
      el.textContent = useTeamCount
        ? t("hud.teamsLeft", { count: value })
        : t("hud.enemiesLeft", { count: value });
    }, 250);
    return () => clearInterval(id);
  }, [gameRef, mode, useTeamCount, showCounter, t]);

  if (!showCounter) return null;

  return (
    <div style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 11,
      pointerEvents: "none",
      padding: "10px 16px",
      borderRadius: 12,
      background: "rgba(0,0,0,0.78)",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
    }}>
      <div
        ref={ref}
        style={{
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "0.04em",
          color: useTeamCount ? "#FFD54F" : "#FF7777",
          lineHeight: 1.1,
        }}
      >
        {useTeamCount ? t("hud.teamsDash") : t("hud.enemiesDash")}
      </div>
    </div>
  );
}
