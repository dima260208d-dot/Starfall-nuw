"""Apply English entity strings to en.json (no external API)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN = ROOT / "src/i18n/messages/en.json"

PATCH = {
    "brawler.miya.description": "A purple-haired ninja girl; throws three shuriken in a fan pattern in battle",
    "brawler.miya.attackName": "Shadow Blades",
    "brawler.miya.superName": "Reality Rift",
    "brawler.miya.attackDesc": "Miya quickly throws 3 shuriken in a fan: the center flies straight for 220 units, the side ones at ±15° from aim. Each deals 400 damage on hit (up to 1200 total if all three connect). 3 attack charges, 1.2s cooldown. Great for blocking a lane or finishing a target with a tight spread before retreating.",
    "brawler.miya.superDesc": "Miya instantly teleports behind the nearest enemy within 400 units, lands an empowered strike, and applies -40% slow for 2 seconds; she gains +20% speed for 1 second. Use Super → three attack charges of triple shuriken (up to 9 projectiles in a row) to finish targets.",
    "brawler.miya.lore": "Miya grew up in a hidden village of shadow blades. After a hostile clan destroyed her home, she swore to deliver justice alone. She throws three shuriken in one volley—they rarely miss—and training in teleportation made her the Arena's fastest assassin.",
    "brawler.ronin.description": "A massive samurai in red armor with a katana",
    "brawler.ronin.attackName": "Earth Pillar",
    "brawler.ronin.superName": "Unbreakable Wall",
    "brawler.ronin.attackDesc": "Ronin swings his katana in a wide 60° cone in front of him (160 unit range). Deals 300 damage to each target hit. 2 charges, 1.4s cooldown—you can land 2 hits in a row (up to 600 to one target). The closer the enemy, the higher the chance both hits connect.",
    "brawler.ronin.superDesc": "Ronin raises an armored shield for 5 seconds: incoming damage is reduced by 50%, and 30% of absorbed damage is reflected back to the attacker. Speed drops 15%, but katana attacks continue. Ideal for soaking group fire—reflected damage adds up.",
    "brawler.ronin.lore": "Ronin was once a general in the imperial army. Betrayed by his own lords, he donned old armor and became a ronin. His katana cuts stone, and his shield withstands volleys from a dozen rifles.",
    "brawler.yuki.description": "A girl in a blue kimono with a staff and snowflake motif",
    "brawler.yuki.attackName": "Snowball",
    "brawler.yuki.superName": "Healing Snow",
    "brawler.yuki.attackDesc": "Yuki fires an ice orb straight for 350 units. On hit: 200 damage + instant -35% movement and fire-rate slow for 2 seconds. 3 charges, 1.0s cooldown. Three quick throws can slow 3 enemies at once—perfect for control during pushes.",
    "brawler.yuki.superDesc": "Yuki releases a snow whirl—a healing cloud with 140 unit radius for 6 seconds. Allies inside restore 300 HP/sec (up to 1800 total); enemies are slowed 25%. The cloud stays in place—place it on capture points, behind cover, or under fire for maximum value.",
    "brawler.yuki.lore": "Yuki was born in a mountain temple where she learned the art of healing ice magic. She came to the Arena to find her brother, lost in a tournament. Until then, she heals allies and freezes anyone in her way.",
    "brawler.kenji.description": "A guy in a yellow suit with electric shockers on his hands",
    "brawler.kenji.attackName": "Electric Chain",
    "brawler.kenji.superName": "Lightning Cage",
    "brawler.kenji.attackDesc": "Kenji fires a lightning bolt (200 unit range) that chains: first target—250 damage, second within 130 units—175 (70%), third—120 (48%). 2 charges, 1.3s cooldown. In tight groups one shot can deal up to 545 total damage.",
    "brawler.kenji.superDesc": "Kenji creates an electric cage with 110 unit radius for 5 seconds. All enemies inside take 200 damage/sec from shock (up to 1000 total) and are slowed 50%. The cage is visible—force enemies to stay and burn or exit into ally fire at the edges.",
    "brawler.kenji.lore": "Kenji is a brilliant inventor expelled from university for \"experiments that were too dangerous.\" His tasers are built from old vending machine parts, and lightning jumps between enemies like it's alive. He fights to prove he was right.",
    "brawler.hana.description": "A girl in a pink medical coat with a healing pistol",
    "brawler.hana.attackName": "Healing Bullet",
    "brawler.hana.superName": "Blooming Garden",
    "brawler.hana.attackDesc": "Hana fires a pink bullet (400 unit range) with dual mode: aim at an ally—heals 150 HP; aim at an enemy—deals 150 damage. 4 charges, 0.9s cooldown. At peak fire rate: 600 HP/sec to an ally or 600 damage/sec to an enemy—among the best DPS and heal numbers.",
    "brawler.hana.superDesc": "Hana creates a blooming garden with 160 unit radius for 5 seconds. Allies inside gain 200 HP/sec healing (up to 1000 HP) and +20% movement speed. Hana can keep shooting inside or outside the garden. Ideal for slow tanks—greatly boosts survivability under fire. Pairs well with Ronin or Goro.",
    "brawler.hana.lore": "Hana is a frontline medic from the Rose Hospital. Her pistol heals allies and pierces enemy armor equally well. She believes kindness and strength can go hand in hand and has never given up on a hopeless patient.",
    "brawler.goro.description": "A huge bearded man with two battle axes",
    "brawler.goro.attackName": "Double Axe",
    "brawler.goro.superName": "Berserker Rage",
    "brawler.goro.attackDesc": "Goro spins 360°, striking all enemies within 90 units with both axes—450 damage each. 2 charges, 1.5s cooldown. In a group of 3 enemies that's 2700 total damage across two spins. Best melee AoE in the game—jump into the center and double-tap.",
    "brawler.goro.superDesc": "Goro enters berserker rage for 5 seconds: +40% movement speed and +50% damage per hit (450 × 1.5 = 675 per spin). In rage mode Goro can catch any enemy. Combo: pop Super → dive in → two spins = 1350 damage to one target in 3 seconds.",
    "brawler.goro.lore": "Goro is a mountain barbarian who came down from the northern peaks. He doesn't remember his childhood, but he remembers the taste of victory. He forged his twin axes himself, and no shield has survived two of his strikes in a row.",
    "brawler.sora.description": "A boy in a blue robe with a floating spellbook",
    "brawler.sora.attackName": "Fireball",
    "brawler.sora.superName": "Meteor Shower",
    "brawler.sora.attackDesc": "Sora launches a fireball (400 unit range): direct hit—300 damage + 60 unit radius blast—150 damage to everyone nearby. Up to 450 to one target in the epicenter. 3 charges, 1.1s cooldown. Against groups each shot hits multiple targets with the blast—strong area control.",
    "brawler.sora.superDesc": "Sora calls down 5 meteors in a chosen zone over 3 seconds. Each meteor: 250 impact damage + 70 unit radius blast (extra damage). Up to 1250 total to one target. Impacts scatter randomly in a 120 unit circle from aim. Strong vs dense groups holding cover or a capture point.",
    "brawler.sora.lore": "Sora is a court mage exiled for daring to study forbidden star runes. His floating book whispers ancient formulas, and meteor showers scar the Arena itself.",
    "brawler.rin.description": "A girl with green hair and poisoned daggers",
    "brawler.rin.attackName": "Poisoned Dagger",
    "brawler.rin.superName": "Poison Cloud",
    "brawler.rin.attackDesc": "Rin throws a poisoned dagger (300 unit range): 350 damage on hit + poison for 3 seconds (100 damage/sec = 300 DoT). 650 total from one throw. 3 charges, 1.0s cooldown. Poison doesn't stack—a new throw refreshes the timer. Best strategy: keep poison uptime and finish with daggers.",
    "brawler.rin.superDesc": "Rin throws a poison grenade, creating a 100 unit cloud for 4 seconds. All enemies inside take 150 damage/sec (up to 600 total). Combo with daggers: grenade poison + dagger poison = double damage over time. The cloud is subtle—enemies may not notice until the first tick.",
    "brawler.rin.lore": "Rin grew up in green jungles among poisonous plants. Each dagger is coated with a personal venom no one else knows how to make. She appears silently, poisons her target, and vanishes into the brush before anyone can react.",
    "brawler.taro.description": "An old man with a wrench and a mechanical backpack",
    "brawler.taro.attackName": "Wrench Strike",
    "brawler.taro.superName": "Turret",
    "brawler.taro.attackDesc": "Taro delivers a heavy wrench blow (80 unit range): 400 damage to the main target + 80 damage to all enemies within 50 units (shockwave). 3 charges, 0.8s cooldown. High melee DPS—at point blank, 3 hits deal 1200 pure damage to one target.",
    "brawler.taro.superDesc": "Taro instantly deploys a battle turret at his position: 200 HP, 250 unit detection range, fires every 0.6 sec for 150 damage to the nearest enemy (turret DPS: 250/sec). Lasts 12 seconds or until destroyed. A new turret replaces the old one. Tactic: place at a choke and attack from the other side—enemies take crossfire.",
    "brawler.taro.lore": "Taro is an elderly engineer who built his first mech at six. The wrench in his hands is deadlier than a sword, and the turrets he places hold the line for hours. Never underestimate the old man.",
    "brawler.zafkiel.description": "A timekeeper with pistols and an hourglass mechanism",
    "brawler.zafkiel.attackName": "Time Cycle",
    "brawler.zafkiel.superName": "Gates of Eternity",
    "brawler.zafkiel.attackDesc": "Zafkiel uses 3 unique charges in rotation: ① Dalet (green)—projectile teleports the target to where they were 2 seconds ago, resetting momentum. ② Bet (blue)—projectile slows target -40% move and fire rate for 3 seconds. ③ Zayin (yellow)—projectile stuns for 0.6 sec (full stop). After Super, the next 3 charges are empowered: Aleph (×2 projectile speed), Gimel (poison 100 damage/sec for 3 sec), Yud (homing shot tracking nearest enemy). 1.4s cooldown, 375 unit range.",
    "brawler.zafkiel.superDesc": "Zafkiel opens the Gates of Eternity—a temporal anomaly with 120 unit radius for 4 seconds. Every second, enemies inside rewind 2 seconds on their trajectory: losing position, speed, and momentum. Effectively a trap zone—enemies can't pass without cost. After activation Zafkiel gets 3 empowered charges (Aleph/Gimel/Yud), radically changing his next 3 shots.",
    "brawler.zafkiel.lore": "Zafkiel is the keeper of time and space, last of the Chronoguard order. He bends time streams, sending enemies to the past or hurrying them toward fate. His Gates of Eternity are where past and future merge in one instant. Those who stand in his way find their movements were decided long ago.",
}

STARS = {
    "miya": [
        ("Shadow in the Night", "Invulnerability after teleport +0.5s."),
        ("Sharp Feathers", "Three shuriken fly 15% farther and 10% faster."),
        ("Explosive Force", "If 2+ shuriken hit one target in one volley: +150 damage."),
        ("Ghost Step", "After Super: +25% speed for 2s."),
        ("Poisoned Blades", "Bleed: 50 damage/s for 2s."),
        ("Death's Twin", "Lethal damage: teleport + 20% HP (60s cooldown)."),
    ],
    "ronin": [
        ("Tough Nut", "Max HP +8%."),
        ("Earth's Wrath", "Cone attack: +100 damage to targets under shield."),
        ("Unbreakable", "Super shield lasts 1s longer."),
        ("Reflected Blow", "Shield reflect damage: 45% instead of 30%."),
        ("Steadfast Warrior", "Healing under shield +30%."),
        ("Immortal Samurai", "Below 15% HP: 1000 shield for 3s (90s cooldown)."),
    ],
    "yuki": [
        ("Frost Dust", "Attack slow +0.5s."),
        ("Healing Resonance", "Super clears slow and poison from allies."),
        ("Snowball Effect", "Every 3rd orb explodes: 150 AoE."),
        ("Cold Wind", "Super heal radius +25%."),
        ("Ice Armor", "After healing: 10% damage resist for 3s."),
        ("Blizzard", "Super pushes enemies within 120px."),
    ],
    "kenji": [
        ("Shockwave", "First enemy hit by chain stunned 0.3s."),
        ("Charged Up", "Chain damage: 300 per target."),
        ("Chain Reaction", "Chain jumps to up to 4 enemies."),
        ("Conductor", "After Super: +20% attack cooldown for 4s."),
        ("Insulator", "Enemies in Super zone cannot charge Super."),
        ("Thunderbolt", "New enemy hit by chain: +100 HP."),
    ],
    "hana": [
        ("First Aid", "Healing bullet removes 1 debuff."),
        ("IV Drip", "Heal shot: 200 instead of 150."),
        ("Double Dose", "Every 4th shot: +50% power for 2 charges."),
        ("Blooming Scent", "Super radius +20%."),
        ("Vitality", "Allies in Super zone: +15% speed."),
        ("Divine Field", "After Super zone: 300 shield for 3s."),
    ],
    "goro": [
        ("Ancestors' Fury", "Each attack: +5% speed for 2s (stacks to ×3)."),
        ("Blood Trail", "During Super: +20% lifesteal for 5s."),
        ("Mad Axes", "+30% damage to targets below 30% HP."),
        ("Frenzy", "Super lasts +2s."),
        ("Battle Cry", "Allies within 100px: +15% damage for 3s."),
        ("Immortality", "Kill during Super: +400 HP."),
    ],
    "sora": [
        ("Scorching Ash", "Blast zone: +50 damage/s for 2s."),
        ("Mage Accelerator", "Orb speed +30%."),
        ("Flame Rain", "Super vs tanky targets: +10% damage."),
        ("Ring of Fire", "After Super: aura 100 damage/s for 3s."),
        ("Infinite Mana", "No damage for 3s: +10% cooldown regen."),
        ("Catastrophe", "Every 3rd orb: 2 extra orbs at 70% damage."),
    ],
    "rin": [
        ("Deadly Poison", "Poison: 120 per tick instead of 100."),
        ("Viper Bite", "Dagger hit applies 0.5s slow."),
        ("Toxic Cloud", "Super radius +30%."),
        ("Bat Form", "Inside own poison: +15% speed."),
        ("Epidemic", "Death from poison: 150 AoE blast."),
        ("Invisible Threat", "After Super: 1.5s invisibility."),
    ],
    "taro": [
        ("Upgraded Gears", "Turret HP: 300 instead of 200."),
        ("Rocket Salvo", "Turret fires 20% faster."),
        ("Engineering Genius", "Recasting Super removes old turret and places a new one (one per squad slot)."),
        ("Auto Repair", "Turret heals 20/s after 3s without damage."),
        ("Electromagnet", "Turret deals +50% damage to slowed and stunned targets."),
        ("Overcharge", "On turret deploy: 400 shield for 4s."),
    ],
    "zafkiel": [
        ("Time Compression", "Bet slow zone duration increased from 1.5 to 2.5 seconds."),
        ("Instant Reset", "After Super Zafkiel instantly restores 1 attack charge."),
        ("Double Strike", "On full stop: +150 damage and +20% incoming damage to target for 2 seconds."),
        ("Time Paradox", "Aleph rewinds target further and removes 1 positive effect from enemy."),
        ("Chrono Shield", "Each hit grants 150 shield for 3s (stacks to 450)."),
        ("Infinite Loop", "Super leaves a trap for 10s, zone radius increased to 130."),
    ],
}

PETS = {
    "fluffy_healer": ("A black cat with green eyes that purrs and slowly heals its owner.", "+200 HP every 10 sec"),
    "wise_owl": ("An owl that speeds up Super charge after a kill.", "+25% Super per kill"),
    "spark_dragon": ("A small dragon that ignites enemies from your attacks.", "10% chance to ignite: 50 DPS for 3 sec"),
    "swift_rabbit": ("A clever rabbit that grants periodic shields.", "Shield for 1.2 sec every 18 sec"),
    "shadow_wolf": ("A ghostly wolf that speeds up its owner at low HP.", "+30% speed when HP < 30%"),
    "fire_fox": ("A flame fox that boosts your attack damage.", "+10% damage"),
    "golden_beetle": ("A sacred beetle that collects bonus coins from kills.", "+10 coins per kill"),
    "stone_turtle": ("An ancient turtle that reflects part of damage taken.", "20% damage reflected to enemy"),
    "phoenix": ("A legendary phoenix that revives a fallen owner once per battle.", "Revives with 30% HP (once per battle)"),
    "moon_spirit": ("A glowing spirit that generously heals its owner.", "+450 HP every 6 sec"),
}

for bid, defs in STARS.items():
    for i, (name, effect) in enumerate(defs, start=1):
        PATCH[f"star.{bid}.{i}.name"] = name
        PATCH[f"star.{bid}.{i}.effect"] = effect

for pid, (desc, label) in PETS.items():
    PATCH[f"pet.{pid}.description"] = desc
    PATCH[f"pet.{pid}.effectLabel"] = label

def main():
    en = json.loads(EN.read_text(encoding="utf-8"))
    en.update(PATCH)
    sorted_en = {k: en[k] for k in sorted(en)}
    EN.write_text(json.dumps(sorted_en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cyr = sum(1 for v in sorted_en.values() if isinstance(v, str) and any("\u0400" <= c <= "\u04FF" for c in v))
    print(f"Patched {len(PATCH)} keys. Remaining Cyrillic values: {cyr}")

if __name__ == "__main__":
    main()
