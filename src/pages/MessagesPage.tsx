import { useEffect, useMemo, useRef, useState } from "react";
import { PageBg, PageBody, PageHeader, PageToolbar } from "../components/PageChrome";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { PROFILE_CLOUD_CHANGED } from "../utils/cloud/profileCloud";
import {
  getInboxMessages,
  getMyThreads,
  getThreadById,
  markInboxRead,
  markAllInboxRead,
  sendFeedbackToDevelopers,
  playerReplyToThread,
  fileToFeedbackImage,
  FEEDBACK_CATEGORIES,
  MAX_FEEDBACK_SUBJECT,
  MAX_FEEDBACK_TEXT,
  getFeedbackCategoryInfo,
  type InboxMessage,
  type FeedbackCategory,
  type FeedbackThread,
  type ThreadMessage,
} from "../utils/messages";
import {
  FEEDBACK_SYNC_EVENT,
  startFeedbackCloudPoll,
} from "../utils/feedbackCloud";
import { getCurrentUsername } from "../utils/localStorageAPI";
import { getPendingGifts, claimGift, describeGiftItem, getGiftSenderTitle, type PendingGift } from "../utils/gifts";
import {
  claimMapRewardInbox,
  isMapRewardMessage,
  parseMapRewardMessage,
  type MapRewardInboxPayload,
} from "../utils/playerMaps/playerMapRewards";
import RewardDropQueue from "../components/RewardDropQueue";
import BrawlerRevealModal from "../components/BrawlerRevealModal";
import PetRevealModal from "../components/PetRevealModal";
import { rewardInfosFromGiftItems } from "../utils/shopRewards";
import type { RewardInfo } from "../components/RewardDropModal";
import { useI18n } from "../i18n";
import { EmojiIcon, TextWithEmojis } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  onBack: () => void;
}

type Tab = "fromDev" | "sent" | "compose";

