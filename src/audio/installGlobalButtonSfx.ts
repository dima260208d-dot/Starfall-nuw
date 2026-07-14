import { playButtonSfx } from "./gameSfxService";

/** UI click SFX — all buttons except in-battle. */
export function installGlobalButtonSfx(isBattleScreen: () => boolean): () => void {
  const onClick = (e: MouseEvent) => {
    if (isBattleScreen()) return;
    const t = e.target as HTMLElement;
    if (!t.closest('button, .ui-btn, [role="button"]')) return;
    playButtonSfx();
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
