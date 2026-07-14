import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const ruPath = path.join(root, "../src/i18n/messages/ru.json");
const enPath = path.join(root, "../src/i18n/messages/en.json");

const ruLores = {
  goro: "Горо — горный варвар, сошедший с северных вершин. Детства он не помнит, но помнит вкус победы и звон стали. Двойные топоры выковал собственными руками — ни один щит не выдерживает двух ударов подряд. На арене он бушует как лавина, и отступать для него хуже смерти.",
  hana: "Хана — фронтовой медик из Розового госпиталя. Её пистолет одинаково хорошо лечит союзников и продырявливает броню врагов. Она верит, что добро и сила могут идти рука об руку, и ни разу не сдавалась перед безнадёжным пациентом. На поле боя она остаётся до конца — пока пульс есть, у неё есть план.",
  kenji: "Кендзи — гениальный изобретатель, выгнанный из университета за «слишком опасные эксперименты». Его электрошокеры собраны из деталей старых автоматов, а молнии прыгают между врагами, словно живые. Он выходит на арену, чтобы доказать, что был прав. Каждая искра на поле — ещё один аргумент в его пользу.",
  miya: "Мия выросла в скрытой деревне теневых клинков. Враждебный клан уничтожил её дом — с тех пор она вершит правосудие одна. За один бросок выпускает три сюрикена, а телепортация делает её призраком арены. Те, кто видел её удар, редко успевают рассказать об этом.",
  rin: "Рин выросла в зелёных джунглях среди ядовитых растений. Каждый кинжал смазан ядом собственного рецепта — формулу не знает никто. Она появляется бесшумно, отравляет цель и исчезает в зарослях. Те, кто пережил укус, говорят, что вторая встреча уже не наступает.",
  ronin: "Когда-то Ронин был генералом императорской армии. Преданный собственными лордами, он надел старые доспехи и стал вольным самураем. Его катана разрубает камень, а щит выдерживает залпы из десятка винтовок. На арене он стоит как стена — пока он жив, за его спиной безопасно.",
  sora: "Сора — придворный маг, изгнанный за изучение запретных звёздных рун. Его летающая книга шепчет древние формулы, а метеоритный дождь оставляет шрамы на арене. Он верит, что звёзды знают ответ на каждый вопрос. Те, кто мешает ему читать небо, узнают это слишком поздно.",
  taro: "Таро — пожилой инженер, собравший первый шагоход в шесть лет. Гаечный ключ в его руках — оружие пострашнее меча, а турели держат позиции часами. Не недооценивайте старика: за каждым болтом — десятилетия точности. На арене он строит победу так же, как механизмы — по чертежу.",
  yuki: "Юки родилась в горном храме, где училась целительной магии льда. Она пришла в Арену, чтобы найти брата, пропавшего в турнире. До тех пор она лечит союзников и замораживает любого, кто встанет на пути. Каждый снежный шар несёт частицу её надежды на возвращение.",
  verdeletta: "Верделетта — адский церемонимейстер, устраивающий опасные торжества в преисподней и мире живых. Её пистолет — не оружие, а приглашение на теневой бал. Тех, кого она метит, тени находят без права отказа. Говорят, шевелящаяся отдельно тень — знак, что следующий праздник уже назначен.",
  lumina: "Люмина — дочь падшего ангела и смертной женщины. Небес она не помнит, но крылья светятся тоской по дому. Её световые нити связывают врагов и потерянные души, помогая им найти покой. В бою она не убивает — она запирает противников в золотой клетке правосудия.",
  oliver: "Оливер — гениальный механик, чьи бронзовые жуки — уменьшенные копии его умершего брата. Он научился копировать вражеские суперы, веря, что любой дар можно обратить во благо. Репликатор хранит память о том, как жук-брат однажды спас ему жизнь. На арене Оливер доказывает, что прошлое можно переписать.",
  callista: "Каллиста — алхимик, взорвавшая лабораторию, пытаясь создать лекарство от всех болезней. С тех пор носит очки с разноцветными линзами — каждый реактив видит по-новому. Её супер — взрывная смесь накопленных рецептов. Она не знает, вылечит это или убьёт, но готова рискнуть ради науки.",
  airin: "Айрин — бывший военный лётчик королевства стимпанк, которую предали и бросили в дымовой ловушке. Она выжила и с тех пор носит очки на лбу и дымовые шашки. Её эвакуация спасает тела и души — она верит, что каждый заслуживает второго шанса. Даже врагам на поле боя.",
  elian: "Элиан — ученик обсерватории, научившийся сгущать свет в заряды и искривлять гравитацию. Звёзды на его пальто — не украшение: каждая метка пройденного неба. Он не торопится в бою и ждёт, пока шар созреет. Только тогда отпускает катастрофу, от которой не уйти.",
  silven: "Сильвен был обычным мальчиком-лешим, пока люди не выжгли его лес. Оставшись один, он отдал сердце древнему дубу — и тот ответил. Теперь Сильвен сажает деревья жизни там, где проходит бой. Говорят, под его кроной слышен шёпот ушедших деревьев.",
  vittoria: "Виттория — последняя из вампирского рода, уничтоженного охотниками. Кастет с шипами — память о брате, который заслонил её собой. Кровавая луна — проклятие и благословение: чем больше жизней она забирает, тем дольше сражается. Но она мечтает однажды лечить, а не кусать.",
  octavia: "Октавия — русалка-мутант из подземного озера, отравленного алхимиками. Щупальца — результат экспериментов, чернила ядовиты для врагов и скрывают союзников. Она ищет способ очистить воду. Пока же её ловушки хватают лишь тех, кто не верит в чудеса.",
  zephyrin: "Зефирин — дух ветра, уставший быть невидимым. Она приняла форму девушки, чтобы почувствовать уязвимость. Её торнадо — попытка обнять мир, но они отбрасывают врагов прочь. В моменты неуязвимости она становится чистым воздухом, недосягаемым для чужой боли.",
  mirabel: "Мирабель выросла в библиотеке академии, где каждая книга шептала ей тайны. Она не стреляет огнём — бросает искры знания, ускоряя союзников. Её супер «Ускоренное обучение» превращает команду в мастеров двойного удара. Враги понимают это уже после поражения.",
};