export default function MessagesPage({ onBack }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("fromDev");
  const [inbox, setInbox] = useState(() => getInboxMessages());
  const [threads, setThreads] = useState(() => getMyThreads());
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(inbox[0]?.id ?? null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rewardQueue, setRewardQueue] = useState<RewardInfo[] | null>(null);
  const [revealBrawler, setRevealBrawler] = useState<string | null>(null);
  const [revealPet, setRevealPet] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setInbox(getInboxMessages());
    setThreads(getMyThreads());
  };

  useEffect(() => {
    const onProfile = () => refresh();
    window.addEventListener("clash-profile-local-changed", onProfile);
    window.addEventListener(PROFILE_CLOUD_CHANGED, onProfile);
    return () => {
      window.removeEventListener("clash-profile-local-changed", onProfile);
      window.removeEventListener(PROFILE_CLOUD_CHANGED, onProfile);
    };
  }, []);

  useEffect(() => {
    const username = getCurrentUsername();
    const stopPoll = startFeedbackCloudPoll(username, 12_000);
    const onSync = () => refresh();
    window.addEventListener(FEEDBACK_SYNC_EVENT, onSync);
    return () => {
      stopPoll();
      window.removeEventListener(FEEDBACK_SYNC_EVENT, onSync);
    };
  }, []);

  const selectedInbox = useMemo(
    () => inbox.find(m => m.id === selectedInboxId) ?? null,
    [inbox, selectedInboxId],
  );

  const selectedThread = useMemo(
    () => (selectedThreadId ? getThreadById(selectedThreadId) : null) ?? threads[0] ?? null,
    [selectedThreadId, threads],
  );

  const openInbox = (m: InboxMessage) => {
    setSelectedInboxId(m.id);
    if (!m.read) {
      markInboxRead(m.id);
      refresh();
    }
    if (m.threadId) {
      setSelectedThreadId(m.threadId);
    }
  };

  const openThread = (t: FeedbackThread) => {
    setSelectedThreadId(t.id);
    setReplyText("");
  };

  const lastDevMessage = selectedThread
    ? [...selectedThread.messages].reverse().find(m => m.from === "dev")
    : null;
  const canReplyToThread = !!lastDevMessage;

  const handleClaimGift = () => {
    if (!selectedInbox?.giftId || busy) return;
    setBusy(true);
    const r = claimGift(selectedInbox.giftId);
    if (r.success && r.gift) {
      refresh();
      const brawler = r.gift.items.find(i => i.kind === "brawler");
      const pet = r.gift.items.find(i => i.kind === "pet");
      if (brawler && brawler.kind === "brawler") setRevealBrawler(brawler.brawlerId);
      else if (pet && pet.kind === "pet") setRevealPet(pet.petId);
      else setRewardQueue(rewardInfosFromGiftItems(r.gift.items));
    } else {
      setMsg(r.error ?? t("messages.claimFailed"));
      setTimeout(() => setMsg(null), 2500);
    }
    setBusy(false);
  };

  const handleSendNew = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const attachment = imageData
      ? { kind: "image" as const, url: imageData }
      : link.trim()
        ? { kind: "link" as const, url: link.trim() }
        : undefined;
    if (!category) {
      setBusy(false);
      setMsg(t("messages.pickCategory"));
      return;
    }
    const r = sendFeedbackToDevelopers({ category, subject, text, attachment });
    setBusy(false);
    if (!r.success) {
      setMsg(r.error ?? t("messages.sendFailed"));
      return;
    }
    setCategory("");
    setSubject("");
    setText("");
    setLink("");
    setImageData(null);
    setMsg(t("messages.sentOk"));
    refresh();
    if (r.threadId) setSelectedThreadId(r.threadId);
    setTab("sent");
    setTimeout(() => setMsg(null), 3000);
  };

  const handleThreadReply = () => {
    if (!selectedThread || busy) return;
    setBusy(true);
    const r = playerReplyToThread(selectedThread.id, { text: replyText });
    setBusy(false);
    if (!r.success) {
      setMsg(r.error ?? t("messages.replyFailed"));
      return;
    }
    setReplyText("");
    setMsg(t("messages.replySent"));
    refresh();
    setTimeout(() => setMsg(null), 2500);
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    try {
      setImageData(await fileToFeedbackImage(file));
      setLink("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("messages.uploadFailed"));
    }
  };

  const unreadInbox = inbox.filter(m => !m.read).length;
  const profile = getCurrentProfile();
  const pendingGift = selectedInbox?.giftId && !isMapRewardMessage(selectedInbox)
    ? getPendingGifts().find(g => g.id === selectedInbox.giftId)
    : null;

  const selectedMapReward = useMemo(() => {
    if (!selectedInbox || !isMapRewardMessage(selectedInbox)) return null;
    const payload = parseMapRewardMessage(selectedInbox.body);
    if (!payload || payload.claimed) return null;
    return payload;
  }, [selectedInbox]);

  const handleClaimMapReward = () => {
    if (!selectedInbox || !selectedMapReward || busy) return;
    setBusy(true);
    const ok = claimMapRewardInbox(selectedInbox.id);
    if (ok) {
      refresh();
      const p = selectedMapReward;
      const rewards: RewardInfo[] = [];
      if (p.bundle.coins) rewards.push({ type: "coins", amount: p.bundle.coins, label: t("messages.mapRewardCoins", { count: p.bundle.coins }) });
      if (p.bundle.crystals) rewards.push({ type: "gems", amount: p.bundle.crystals, label: t("messages.mapRewardCrystals", { count: p.bundle.crystals }) });
      if (p.bundle.powerPoints) rewards.push({ type: "powerPoints", amount: p.bundle.powerPoints, label: t("messages.mapRewardPowerPoints", { count: p.bundle.powerPoints }) });
      if (rewards.length) setRewardQueue(rewards);
      else setMsg(t("messages.mapRewardClaimed"));
    } else {
      setMsg(t("messages.claimFailed"));
    }
    setBusy(false);
  };

  return (
    <PageBg variant="news" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
      <PageHeader
        onBack={onBack}
        title={t("messages.title")}
        coins={profile?.coins}
        gems={profile?.gems}
        power={profile?.powerPoints}
        right={
          unreadInbox > 0 ? (
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { markAllInboxRead(); refresh(); }} style={{ fontSize: 11 }}>
              <Tr id="messages.markAllRead" />
            </button>
          ) : null
        }
      />
      <PageToolbar style={{ padding: "12px 20px 10px", borderBottom: "1px solid var(--bd-1)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TabBtn active={tab === "fromDev"} onClick={() => setTab("fromDev")}>
            {unreadInbox > 0
              ? t("messages.tab.fromDevUnread", { count: String(unreadInbox) })
              : t("messages.tab.fromDev")}
          </TabBtn>
          <TabBtn active={tab === "sent"} onClick={() => setTab("sent")}>
            <Tr id="messages.tab.sent" params={{ count: String(threads.length) }} />
          </TabBtn>
          <TabBtn active={tab === "compose"} onClick={() => setTab("compose")}><Tr id="messages.tab.compose" /></TabBtn>
        </div>
      </PageToolbar>
      <PageBody style={{ padding: "16px 20px 24px" }}>
        {msg && (
          <div style={{
            marginBottom: 12, padding: "10px 14px", borderRadius: 10,
            background: "rgba(76,175,80,0.15)", border: "1px solid rgba(76,175,80,0.4)",
            fontSize: 13, fontWeight: 700,
          }}>{msg}</div>
        )}

        {tab === "fromDev" && (
          <FromDevPanel
            inbox={inbox}
            selected={selectedInbox}
            pendingGift={pendingGift}
            mapReward={selectedMapReward}
            onSelect={openInbox}
            onClaim={handleClaimGift}
            onClaimMapReward={handleClaimMapReward}
            onOpenThread={(threadId) => { setSelectedThreadId(threadId); setTab("sent"); }}
            busy={busy}
          />
        )}

        {tab === "sent" && (
          <SentPanel
            threads={threads}
            selected={selectedThread}
            onSelect={openThread}
            canReply={canReplyToThread}
            replyText={replyText}
            setReplyText={setReplyText}
            onSendReply={handleThreadReply}
            busy={busy}
          />
        )}

        {tab === "compose" && (
          <ComposePanel
            category={category} setCategory={setCategory}
            subject={subject} setSubject={setSubject}
            text={text} setText={setText}
            link={link} setLink={setLink}
            imageData={imageData} setImageData={setImageData}
            fileRef={fileRef} onPickImage={onPickImage} onSend={handleSendNew} busy={busy}
          />
        )}
      </PageBody>
      {revealBrawler && <BrawlerRevealModal brawlerId={revealBrawler} onDone={() => setRevealBrawler(null)} />}
      {revealPet && <PetRevealModal petId={revealPet} onDone={() => setRevealPet(null)} />}
      {rewardQueue && rewardQueue.length > 0 && (
        <RewardDropQueue rewards={rewardQueue} onDone={() => { setRewardQueue(null); refresh(); }} />
      )}
    </PageBg>
  );
}

function FromDevPanel({ inbox, selected, pendingGift, mapReward, onSelect, onClaim, onClaimMapReward, onOpenThread, busy }: {
  inbox: InboxMessage[];
  selected: InboxMessage | null;
  pendingGift: PendingGift | null | undefined;
  mapReward: MapRewardInboxPayload | null;
  onSelect: (m: InboxMessage) => void;
  onClaim: () => void;
  onClaimMapReward: () => void;
  onOpenThread: (threadId: string) => void;
  busy: boolean;
}) {
  const { t, localeMeta } = useI18n();
  if (!inbox.length) {
    return (
      <div className="ui-card" style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}><EmojiIcon emoji="📭" size={24} /></div>
        <div><Tr id="messages.empty.inbox" /></div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 12, minHeight: 420 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
        {inbox.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m)}
            className="ui-card"
            style={{
              textAlign: "left", padding: "12px 14px", cursor: "pointer",
              border: selected?.id === m.id ? "1px solid rgba(100,181,246,0.6)" : undefined,
              background: selected?.id === m.id ? "rgba(33,150,243,0.12)" : undefined,
              opacity: m.read ? 0.85 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{m.kind === "gift" ? (isMapRewardMessage(m) ? "🗺️" : "🎁") : m.threadId ? "💬" : "📢"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{new Date(m.sentAt).toLocaleString(localeMeta.bcp47)}</div>
              </div>
              {!m.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5252", flexShrink: 0 }} />}
            </div>
          </button>
        ))}
      </div>

      <div className="ui-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {selected ? (
          <>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
                {pendingGift ? getGiftSenderTitle(pendingGift).toUpperCase() : selected.kind === "gift" ? (isMapRewardMessage(selected) ? t("messages.mapRewardTitle") : t("common.gift")) : t("messages.label.fromDev")}
              </div>
              <h3 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 900 }}>{selected.title}</h3>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{new Date(selected.sentAt).toLocaleString(localeMeta.bcp47)}</div>
            </div>
            {selected.body && !isMapRewardMessage(selected) && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{selected.body}</p>}
            {mapReward && (
              <div style={{ marginTop: 4, padding: 12, borderRadius: 12, background: "rgba(100,181,246,0.08)", border: "1px solid rgba(100,181,246,0.35)" }}>
                <div style={{ fontWeight: 800, color: "#64B5F6", marginBottom: 8 }}><Tr id="messages.mapRewardTitle" /></div>
                {mapReward.bundle.coins > 0 && <div style={{ fontSize: 13, marginBottom: 4 }}>• {t("messages.mapRewardCoins", { count: mapReward.bundle.coins })}</div>}
                {mapReward.bundle.crystals > 0 && <div style={{ fontSize: 13, marginBottom: 4 }}>• {t("messages.mapRewardCrystals", { count: mapReward.bundle.crystals })}</div>}
                {mapReward.bundle.powerPoints > 0 && <div style={{ fontSize: 13, marginBottom: 4 }}>• {t("messages.mapRewardPowerPoints", { count: mapReward.bundle.powerPoints })}</div>}
                {mapReward.mapNames.length > 0 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                    {t("messages.mapRewardForMaps", { maps: mapReward.mapNames.join(", ") })}
                  </div>
                )}
                <button type="button" className="ui-btn ui-btn--primary ui-btn--block" style={{ marginTop: 10 }} disabled={busy} onClick={onClaimMapReward}>
                  {busy ? "..." : t("messages.claimMapReward")}
                </button>
              </div>
            )}
            {selected.kind === "gift" && isMapRewardMessage(selected) && !mapReward && (
              <div style={{ fontSize: 12, color: "rgba(105,240,174,0.9)" }}><Tr id="messages.mapRewardClaimed" /></div>
            )}
            {selected.attachment?.kind === "image" && (
              <img src={selected.attachment.url} alt="" style={{ maxWidth: "100%", borderRadius: 10, maxHeight: 200, objectFit: "contain" }} />
            )}
            {selected.attachment?.kind === "link" && (
              <a href={selected.attachment.url} target="_blank" rel="noreferrer" style={{ color: "#64B5F6", fontSize: 13, wordBreak: "break-all" }}>{selected.attachment.url}</a>
            )}
            {selected.threadId && (
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--block" onClick={() => onOpenThread(selected.threadId!)}>
                <Tr id="messages.openThread" />
              </button>
            )}
            {pendingGift && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: "rgba(255,213,79,0.08)", border: "1px solid rgba(255,213,79,0.35)" }}>
                <div style={{ fontWeight: 800, color: "#FFD54F", marginBottom: 8 }}><Tr id="messages.giftContents" /></div>
                {pendingGift.items.map((it, i) => <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>• {describeGiftItem(it)}</div>)}
                <button type="button" className="ui-btn ui-btn--primary ui-btn--block" style={{ marginTop: 10 }} disabled={busy} onClick={onClaim}>
                  {busy ? "..." : t("messages.claimGift")}
                </button>
              </div>
            )}
            {selected.kind === "gift" && !pendingGift && (
              <div style={{ fontSize: 12, color: "rgba(105,240,174,0.9)" }}><Tr id="messages.giftAlreadyClaimed" /></div>
            )}
          </>
        ) : (
          <div style={{ color: "rgba(255,255,255,0.45)", textAlign: "center", padding: 40 }}><Tr id="messages.selectMessage" /></div>
        )}
      </div>
    </div>
  );
}

