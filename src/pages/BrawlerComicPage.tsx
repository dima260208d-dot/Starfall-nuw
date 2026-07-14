import { useEffect, useState } from "react";
import { BRAWLERS, BRAWLER_LORE } from "../entities/BrawlerData";
import { getBrawlerRank, getBrawlerTrophies, getCurrentProfile, MAX_BRAWLER_RANK } from "../utils/localStorageAPI";
import { getBrawlerComic, type BrawlerComicChapter } from "../data/brawlerComics";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import BrawlerRankBar from "../components/BrawlerRankBar";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import BrawlerSquareIcon from "../components/ranked/BrawlerSquareIcon";
import { brawlerName } from "../i18n";
import { EmojiIcon } from "../components/EmojiIcon";
import { playComicPageSfx } from "../audio/gameSfxService";

interface Props {
  brawlerId: string;
  onBack: () => void;
}

function lockedText(chapter: BrawlerComicChapter, rank: number): string {
  return rank >= chapter.unlockRank
    ? "Открыто"
    : `Откроется на ранге ${chapter.unlockRank}`;
}

function ComicImage({
  title,
  assetPath,
  primary,
  accent,
  onZoom,
}: {
  title: string;
  assetPath: string;
  primary: string;
  secondary: string;
  accent: string;
  onZoom: (src: string, title: string) => void;
}) {
  const [missing, setMissing] = useState(false);
  const [pageRatio, setPageRatio] = useState<number | null>(null);

  useEffect(() => {
    setMissing(false);
    setPageRatio(null);
  }, [assetPath]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: pageRatio ?? 2 / 3,
        borderRadius: 0,
        overflow: "hidden",
        background: missing ? `
          radial-gradient(circle at 25% 20%, ${accent}cc 0%, transparent 26%),
          radial-gradient(circle at 80% 12%, rgba(255,255,255,0.52) 0%, transparent 18%),
          radial-gradient(circle at 62% 78%, ${primary}aa 0%, transparent 30%),
          linear-gradient(135deg, ${primary}, #080419 58%, ${primary})
        ` : "transparent",
        border: `1px solid ${accent}66`,
      }}
    >
      {!missing ? (
        <img
          src={assetPath}
          alt={title}
          onError={() => setMissing(true)}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) {
              setPageRatio(naturalWidth / naturalHeight);
            }
          }}
          onClick={() => onZoom(assetPath, title)}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center center",
            cursor: "zoom-in",
          }}
        />
      ) : (
        <>
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(120deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 22px), radial-gradient(circle at 50% 50%, transparent 0 55%, rgba(0,0,0,0.38) 100%)",
            mixBlendMode: "screen",
            opacity: 0.62,
          }} />
          <div style={{
            position: "absolute",
            inset: 18,
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 16,
          }} />
          <div style={{
            position: "absolute",
            left: 26,
            right: 26,
            bottom: 24,
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(5,2,18,0.72)",
            border: "1px solid rgba(255,255,255,0.16)",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 1000, letterSpacing: 1, color: "#fff" }}>
              {title}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.72)" }}>
              Файл ещё не сгенерирован: {assetPath}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ZoomOverlay({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        padding: 24,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "min(96vw, 980px)",
          height: "min(92vh, 1280px)",
          borderRadius: 22,
          background: "#05020d",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.68)",
          overflow: "hidden",
        }}
      >
        <img
          src={src}
          alt={title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="ui-btn ui-btn--ghost"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(0,0,0,0.58)",
            color: "#fff",
          }}
        >
          Закрыть
        </button>
        <div style={{
          position: "absolute",
          left: 16,
          right: 80,
          bottom: 14,
          padding: "10px 12px",
          borderRadius: 14,
          background: "rgba(0,0,0,0.58)",
          color: "#fff",
          fontWeight: 900,
        }}>
          {title}
        </div>
      </div>
    </div>
  );
}

