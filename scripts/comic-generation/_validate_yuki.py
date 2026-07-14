# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MJS = ROOT / "yuki-v2-pages.mjs"
DATA = ROOT / "_yuki_data.json"

BANNED = [
    "Здесь начинается мой путь",
    "не паникуй",
    "Арена не зовёт",
    "обратного тика",
    "откатил",
]
CLOCK = re.compile(r"\u0447\u0430\u0441|\u0442\u0438\u043a\b|\u0441\u0442\u0440\u0435\u043b", re.I)

EXPECTED_TITLES = [
    "Колокол на вершине",
    "Пустая келья брата",
    "Лёд на ранах",
    "Звон в сторону Арены",
    "Маски инея в ущелье",
    "Спасти или заморозить",
    "Снежный порог турнира",
    "Исцеляющий снег",
    "Звёздные ученики",
    "Имена в снегопаде",
]

def main():
    raw = MJS.read_bytes()
    assert raw[:3] != b"\xef\xbb\xbf", "unexpected BOM"
    text = raw.decode("utf-8")
    assert "\u0400" <= text[text.index("title:")+20] <= "\u04ff", "no cyrillic in title area"

    titles = re.findall(r'title:\s*"([^"]+)"', text)
    assert titles == EXPECTED_TITLES, titles

    dialogues = re.findall(r'text:\s*"([^"]+)"', text)
    assert len(dialogues) == 100 * 2 or len(dialogues) >= 100, len(dialogues)
    if len(dialogues) != len(set(dialogues)):
        from collections import Counter
        for t, n in Counter(dialogues).most_common():
            if n > 1:
                print("DUP x%d:" % n, t)
        raise SystemExit("duplicate dialogue")

    pages = len(re.findall(r"^      \[$", text, re.M))
    assert pages == 100, pages

    for b in BANNED:
        assert b.lower() not in text.lower(), b
    for m in CLOCK.finditer(text):
        snippet = text[max(0, m.start()-20):m.end()+20]
        if "тик" in snippet.lower() and "обратного" in snippet.lower():
            raise SystemExit("clock banned phrase context")

    ch9 = text.split('"9":')[1].split('"10":')[0]
    assert "shadowVoice" in ch9
    assert "SILHOUETTE" in ch9 or "silhouette" in ch9.lower() or "mirabel" in ch9

    ch10 = text.split('"10":')[1]
    assert "mirabel_skin1.png" in ch10
    assert "elian_skin1.png" in ch10
    assert "FULL COLOR" in ch10 or "FULL" in ch10

    data = json.loads(DATA.read_text(encoding="utf-8"))
    assert len(data) == 10
    assert sum(len(c["pages"]) for c in data) == 100

    print("OK: utf-8, 10 chapters, 100 pages, unique dialogue, titles match, banned clean")
    print("Size:", MJS.stat().st_size)

if __name__ == "__main__":
    main()