function SentPanel({ threads, selected, onSelect, canReply, replyText, setReplyText, onSendReply, busy }: {
  threads: FeedbackThread[];
  selected: FeedbackThread | null;
  onSelect: (t: FeedbackThread) => void;
  canReply: boolean;
  replyText: string;
  setReplyText: (v: string) => void;
  onSendReply: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  if (!threads.length) {
    return (
      <div className="ui-card" style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}><EmojiIcon emoji="📤" size={24} /></div>
        <div><Tr id="messages.empty.threads" /></div>
        <div style={{ fontSize: 12, marginTop: 8 }}><Tr id="messages.empty.threadsHint" /></div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1.4fr)", gap: 12, minHeight: 440 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
        {threads.map(t => {
          const cat = getFeedbackCategoryInfo(t.category);
          const hasDevReply = t.messages.some(m => m.from === "dev");
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="ui-card"
              style={{
                textAlign: "left", padding: "12px 14px", cursor: "pointer",
                border: selected?.id === t.id ? "1px solid rgba(100,181,246,0.6)" : undefined,
                background: selected?.id === t.id ? "rgba(33,150,243,0.12)" : undefined,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, color: cat.color, marginBottom: 4 }}><EmojiIcon emoji={cat.icon} size={18} /> {cat.label}</div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{t.subject}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                {hasDevReply ? t("messages.hasReply") : t("messages.awaitingReply")}
              </div>
            </button>
          );
        })}
      </div>

      <div className="ui-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, maxHeight: 520 }}>
        {selected ? (
          <>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>{selected.subject}</h3>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                {getFeedbackCategoryInfo(selected.category).label}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 0" }}>
              {selected.messages.map(m => (
                <ChatBubble key={m.id} message={m} />
              ))}
            </div>
            {canReply ? (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: "#90CAF9", marginBottom: 6, fontWeight: 700 }}><Tr id="messages.continueDialog" /></div>
                <textarea
                  className="ui-input"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value.slice(0, MAX_FEEDBACK_TEXT))}
                  placeholder={t("messages.replyPlaceholder")}
                  rows={3}
                  style={{ resize: "vertical", minHeight: 72 }}
                />
                <button type="button" className="ui-btn ui-btn--primary ui-btn--block" style={{ marginTop: 8 }} disabled={busy || replyText.trim().length < 2} onClick={onSendReply}>
                  {busy ? "..." : t("common.send")}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
                <Tr id="messages.awaitDevReply" />
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "rgba(255,255,255,0.45)", textAlign: "center", padding: 40 }}><Tr id="messages.selectThread" /></div>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ThreadMessage }) {
  const { t, localeMeta } = useI18n();
  const isDev = message.from === "dev";
  return (
    <div style={{ display: "flex", justifyContent: isDev ? "flex-start" : "flex-end" }}>
      <div style={{
        maxWidth: "85%", padding: "10px 12px", borderRadius: 12,
        background: isDev ? "rgba(33,150,243,0.2)" : "rgba(76,175,80,0.15)",
        border: `1px solid ${isDev ? "rgba(100,181,246,0.35)" : "rgba(76,175,80,0.35)"}`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: isDev ? "#90CAF9" : "#81C784", marginBottom: 4 }}>
          {isDev ? t("messages.dev") : t("messages.you")} · {new Date(message.sentAt).toLocaleString(localeMeta.bcp47)}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}><TextWithEmojis text={message.text} emojiSize={24} /></div>
        {message.attachment?.kind === "image" && (
          <img src={message.attachment.url} alt="" style={{ marginTop: 8, maxHeight: 120, maxWidth: "100%", borderRadius: 8 }} />
        )}
        {message.attachment?.kind === "link" && (
          <a href={message.attachment.url} target="_blank" rel="noreferrer" style={{ color: "#64B5F6", fontSize: 12, display: "block", marginTop: 6, wordBreak: "break-all" }}>{message.attachment.url}</a>
        )}
      </div>
    </div>
  );
}

