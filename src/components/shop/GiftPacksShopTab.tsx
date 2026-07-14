import { useMemo, useState } from "react";
import type { GiftItem } from "../../utils/gifts";
import { describeGiftItem } from "../../utils/gifts";
import {
  getGiftPackPool,
  findGiftConflicts,
  alternativesForGiftItem,
  applyReplacements,
  type GiftPackOffer,
  type GiftConflict,
} from "../../utils/giftPacks";
import { getProfileByPlayerId, sendPlayerGiftPack } from "../../utils/playerGiftSend";
import { isValidPlayerIdFormat, normalizePlayerIdQuery } from "../../utils/playerId";
import type { UserProfile } from "../../utils/localStorageAPI";
import { GemIcon } from "../GameIcons";
import { TabHeader } from "./ShopTabParts";
import GiftItemBadge from "./GiftItemBadge";
import { useI18n } from "../../i18n";
import { EmojiIcon } from "../EmojiIcon";

export default function GiftPacksShopTab({
  profileGems,
  onSent,
  initialRecipientId = "",
}: {
  profileGems: number;
  onSent: () => void;
  initialRecipientId?: string;
}) {
  const { t } = useI18n();
  const pool = useMemo(() => getGiftPackPool(), []);
  const [selected, setSelected] = useState<GiftPackOffer | null>(null);
  const [msg, setMsg] = useState("");

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2800);
  };

  return (
    <>
      <TabHeader
        title={t("shop.gifts.header")}
        subtitle={t("shop.gifts.subtitle")}
      />
      {msg && (
        <div className="ui-glass" style={{ marginBottom: 14, padding: 12, textAlign: "center", color: "var(--c-gold-3)", fontWeight: 800 }}>
          {msg}
        </div>
      )}
      <PackSection title={t("shop.gifts.sectionGems")} packs={pool.gemPacks} currency="gems" profileGems={profileGems} onSelect={setSelected} />
      <PackSection title={t("shop.gifts.sectionRub")} packs={pool.rubPacks} currency="rub" profileGems={profileGems} onSelect={setSelected} />
      {selected && (
        <GiftSendModal
          pack={selected}
          profileGems={profileGems}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); onSent(); showMsg(t("shop.gifts.sent")); }}
          onError={showMsg}
        />
      )}
    </>
  );
}

