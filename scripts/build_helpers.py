# -*- coding: utf-8 -*-
from pathlib import Path

def tg(name):
    return "<" + name + ">"

def ct(name):
    return "</" + name + ">"

dv = "div"
bt = "button"
sp = "span"

lines = [
    "",
    "function EquipSlotRow({",
    "  title, slots, slotOffset, activeSlot, onSlotClick,",
    "}: {",
    "  title: string;",
    "  slots: string[];",
    "  slotOffset: number;",
    "  activeSlot: number;",
    "  onSlotClick: (slot: number) => void;",
    "}) {",
    "  return (",
    tg(dv),
    tg(dv)[:-1] + ' style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)", marginBottom: 8, textAlign: "center" }}>' + ct(dv),
    tg(dv)[:-1] + ' style={{ display: "flex", gap: 10 }}>' + ct(dv).replace("</", "{/*"),
]