function ComposePanel({ category, setCategory, subject, setSubject, text, setText, link, setLink, imageData, setImageData, fileRef, onPickImage, onSend, busy }: {
  category: FeedbackCategory | ""; setCategory: (v: FeedbackCategory | "") => void;
  subject: string; setSubject: (v: string) => void;
  text: string; setText: (v: string) => void; link: string; setLink: (v: string) => void;
  imageData: string | null; setImageData: (v: string | null) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickImage: (f: File | null) => void; onSend: () => void; busy: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="ui-card" style={{ padding: 18, maxWidth: 600 }}>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.45 }}>
        <Tr id="messages.compose.intro" />
      </p>

      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 8, fontWeight: 800, letterSpacing: 1 }}><Tr id="messages.categoryLabel" /></label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
        {FEEDBACK_CATEGORIES.map(c => {
          const active = category === c.id;
          return (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)} style={{
              padding: "10px", borderRadius: 10, cursor: "pointer", textAlign: "left",
              border: `2px solid ${active ? c.color : "rgba(255,255,255,0.12)"}`,
              background: active ? `${c.color}22` : "rgba(0,0,0,0.25)",
              color: active ? "#fff" : "rgba(255,255,255,0.7)",
            }}>
              <div style={{ fontSize: 18 }}><EmojiIcon emoji={c.icon} size={18} /></div>
              <div style={{ fontSize: 11, fontWeight: 800, marginTop: 4 }}>{c.label}</div>
            </button>
          );
        })}
      </div>

      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
        {t("messages.subjectLabel", { len: String(subject.length), max: String(MAX_FEEDBACK_SUBJECT) })}
      </label>
      <input className="ui-input" value={subject} onChange={e => setSubject(e.target.value.slice(0, MAX_FEEDBACK_SUBJECT))} placeholder={t("messages.subjectPlaceholder")} style={{ marginBottom: 12 }} />

      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
        {t("messages.descriptionLabel", { len: String(text.length), max: String(MAX_FEEDBACK_TEXT) })}
      </label>
      <textarea className="ui-input" value={text} onChange={e => setText(e.target.value.slice(0, MAX_FEEDBACK_TEXT))} placeholder={t("messages.descriptionPlaceholder")} rows={6} style={{ resize: "vertical", minHeight: 120 }} />

      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}><Tr id="messages.linkOptional" /></label>
        <input className="ui-input" value={link} onChange={e => { setLink(e.target.value); if (e.target.value) setImageData(null); }} placeholder={t("messages.linkPlaceholder")} disabled={!!imageData} />
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => onPickImage(e.target.files?.[0] ?? null)} />
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => fileRef.current?.click()}><Tr id="messages.imageBtn" /></button>
        {imageData && <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setImageData(null)}><Tr id="messages.removeImage" /></button>}
      </div>
      {imageData && <img src={imageData} alt="" style={{ marginTop: 12, maxHeight: 160, maxWidth: "100%", borderRadius: 10 }} />}
      <button type="button" className="ui-btn ui-btn--primary ui-btn--block ui-btn--lg" style={{ marginTop: 18 }} disabled={busy || !category} onClick={onSend}>
        {busy ? t("common.sending") : t("common.send")}
      </button>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, minWidth: 100, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
      fontWeight: 800, fontSize: 11,
      background: active ? "rgba(100,181,246,0.25)" : "rgba(255,255,255,0.06)",
      color: active ? "#90CAF9" : "rgba(255,255,255,0.55)",
    }}>{children}</button>
  );
}