export default function BrawlerComicPage({ brawlerId, onBack }: Props) {
  const profile = getCurrentProfile();
  const brawler = BRAWLERS.find(b => b.id === brawlerId) || BRAWLERS[0];
  const comic = getBrawlerComic(brawler.id);
  const plotSummary = BRAWLER_LORE[brawler.id] ?? brawler.description;
  const trophies = getBrawlerTrophies(profile, brawler.id);
  const rank = getBrawlerRank(trophies);
  const firstUnlockedIndex = Math.max(0, comic.chapters.findLastIndex(ch => rank >= ch.unlockRank));
  const [chapterIndex, setChapterIndex] = useState(firstUnlockedIndex);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoomImage, setZoomImage] = useState<{ src: string; title: string } | null>(null);

  const chapter = comic.chapters[chapterIndex] ?? comic.chapters[0];
  const unlocked = rank >= chapter.unlockRank;
  const page = chapter.pages[pageIndex] ?? chapter.pages[0];
  const pageAssetPath = unlocked
    ? page.assetPath
    : comic.coverAssetPath;
  const pageTitle = unlocked
    ? `Глава ${chapter.chapter}, стр. ${page.page}`
    : comic.title;

  const selectChapter = (idx: number) => {
    setChapterIndex(idx);
    setPageIndex(0);
  };

  const goToPage = (idx: number) => {
    setPageIndex(prev => {
      if (prev === idx) return prev;
      playComicPageSfx();
      return idx;
    });
  };

  const maxUnlockedChapter = comic.chapters.filter(ch => rank >= ch.unlockRank).length;
  const progressPct = Math.min(100, Math.round((maxUnlockedChapter / comic.chapters.length) * 100));

  return (
    <PageBg variant="comics">
      <PageHeader title={`Комикс: ${brawlerName(brawler.id, brawler.name)}`} onBack={onBack} transparent />
      <PageBody style={{ padding: "12px 18px 20px", minHeight: 0 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 300px) minmax(0, 1fr)",
          gap: 16,
          minHeight: 0,
          height: "100%",
          maxWidth: 1280,
          margin: "0 auto",
          alignItems: "start",
        }}>
          <aside style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
            <div className="ui-glass" style={{
              borderRadius: 0,
              padding: 12,
              border: `1px solid ${comic.palette.accent}66`,
              background: "linear-gradient(160deg, rgba(20,8,42,0.82), rgba(7,2,18,0.9))",
              boxShadow: "var(--sh-md)",
              width: "100%",
              aspectRatio: "1 / 1",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxSizing: "border-box",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                <BrawlerSquareIcon
                  brawlerId={brawler.id}
                  size={72}
                  static
                  showMeta={false}
                  showName={false}
                  overlay="none"
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 1000, color: "#fff", lineHeight: 1.1 }}>{comic.title}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.68)", lineHeight: 1.3 }}>{comic.subtitle}</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <BrawlerRankBar brawlerId={brawler.id} trophies={trophies} layout="compact" />
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <VolProgressTrack
                  fitHeight={16}
                  fill={progressPct}
                  fillBackground={`linear-gradient(90deg, ${comic.palette.primary}, ${comic.palette.accent})`}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>{maxUnlockedChapter}/10</span>
              </div>
              <div style={{
                marginTop: "auto",
                paddingTop: 10,
                fontSize: 11,
                color: "rgba(255,255,255,0.58)",
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {plotSummary}
              </div>
            </div>

            <div className="quest-scroll" style={{ overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
              {comic.chapters.map((ch, idx) => {
                const isOpen = rank >= ch.unlockRank;
                const active = idx === chapterIndex;
                return (
                  <button
                    key={ch.chapter}
                    type="button"
                    onClick={() => selectChapter(idx)}
                    className="ui-glass"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "block",
                      marginBottom: 8,
                      padding: "11px 12px",
                      borderRadius: 16,
                      cursor: "pointer",
                      opacity: isOpen ? 1 : 0.58,
                      background: active
                        ? `linear-gradient(135deg, ${comic.palette.primary}55, rgba(10,4,28,0.9))`
                        : "rgba(255,255,255,0.07)",
                      border: active ? `1px solid ${comic.palette.accent}` : "1px solid rgba(255,255,255,0.12)",
                      color: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 1000 }}>Глава {ch.chapter}. {ch.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 900, color: isOpen ? "#A5D6A7" : "#FFE082" }}>
                        {isOpen ? "Открыта" : `Ранг ${ch.unlockRank}`}
                      </span>
                    </div>
                    <div style={{ marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.35 }}>
                      {ch.summary}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="quest-scroll" style={{ minHeight: 0, overflowY: "auto", paddingRight: 6, minWidth: 0 }}>
            <section className="ui-glass" style={{
              borderRadius: 0,
              padding: 12,
              background: "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(9,3,24,0.82))",
              border: `1px solid ${unlocked ? comic.palette.accent + "66" : "rgba(255,255,255,0.15)"}`,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8, flexShrink: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: comic.palette.accent, letterSpacing: 1.2, textTransform: "uppercase" }}>
                    {lockedText(chapter, rank)}
                  </div>
                  <h2 style={{ margin: "2px 0 0", color: "#fff", fontSize: 22, lineHeight: 1.05 }}>
                    Глава {chapter.chapter}: {chapter.title}
                  </h2>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 800, flexShrink: 0 }}>
                  Ранг {rank}/{MAX_BRAWLER_RANK}<br />
                  Страница {pageIndex + 1}/{chapter.pages.length}
                </div>
              </div>

              {unlocked ? (
                <>
                  <ComicImage
                    title={pageTitle}
                    assetPath={pageAssetPath}
                    primary={comic.palette.primary}
                    secondary={comic.palette.secondary}
                    accent={comic.palette.accent}
                    onZoom={(src, title) => setZoomImage({ src, title })}
                  />
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="ui-btn ui-btn--ghost"
                      disabled={pageIndex <= 0}
                      onClick={() => goToPage(Math.max(0, pageIndex - 1))}
                    >
                      ← Назад
                    </button>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
                      {chapter.pages.map((p, idx) => (
                        <button
                          key={p.page}
                          type="button"
                          aria-label={`Страница ${p.page}`}
                          onClick={() => goToPage(idx)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 9,
                            border: idx === pageIndex ? `2px solid ${comic.palette.accent}` : "1px solid rgba(255,255,255,0.18)",
                            background: idx === pageIndex ? `${comic.palette.primary}aa` : "rgba(255,255,255,0.08)",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          {p.page}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="ui-btn ui-btn--primary"
                      disabled={pageIndex >= chapter.pages.length - 1}
                      onClick={() => goToPage(Math.min(chapter.pages.length - 1, pageIndex + 1))}
                    >
                      Вперёд →
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  marginTop: 16,
                  minHeight: 300,
                  borderRadius: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: 24,
                  background: "linear-gradient(145deg, rgba(0,0,0,0.54), rgba(80,60,90,0.28))",
                  border: "1px dashed rgba(255,255,255,0.24)",
                  color: "rgba(255,255,255,0.72)",
                }}>
                  <div>
                    <div style={{ fontSize: 44, marginBottom: 10 }}><EmojiIcon emoji="🔒" size={24} /></div>
                    <div style={{ fontSize: 19, fontWeight: 1000, color: "#fff" }}>Глава пока закрыта</div>
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      Наберите ранг {chapter.unlockRank} этим бойцом, чтобы открыть 10 страниц главы.
                    </div>
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </PageBody>
      {zoomImage && (
        <ZoomOverlay
          src={zoomImage.src}
          title={zoomImage.title}
          onClose={() => setZoomImage(null)}
        />
      )}
    </PageBg>
  );
}