const enLores = {
  goro: "Goro is a mountain barbarian who came down from the northern peaks. He doesn't remember his childhood, but he remembers the taste of victory and the ring of steel. He forged his twin axes himself, and no shield has survived two of his strikes in a row. On the Arena he rages like an avalanche—for him, retreat is worse than death.",
  hana: "Hana is a frontline medic from the Rose Hospital. Her pistol heals allies and pierces enemy armor equally well. She believes kindness and strength can go hand in hand and has never given up on a hopeless patient. On the battlefield she stays until the end—as long as there's a pulse, she has a plan.",
  kenji: "Kenji is a brilliant inventor expelled from university for \"experiments that were too dangerous.\" His tasers are built from old vending machine parts, and lightning jumps between enemies as if alive. He fights to prove he was right. Every spark on the field is another argument in his favor.",
  miya: "Miya grew up in a hidden village of shadow blades. A hostile clan destroyed her home—since then she delivers justice alone. One throw sends three shuriken, and teleportation makes her the Arena's ghost. Those who see her strike rarely live to tell the tale.",
  rin: "Rin grew up in green jungles among poisonous plants. Each dagger is coated with a personal venom whose formula no one else knows. She appears silently, poisons her target, and vanishes into the brush. Survivors say a second meeting never comes.",
  ronin: "Ronin was once a general in the imperial army. Betrayed by his own lords, he donned old armor and became a ronin. His katana cuts stone, and his shield withstands volleys from a dozen rifles. On the Arena he stands like a wall—while he lives, allies behind him are safe.",
  sora: "Sora is a court mage exiled for studying forbidden star runes. His floating book whispers ancient formulas, and meteor showers scar the Arena itself. He believes the stars hold every answer. Those who stop him from reading the sky learn that too late.",
  taro: "Taro is an elderly engineer who built his first mech at six. The wrench in his hands is deadlier than a sword, and his turrets hold the line for hours. Never underestimate the old man—behind every bolt lies decades of precision. On the Arena he builds victory like a machine—from a blueprint.",
  yuki: "Yuki was born in a mountain temple where she learned healing ice magic. She came to the Arena to find her brother, lost in a tournament. Until then she heals allies and freezes anyone in her way. Every snowball carries a fragment of her hope for his return.",
  verdeletta: "Verdeletta is a hellish ceremony master who throws dangerous celebrations in the underworld and the living world. Her pistol is not a weapon but an invitation to a shadow ball. Those she marks are found by shadows with no right to refuse. They say a shadow moving on its own means the next feast is already scheduled.",
  lumina: "Lumina is the daughter of a fallen angel and a mortal woman. She doesn't remember heaven, but her wings glow with homesickness. Her threads of light bind enemies and lost souls alike, helping them find peace. In battle she doesn't kill—she locks foes in a golden cage of justice.",
  oliver: "Oliver is a genius mechanic whose bronze bugs are miniature copies of his dead brother turned into a machine. He learned to copy enemy Supers, believing any gift can be used for good. His replicator still holds the memory of the bug-brother who once saved his life. On the Arena Oliver proves the past can be rewritten.",
  callista: "Callista is an alchemist who blew up her laboratory trying to brew a cure for every disease. Since then she wears goggles with multicolor lenses—each reagent looks different. Her Super is an explosive mix of every recipe she stockpiled. She doesn't know if it will heal or kill, but she'll risk it for science.",
  airin: "Airin was a royal steampunk military pilot betrayed and left in a smoke trap. She survived and still wears goggles on her forehead and smoke flares on her belt. Her evacuation saves bodies and souls—she believes everyone deserves a second chance. Even enemies on the battlefield.",
  elian: "Elian is an observatory apprentice who learned to condense light into charges and bend gravity. The stars on his coat aren't decoration—each marks a sky he has crossed. He never rushes a fight and waits until the orb ripens. Only then does he release a catastrophe there's no escaping.",
  silven: "Silven was an ordinary forest spirit boy until humans burned his woods. Alone, he gave his heart to an ancient oak—and it answered. Now Silven plants life trees wherever battle passes. They say under his crown you can hear the whisper of trees long gone.",
  vittoria: "Vittoria is the last of a vampire line destroyed by hunters. Her spiked gauntlet is not for killing but in memory of the brother who shielded her. The Blood Moon is her curse and blessing—the more lives she takes, the longer she can fight. Yet she dreams only of healing, not biting.",
  octavia: "Octavia is a mermaid-mutant from an underground lake poisoned by alchemists. Her tentacles are the result of experiments; her ink poisons enemies and hides allies. She seeks a way to cleanse the water. For now her traps only grab those who don't believe in miracles.",
  zephyrin: "Zephyrin is a wind spirit tired of being invisible. She took the form of a girl to feel what vulnerability means. Her tornadoes are attempts to embrace the world, yet they push enemies away. In moments of invulnerability she becomes pure air, untouched by others' pain.",
  mirabel: "Mirabel grew up in the academy library where every book whispered secrets. She doesn't shoot fire—she throws sparks of knowledge, speeding allies before enemies understand what happened. Her Accelerated Learning Super turns the whole team into masters of the double strike. Enemies understand that only after defeat.",
};

function patch(filePath, lores) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let n = 0;
  for (const [id, text] of Object.entries(lores)) {
    const key = `brawler.${id}.lore`;
    if (data[key] !== undefined) {
      data[key] = text;
      n++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(filePath, "updated", n, "lores");
}

patch(ruPath, ruLores);
patch(enPath, enLores);