function PackSection({ title, packs, currency, profileGems, onSelect }: {
  title: string;
  packs: GiftPackOffer[];
  currency: "gems" | "rub";
  profileGems: number;
  onSelect: (p: GiftPackOffer) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, color: currency === "gems" ? "#40C4FF" : "#FF80AB", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 12 }}>
        {packs.map(pack => {
          const canAfford = currency === "gems" ? profileGems >= pack.price : true;
          return (
            <button
              key={pack.id}
              type="button"
              className="ui-glass"
              onClick={() => onSelect(pack)}
              style={{
                textAlign: "left", padding: 14, borderRadius: 14, cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.12)",
                opacity: canAfford ? 1 : 0.65,
              }}
            >
              {pack.discountPercent > 0 && (
                <span style={{
                  display: "inline-block", marginBottom: 6,
                  background: "linear-gradient(135deg, #43A047, #2E7D32)",
                  color: "#fff", fontSize: 9, fontWeight: 900,
                  padding: "2px 8px", borderRadius: 6,
                }}>−{pack.discountPercent}%</span>
              )}
              <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{pack.title}</div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-start",
                minHeight: 52, marginBottom: 8, padding: "4px 0",
              }}>
                {pack.items.map((it, i) => (
                  <GiftItemBadge key={i} item={it} compact />
                ))}
              </div>
              <div style={{
                fontSize: 15, fontWeight: 900,
                color: "#ffffff",
                textShadow: `0 0 12px ${currency === "gems" ? "#40C4FF" : "#FF80AB"}cc, 0 1px 3px rgba(0,0,0,0.9)`,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {currency === "gems" ? <><GemIcon size={14} /> {pack.price}</> : <>{pack.price} ₽</>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GiftSendModal({ pack, profileGems, initialRecipientId = "", onClose, onSuccess, onError }: {
  pack: GiftPackOffer;
  profileGems: number;
  initialRecipientId?: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const { t } = useI18n();
  const [recipientPlayerId, setRecipientPlayerId] = useState(initialRecipientId);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [replacements, setReplacements] = useState<Record<number, GiftItem>>({});
  const [conflicts, setConflicts] = useState<GiftConflict[]>([]);
  const [resolving, setResolving] = useState<GiftConflict | null>(null);

  const finalItems = applyReplacements(pack.items, replacements);

  const lookupRecipient = () => {
    const idNorm = normalizePlayerIdQuery(recipientPlayerId);
    if (!isValidPlayerIdFormat(idNorm)) {
      onError(t("shop.gifts.invalidPlayerId"));
      setRecipient(null);
      return null;
    }
    const p = getProfileByPlayerId(idNorm);
    if (!p) { onError(t("shop.gifts.playerNotFound")); setRecipient(null); return null; }
    setRecipient(p);
    const c = findGiftConflicts(p, finalItems);
    setConflicts(c.filter(x => !replacements[x.index]));
    return p;
  };

  const handleSend = () => {
    if (busy) return;
    const p = recipient ?? lookupRecipient();
    if (!p) return;
    const unresolved = findGiftConflicts(p, finalItems).filter(c => !replacements[c.index]);
    if (unresolved.length > 0) {
      setConflicts(unresolved);
      setResolving(unresolved[0]);
      return;
    }
    if (pack.currency === "gems" && profileGems < pack.price) {
      onError(t("common.insufficient"));
      return;
    }
    setBusy(true);
    const r = sendPlayerGiftPack({
      recipientPlayerId,
      items: finalItems,
      message,
      anonymous,
      payGems: pack.currency === "gems" ? pack.price : undefined,
      paidRub: pack.currency === "rub",
    });
    setBusy(false);
    if (!r.success) onError(r.error ?? t("shop.gifts.sendError"));
    else onSuccess();
  };

  const pickReplacement = (index: number, item: GiftItem) => {
    setReplacements(prev => ({ ...prev, [index]: item }));
    setResolving(null);
    setConflicts(prev => prev.filter(c => c.index !== index));
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 8000,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div className="ui-glass" style={{ width: "100%", maxWidth: 440, padding: 20, borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><EmojiIcon emoji="🎁" size={20} /> {pack.title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>
          {pack.currency === "gems" ? t("shop.gifts.priceGems", { price: pack.price }) : t("shop.gifts.priceRub", { price: pack.price })}
        </div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t("shop.gifts.playerIdLabel")}</label>
        <input
          value={recipientPlayerId}
          onChange={e => { setRecipientPlayerId(e.target.value.toUpperCase().replace(/^#/, "")); setRecipient(null); }}
          onBlur={lookupRecipient}
          placeholder={t("shop.gifts.playerIdPlaceholder")}
          maxLength={12}
          style={{ width: "100%", marginBottom: 12, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.35)", color: "#fff", boxSizing: "border-box" }}
        />
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t("shop.gifts.messageLabel")}</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, 200))}
          rows={3}
          placeholder={t("shop.gifts.messagePlaceholder")}
          style={{ width: "100%", marginBottom: 12, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.35)", color: "#fff", resize: "vertical", boxSizing: "border-box" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
          {t("shop.gifts.sendAnonymous")}
        </label>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{t("shop.gifts.packContents")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {finalItems.map((it, i) => (
            <GiftItemBadge key={i} item={it} />
          ))}
        </div>
        {conflicts.length > 0 && !resolving && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(255,152,0,0.15)", border: "1px solid rgba(255,152,0,0.4)", fontSize: 11 }}>
            {t("shop.gifts.conflictHint")}
            {conflicts.map(c => (
              <div key={c.index} style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span>{c.reason}</span>
                <button type="button" className="ui-btn ui-btn--ghost" style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => setResolving(c)}>
                  {t("shop.gifts.pickOther")}
                </button>
              </div>
            ))}
          </div>
        )}
        {resolving && recipient && (
          <ReplacementPicker
            conflict={resolving}
            recipient={recipient}
            onPick={item => pickReplacement(resolving.index, item)}
            onCancel={() => setResolving(null)}
          />
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" className="ui-btn ui-btn--ghost" style={{ flex: 1 }} onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="ui-btn ui-btn--primary" style={{ flex: 1 }} disabled={busy} onClick={handleSend}>
            {busy ? "..." : t("shop.gifts.sendGift")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplacementPicker({ conflict, recipient, onPick, onCancel }: {
  conflict: GiftConflict;
  recipient: UserProfile;
  onPick: (item: GiftItem) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const alts = alternativesForGiftItem(conflict.item, recipient);
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(126,87,194,0.2)", border: "1px solid rgba(126,87,194,0.5)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{t("shop.gifts.replacementTitle")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {alts.map((alt, i) => (
          <button key={i} type="button" className="ui-btn ui-btn--ghost" style={{ fontSize: 11, textAlign: "left" }} onClick={() => onPick(alt)}>
            {describeGiftItem(alt)}
          </button>
        ))}
      </div>
      <button type="button" className="ui-btn ui-btn--ghost" style={{ marginTop: 8, fontSize: 10 }} onClick={onCancel}>{t("common.back")}</button>
    </div>
  );
}
