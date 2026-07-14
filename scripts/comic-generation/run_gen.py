# -*- coding: utf-8 -*-
import json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def P(n, scene, narration, dialogue, sfx=None):
    return {"page": n, "scene": scene, "narration": narration, "dialogue": dialogue, "sfx": sfx}

chapters = {}

chapters["1"] = {"title": "Тень в бамбуке", "pages": [
 P(1,"Wide dawn: hidden shadow-blade village between bamboo stalks, violet paper lanterns, mist.",["Скрытая деревня теневых клинков. Бамбук шепчет раньше птиц."],[{"speaker":"shima","text":"Сегодня три лезвия — одним выдохом, Мия."},{"speaker":"miya","text":"Вдох короткий. Лезвия длиннее."}]),
 P(2,"Training yard: Miya throws three shurikens in fan arc, blades bite wood targets.",["Учебный двор. Промах здесь — позор, не урок."],[{"speaker":"shima","text":"Центральный бьёт сердце цели. Боковые — туда, куда бежит трус."},{"speaker":"miya","text":"Трус не успеет. Тени быстрее."}]),
 P(3,"Close-up: Ren ties red ribbon on Miya wrist beside broken practice dummy.",["Старший брат Рэн смеётся тихо — как будто завтра нельзя отменить."],[{"speaker":"ren","text":"Если промахнёшься — скажу деревне, что это был ветер."},{"speaker":"miya","text":"Ветер не оставляет кровь на бамбуке."}]),
 P(4,"Night porch: Ren hands sealed letter to Miya, moon through bamboo slats.",["Письмо с печатью турнира. Рэн уходит на рассвете."],[{"speaker":"ren","text":"Если не вернусь к ужину — прочти. Не раньше."},{"speaker":"miya","text":"Ты вернёшься. Я не читаю чужие тени."}]),
 P(5,"Miya alone reads letter by candle — tournament invite, clan honor, Ren handwriting.",["В письме — турнир, честь клана и почерк, который ещё тёплый."],[{"speaker":"miya","text":"«Береги ленту». Он знал, что я буду упрямой."}]),
 P(6,"Hairline purple crack flickers above village gate; bamboo leaves freeze mid-fall.",["Воздух над воротами рвётся тонкой фиолетовой нитью."],[{"speaker":"kaito","text":"Шима-сэнсэй! Небо… ломается?"},{"speaker":"miya","text":"Смотри на трещину, не на страх."}],"ТРЕСК!"),
 P(7,"Shima inspects crack with gloved hand; purple static crawls along bamboo.",["Сэнсэй зовёт старейшин. Трещина пахнет чужой кровью."],[{"speaker":"shima","text":"Закрой тренировочный двор. Сегодня учим только слушать."},{"speaker":"gin","text":"Слушать — не наша сильная сторона."}]),
 P(8,"Miya teleports behind wooden dummy in training hall, blade stops a hair from neck.",["Зал теней. Телепорт — дар клана, не фокус."],[{"speaker":"miya","text":"За спиной врага — моя вторая тишина."},{"speaker":"kaito","text":"Ты… растворилась и снова стала!"}],"WHOOSH!"),
 P(9,"Triple shuriken strike — three targets splinter; Miya exhales once.",["Три мишени. Один выдох. Ни одного дрожащего листа."],[{"speaker":"shima","text":"Достаточно. Остальное — завтра."},{"speaker":"miya","text":"Завтра у Рэна турнир. Я провожу его до ворот."}]),
 P(10,"Cliffhanger: distant torches beyond bamboo — sakura-pink masks glint between trees.",["На рассвете за бамбуком мелькают маски с цветком сакуры."],[{"speaker":"ren","text":"Мия… кто-то смотрит на деревню."},{"speaker":"miya","text":"Тогда смотрят на клинок."}],"ШШШ…"),
]}

chapters["2"] = {"title": "Пепел клана", "pages": [
 P(1,"Pre-dawn ambush: sakura-mask raiders pour through cracked gate, violet fire blooms.",["Клан Хакурэн входит с рассветом. Ворота уже были сломаны."],[{"speaker":"hakuren","text":"Теневые клинки… ваш долг пахнет старым страхом."},{"speaker":"miya","text":"Страх — ваш цвет на маске."}],"БУМ!"),
 P(2,"Burning dojo: Miya drags Kaito through smoke, Ren fights two masked ninjas.",["Деревня горит за один вдох. Рэн стоит у моста."],[{"speaker":"ren","text":"Мия! Веди детей к северному ручью!"},{"speaker":"miya","text":"А ты?"},{"speaker":"ren","text":"Я задержу их ложью о чести."}]),
 P(3,"Rooftop chase: Miya throws shurikens, pursues white-mask scout across burning tiles.",["Крыши рушатся. Она бежит по пламени, как по тренировочному мосту."],[{"speaker":"facelessHunter","text":"Девочка с лентой… Хакурэн заплатит за твою голову."},{"speaker":"miya","text":"Платишь ты. Сейчас."}],"ВЖУХ!"),
 P(4,"Bridge duel: Ren blocks Hakuren blade, blood on sakura mask, Miya reaches edge.",["Рэн режет воздух. Хакурэн смеётся под маской."],[{"speaker":"hakuren","text":"Брат слабее сестры. Какая жалость."},{"speaker":"ren","text":"Мия — беги! Письмо… в кармане кимоно!"}]),
 P(5,"Slow-motion: Hakuren blade passes through Ren; red ribbon falls into river.",["Лезвие проходит. Лента падает в воду — краснее рассвета."],[{"speaker":"miya","text":"Рэн!!!"}],"КРАК!"),
 P(6,"Miya kneels at riverbank clutching wet ribbon; village burns behind.",["Пепел клана оседает на её плечи тяжелее свинца."],[{"speaker":"kaito","text":"Мия… все…"},{"speaker":"miya","text":"Молчи. Слёзы шумят. Мне нужен шёпот."}]),
 P(7,"Shima broken katana in ash; Gin bandages Miya arm in ruins.",["Сэнсэй не дышит. Джин кричит без звука."],[{"speaker":"gin","text":"Хакурэн ушёл к дороге Арены."},{"speaker":"miya","text":"Значит, дорога одна."}]),
 P(8,"Miya opens Ren blood-stained letter — postscript: hunt the sakura, not the shadow.",["Добавка в письме — почерк дрожит, но слова твёрды."],[{"speaker":"miya","text":"Охотиться на сакуру… не на тень. Поняла."}]),
 P(9,"Wide: lone figure walks away from burning bamboo forest toward distant Arena dome.",["Она уходит. За спиной — только пепел и обещание."],[{"speaker":"kaito","text":"Куда?"},{"speaker":"miya","text":"Туда, где маски снимают победители."}]),
 P(10,"Close: Miya eyes reflect fire; three shurikens clenched in fist.",["Глава II. Пепел клана. В груди — холоднее ночи."],[{"speaker":"miya","text":"Рэн. Я найду имя под маской."}],"ШШШ…"),
]}

chapters["3"] = {"title": "Кровь на жетоне", "pages": [
 P(1,"Forest trail: Miya tracks boot prints to abandoned checkpoint, blood on leaves.",["Следы ведут к старому посту. Кровь ещё липкая на листьях."],[{"speaker":"miya","text":"Два каблука. Один тяжелее — носил мёртвого."}]),
 P(2,"Miya finds torn sakura-mask cloth and iron token stamped with Hakuren crest.",["На жетоне — герб клана и пятно, не успевшее высохнуть."],[{"speaker":"miya","text":"Кровь на металле. Подпись без слов."}]),
 P(3,"Flashback inset: Ren teaches young Miya to read enemy tokens, not faces.",["Память: Рэн учил читать знаки врагов, не их лица."],[{"speaker":"ren","text":"Жетон важнее крика. Крик врёт."},{"speaker":"miya","text":"А кровь?"},{"speaker":"ren","text":"Кровь — честный чернильник."}]),
 P(4,"Rain shelter: Gin catches up with supplies, maps, and bad news.",["Джин находит её у ручья. Дождь бьёт по крыше навеса."],[{"speaker":"gin","text":"Хакурэн нанял безликих. Их капитан — призрак с белой маской."},{"speaker":"miya","text":"Призраки боятся стали."}]),
 P(5,"Miya sharpens shurikens; purple energy wisps along blade edges.",["Лезвия светятся слабым фиолетовым — отголосок разрыва."],[{"speaker":"miya","text":"Трещина во мне открылась в ту ночь. Использую."}]),
 P(6,"Night camp: Ren letter half-burned for warmth; Miya stops herself.",["Она чуть не сожгла письмо ради тепла. Остановилась."],[{"speaker":"miya","text":"Тепло не стоит его последней строчки."}]),
 P(7,"Ambush: faceless scout drops from tree; Miya pins token to chest with shuriken.",["Разведчик падает. Жетон звенит о его броню."],[{"speaker":"facelessHunter","text":"…"},{"speaker":"miya","text":"Молчи. Твой клан уже написал имя."}],"ВЖУХ!"),
 P(8,"Interrogation: hunter reveals Arena registration list with Hakuren alias.",["Список бойцов. Псевдоним Хакурэн подчёркнут чужой кровью."],[{"speaker":"facelessHunter","text":"Убей — и не узнаешь больше."},{"speaker":"miya","text":"Уже узнала достаточно."}]),
 P(9,"Miya lets hunter crawl away as message; eyes hard.",["Она отпускает врага — как наживку, не как милость."],[{"speaker":"gin","text":"Зачем?"},{"speaker":"miya","text":"Пусть расскажет, что тень идёт."}]),
 P(10,"Silhouette against moon: Miya pockets blood-token, walks toward highway lights.",["Глава III. Кровь на жетоне. Дорога зовёт по имени врага."],[{"speaker":"miya","text":"Хакурэн. Я увижу твоё лицо без цветка."}]),
]}

chapters["4"] = {"title": "След маски", "pages": [
 P(1,"Border town market: wanted posters for shadow-clan survivors; Miya hooded.",["Город у тракта. На стенах — её лицо, ещё не уставшее."],[{"speaker":"kaito","text":"Тебя ищут как предательницу клана."},{"speaker":"miya","text":"Пусть ищут. Я ищу маску."}]),
 P(2,"Tavern back room: Gin bribes clerk for Arena transit papers.",["Подкупленный чиновник боится не золота — безликих."],[{"speaker":"gin","text":"Без пропуска — не войдёшь даже в нижний ярус."},{"speaker":"miya","text":"Тогда украду пропуск у того, кто украл мой дом."}]),
 P(3,"Alley fight: two faceless thugs; Miya teleports between puddles, strikes both.",["Переулок. Два охотника. Один вдох — два тела."],[{"speaker":"facelessCaptain","text":"Смелая. Капитан запомнит ленту."},{"speaker":"miya","text":"Запомнишь вкус бамбука во рту."}],"WHOOSH!"),
 P(4,"Captain white mask close-up reflected in Miya blade.",["Белая маска без лица — зеркало, которое не моргает."],[{"speaker":"facelessCaptain","text":"Ты не охотница. Ты добыча."},{"speaker":"miya","text":"Добыча режет, когда её не ждут."}]),
 P(5,"Miya rips mask fragment off fallen captain — sakura paint underneath.",["Под белой маской — розовый цветок. След Хакурэн."],[{"speaker":"miya","text":"Маска сломана. След остался."}]),
 P(6,"Kaito tends wound; argues about justice vs revenge.",["Кайто спорит. Мия молчит опаснее крика."],[{"speaker":"kaito","text":"Если убьёшь без суда — чем лучше их?"},{"speaker":"miya","text":"Суд будет. На песке Арены."}]),
 P(7,"Dream sequence: Ren spirit behind bamboo curtain, face obscured.",["Сон: Рэн стоит за занавесом из тростника."],[{"speaker":"renSpirit","text":"Не стань тем, кто режет во сне."},{"speaker":"miya","text":"Я бодрствую. Этого достаточно."}]),
 P(8,"Morning: caravan to Arena gates; iron nets above road like spider web.",["Караван к воротам. Сети на дороге — как паутина для птиц."],[{"speaker":"gin","text":"Безликие контролируют сети."},{"speaker":"miya","text":"Сети рвутся с края."}]),
 P(9,"Arena outer wall looms; purple energy veins pulse in stone.",["Стена Арены дышит фиолетовым. Внутри — шум толпы."],[{"speaker":"miya","text":"Здесь маски смеют громко."}]),
 P(10,"Registration desk: clerk scans token; Miya registers alias Bamboo Rain.",["Псевдоним: «Бамбуковый дождь». Жетон — в кармане."],[{"speaker":"miya","text":"Имя на ветру. Пока так."}],"ШШШ…"),
]}

chapters["5"] = {"title": "Крыши и сети", "pages": [
 P(1,"Rooftop sprint across Arena slums: Miya leaps gaps, nets snap below.",["Нижний ярус. Крыши — дорога тех, кто не платит пошлину."],[{"speaker":"facelessHunter","text":"Сверху! Стрелять в сети!"},{"speaker":"miya","text":"Сначала поймайте тень."}],"ВЗРЫВ!"),
 P(2,"Iron net trap cinches; Miya cuts rope with shuriken, drops into alley.",["Сеть сжимается. Лезвие находит слабый узел."],[{"speaker":"miya","text":"Каждая сеть помнит, кто её плёл. Я — нож."}],"РВАНЬ!"),
 P(3,"Gin and Kaito on ground cover escape route with smoke bombs.",["Дым. Кайто кашляет. Джин ведёт."],[{"speaker":"gin","text":"Влево — патруль безликих!"},{"speaker":"kaito","text":"Справа — тоже они!"}]),
 P(4,"Three-point ambush: Miya throws fan of shurikens, pins net handlers.",["Три сюрикена — три руки, что тянули сеть."],[{"speaker":"miya","text":"Один бросок. Три судьбы. Без промаха."}],"ВЖУХ!"),
 P(5,"Faceless Captain on higher roof watches, does not pursue.",["Капитан смотрит сверху и не спускается. Ждёт."],[{"speaker":"facelessCaptain","text":"Беги. Арена любит уставших."},{"speaker":"miya","text":"Усталость — для тех, у кого нет ленты в кармане."}]),
 P(6,"Safehouse attic: map of Arena layers pinned with shuriken tips.",["Карта ярусов. Каждая булавка — обещание удара."],[{"speaker":"kaito","text":"Хакурэн в верхнем круге. До него — десять боёв."},{"speaker":"miya","text":"Десять — не бесконечность."}]),
 P(7,"Miya practices Reality Tear: purple slash opens pocket behind enemy dummy.",["Разрыв реальности — трещина, сквозь которую проходит только она."],[{"speaker":"shima","text":"Голос памяти: не рви мир без нужды."},{"speaker":"miya","text":"Нужда — мой учитель теперь."}],"КРАК-РВ!"),
 P(8,"Night market intel: Hakuren seen with Arena patron in gold trim.",["Слух: Хакурэн ужинает с покровителем купола."],[{"speaker":"gin","text":"Его не выдадут на площади."},{"speaker":"miya","text":"Вытащу на песок."}]),
 P(9,"Miya scales net tower, leaves token nailed at top as warning.",["На вершине сетевой башни — жетон с кровью, вбитый сталью."],[{"speaker":"miya","text":"Пусть увидят. Пусть дрогнут."}]),
 P(10,"Sunrise over Arena: Miya on highest roof, cloak snaps like flag.",["Глава V. Крыши и сети. Ниже — город охотников."],[{"speaker":"miya","text":"Я спущусь туда, где маски платят налог кровью."}]),
]}

chapters["6"] = {"title": "Две клятвы", "pages": [
 P(1,"Shrine in abandoned bamboo grove near Arena: twin altars, wind bells.",["Заброшенная роща. Два алтаря — для живых и для мёртвых."],[{"speaker":"miya","text":"Две клятвы. Одна — Рэну. Вторая — себе."}]),
 P(2,"Flashback: child Miya and Ren swear to protect village on altar.",["Детство: они клянутся защищать деревню, не зная цены."],[{"speaker":"ren","text":"Если паду — ты поднимешь клинок, не ненависть."},{"speaker":"miya","text":"А если ненависть сильнее?"},{"speaker":"ren","text":"Тогда режь ненависть первой."}]),
 P(3,"Present: Miya lights incense for Shima, blade for Hakuren.",["Благовоние — сэнсэю. Лезвие — врагу."],[{"speaker":"renSpirit","text":"Ты помнишь обе?"},{"speaker":"miya","text":"Помню. Поэтому жива."}]),
 P(4,"Kaito arrives angry — almost sold out Miya for bounty.",["Кайто принёс монеты. Руки дрожат не от холода."],[{"speaker":"kaito","text":"Мне предлагали цену за тебя. Я… отказался."},{"speaker":"miya","text":"Второй раз откажись."}]),
 P(5,"Argument erupts: justice needs law, revenge needs blood.",["Спор гремит тише бури, но глубже."],[{"speaker":"kaito","text":"Правосудие — не личный клинок!"},{"speaker":"miya","text":"Тогда где суд для сожжённой деревни?"}]),
 P(6,"Ren spirit visible to Kaito briefly; boy faints.",["Кайто видит призрак — и падает, как срубленный тростник."],[{"speaker":"renSpirit","text":"Сестра… не тащи его в ад за собой."},{"speaker":"miya","text":"Он идёт сам. Я не верёвка."}]),
 P(7,"Gin mediates: Arena tribunal exists — champion can demand trial by combat.",["Трибунал Арены: победитель может вызвать на бой с именем."],[{"speaker":"gin","text":"Убей чемпиона нижнего круга — получишь право голоса."},{"speaker":"miya","text":"Голос режет."}]),
 P(8,"Miya carves two notches on shuriken hilt — oath marks.",["Две насечки на рукояти. Клятвы не стираются."],[{"speaker":"miya","text":"Первая — вернуть имя Рэна. Вторая — не стать Хакурэн."}]),
 P(9,"Night wind through bamboo sounds like whispered verdict.",["Ветер судит без зала. Мия кивает."],[{"speaker":"renSpirit","text":"Выбери путь, где лента не станет петлёй."},{"speaker":"miya","text":"Лента — напоминание, не петля."}]),
 P(10,"Miya walks toward Arena lower gate, dual resolve in posture.",["Глава VI. Две клятвы. За спиной — роща, впереди — песок."],[{"speaker":"miya","text":"Сегодня — первый бой. Не последний вдох."}]),
]}

chapters["7"] = {"title": "Первый песок", "pages": [
 P(1,"Arena lower ring: sand floor, crowd behind iron nets, herald raises staff.",["Нижний круг. Песок впитывает чужие шаги."],[{"speaker":"gin","text":"Первый соперник — «Железная Сеть»."},{"speaker":"miya","text":"Сети я уже рвала."}]),
 P(2,"Opponent enters with chain nets; Miya barefoot, three shurikens ready.",["Противник вертит цепи. Мия не мигает."],[{"speaker":"miya","text":"Песок честнее крыши. Здесь видно, кто падает."}]),
 P(3,"Opening clash: nets whip sand; Miya ducks, throws single blade to test range.",["Цепь хлещет. Она измеряет дистанцию лезвием."],[{"speaker":"miya","text":"Дальше, чем думал. Ближе, чем надо ему."}],"ВЖУХ!"),
 P(4,"Crowd roars; Kaito watches from cheap seats, fists white.",["Толпа ревёт. Кайто не дышит."],[{"speaker":"kaito","text":"Мия…"}]),
 P(5,"Miya teleports inside net arc — short burst, elbow strike to jaw.",["Телепорт — короткий рывок сквозь фиолетовую искру."],[{"speaker":"miya","text":"За сетью — пустота."}],"WHOOSH!"),
 P(6,"Enemy falls; herald declares winner Bamboo Rain.",["Победа. Псевдоним звучит, как дождь по крыше."],[{"speaker":"gin","text":"Трибуна даст право на вызов через неделю."},{"speaker":"miya","text":"Неделя — роскошь. Возьму завтра."}]),
 P(7,"Backstage: Faceless Captain offers deal — Miya head for Hakuren location.",["Капитан безликих шепчет сделку в коридоре."],[{"speaker":"facelessCaptain","text":"Сдай жетон — живи."},{"speaker":"miya","text":"Живу и без твоих карт."}]),
 P(8,"Miya finds Arena healer treating net scars on child fighter.",["Ребёнок на носилках. Песок ещё тёплый от его крови."],[{"speaker":"miya","text":"Арена жрёт малых. Хакурэн — зуб."}]),
 P(9,"Night training: triple throw into sand pillar until hand bleeds.",["Песок на костяшках. Боль — счётчик."],[{"speaker":"renSpirit","text":"Хватит. Ты уже сильнее того дня."},{"speaker":"miya","text":"Сильнее — не достаточно."}]),
 P(10,"Miya signs next fight petition against Hakuren proxy Sakura Fang.",["Следующий вызов: «Клык сакуры». Прокси Хакурэн."],[{"speaker":"miya","text":"Первый песок пройден. Следующий — с цветком."}],"ШШШ…"),
]}

chapters["8"] = {"title": "Дождь из трёх", "pages": [
 P(1,"Mid-tier ring: Sakura Fang wears half-mask, twin kodachi, cherry petal confetti.",["Средний круг. «Клык сакуры» — стиль Хакурэн без лица."],[{"speaker":"miya","text":"Лепестки прячут кровь. Не сегодня."}]),
 P(2,"Fight starts: petals blind crowd; Miya closes eyes, listens to breath.",["Она слышит шаги, не видит цвет."],[{"speaker":"miya","text":"Дыхание врага — громче лепестков."}]),
 P(3,"First shuriken grazes mask; second pins sleeve; third waits in hand.",["Первый режет щёку. Второй гвоздит рукав. Третий — терпение."],[{"speaker":"miya","text":"Дождь из трёх начинается с тишины."}],"ВЖУХ!"),
 P(4,"Sakura Fang charges; Miya opens Reality Tear — purple seam behind opponent.",["Разрыв реальности: вертикальная рана в воздухе."],[{"speaker":"miya","text":"Шаг в трещину — удар из ниоткуда."}],"КРАК-РВ!"),
 P(5,"Teleport strike from tear: Miya emerges behind, kodachi clash sparks.",["Она выходит из разрыва, как нож из ножен мира."],[{"speaker":"miya","text":"Третий сюрикен — в спину маски."}],"ВЖУХ!"),
 P(6,"Enemy mask cracks; underneath — not Hakuren, but branded recruit.",["Под маской — клеймо найма, не лицо лорда."],[{"speaker":"miya","text":"Пешка. Хакурэн снова прячется."}]),
 P(7,"Tribunal grants Miya formal duel queue against Masked Lord next moon.",["Трибунал: официальный вызов «Замаскированному лорду»."],[{"speaker":"gin","text":"Это он. Псевдоним Хакурэн."},{"speaker":"miya","text":"Луна подождёт. Я — нет."}]),
 P(8,"Faceless hunters mass outside Miya quarters; captain blocks door.",["Охотники окружают. Капитан стоит у двери."],[{"speaker":"facelessCaptain","text":"Ты сломала правила сети."},{"speaker":"miya","text":"Правила сгорели с моей деревней."}]),
 P(9,"Rain of three shurikens through window — hunters fall; Miya escapes roof.",["Три лезвия в тёмном окне. Дождь стали."],[{"speaker":"miya","text":"Дождь закончился. Буря — впереди."}],"ВЖУХ-ВЖУХ-ВЖУХ!"),
 P(10,"Miya on rain-slick roof, blood on hands, eyes to upper Arena tier.",["Глава VIII. Дождь из трёх. Верхний ярус мерцает."],[{"speaker":"miya","text":"Хакурэн. Песок ждёт твоих лепестков."}],"ДОЖДЬ…"),
]}

chapters["9"] = {"title": "Спор трёх путей", "pages": [
 P(1,"Arena backstage mist: purple fog, roots through floor — SHADOWED trio scene.",["Закулисье. Туман. Три силуэта у корней, пробивших пол."],[{"speaker":"miya","text":"Кто смотрит из тени?"},{"speaker":"shadowVoice","text":"Три пути. Один клинок. Выбери."}]),
 P(2,"Tree-antler SILHOUETTE and winged SILHOUETTE flank purple shadow — NOT full faces.",["Силуэт с рогами дерева. Силуэт с крыльями. Лица не видны."],[{"speaker":"miya","text":"Ещё одни охотники?"},{"speaker":"shadowVoice","text":"Охотники на несправедливость. Не на тебя."}]),
 P(3,"Iron-net hunters attack all three silhouettes; Miya throws shuriken to help.",["Безликие атакуют силуэты. Мия бросает лезвие в сеть."],[{"speaker":"miya","text":"Если вы враги Хакурэн — говорите быстрее."}],"КЛАНГ!"),
 P(4,"Triangle composition: purple shadow, green roots, gold light — SHARED palette.",["Три цвета в тумане: пурпур, зелень, золото."],[{"speaker":"shadowVoice","text":"Месть — дорога без моста."},{"speaker":"miya","text":"Мосты я строю из стали."}]),
 P(5,"Roots and wings hold line while Miya strikes hunter captain.",["Силуэты держат линию. Мия режет капитана."],[{"speaker":"facelessCaptain","text":"Тень… троих… невозможно…"},{"speaker":"miya","text":"Невозможное учится на крови."}],"WHOOSH!"),
 P(6,"Quiet vow exchange: three ideas of justice, faces hidden.",["Тихий спор: три идеи справедливости, лица скрыты."],[{"speaker":"shadowVoice","text":"Убьёшь лорда — станешь легендой. Или монстром."},{"speaker":"miya","text":"Монстры носят сакуру. Я ношу ленту."}]),
 P(7,"Sky triangle: shuriken, oak leaf, angel wing symbols burn into mist.",["В небе проступают три знака: сюрикен, лист, крыло."],[{"speaker":"miya","text":"Три пути. Один враг. Пока сходимся здесь."}]),
 P(8,"Combined strike: shuriken rain + root surge + light thread cuts nets.",["Комбо: дождь стали, рост корней, нить света рвёт сети."],[{"speaker":"shadowVoice","text":"Вместе — до ворот верхнего круга."},{"speaker":"miya","text":"После — каждый своей дорогой."}],"КРАК-БУМ!"),
 P(9,"Triangle mark burned into Arena sand; herald sees from afar.",["На песке — треугольный знак. Глашатай затаил дыхание."],[{"speaker":"gin","text":"Тебя объявят союзницей тени!"},{"speaker":"miya","text":"Объявят — не значит узнают."}]),
 P(10,"Silhouettes depart into mist three ways; Miya alone with new mark on glove.",["Силуэты уходят тремя тропами. На перчатке — знак."],[{"speaker":"miya","text":"Спор трёх путей. Ответ — на песке завтра."},{"speaker":"shadowVoice","text":"Завтра мы снова станем тенью."}],"ШШШ…"),
]}

chapters["10"] = {"title": "Имя на ветру", "pages": [
 P(1,"Arena ceremony wide shot: golden scoreboard, herald announces trio alliance rumor.",["Церемония. Слухи о троице гремят громче барабанов."],[{"speaker":"gin","text":"Верхний круг открыт. Хакурэн — сегодня."},{"speaker":"miya","text":"Имя на ветру. Сегодня станет криком."}]),
 P(2,"FULL COLOR: Silven steps from living roots portal — match silven_skin1.png FULL design.",["Из корневого портала выходит Сильвен — полный облик, не силуэт."],[{"speaker":"silven","text":"Тень с бамбуком. Мы обещали стычку у ворот."},{"speaker":"miya","text":"Обещание держу. Лезвие — впереди."}]),
 P(3,"FULL COLOR: Lumina descends golden threads — match lumina_skin1.png FULL design.",["С неба спускается Лумина — золотые нити, полный дизайн."],[{"speaker":"lumina","text":"Три пути сошлись. Враг — один."},{"speaker":"miya","text":"Враг — с маской сакуры. Остальное — потом."}]),
 P(4,"Trio vs iron-net hunters on Arena sand — SAME wide composition, all FULL faces.",["Трое на песке против безликих. Все лица видны."],[{"speaker":"miya","text":"Слева — сети. Режем вместе."},{"speaker":"silven","text":"Корни держат."},{"speaker":"lumina","text":"Свет режет."}],"КЛАНГ!"),
 P(5,"Team fight: Reality Tear + Life Tree + Golden Cage combo layout.",["Комбо: разрыв, дерево, клетка света."],[{"speaker":"miya","text":"Сейчас!"},{"speaker":"silven","text":"Рост!"},{"speaker":"lumina","text":"Граница!"}],"КРАК-БУМ!"),
 P(6,"Upper gate opens: Hakuren in full sakura mask and lord kimono descends.",["Ворота верхнего круга. Хакурэн спускается с цветком на лице."],[{"speaker":"hakuren","text":"Девочка с лентой… вернулась за второй смертью?"},{"speaker":"miya","text":"За именем. Твоим."}]),
 P(7,"Arena edge debate: Silven justice, Lumina mercy, Miya blade between.",["Край арены. Три голоса спора — три пути."],[{"speaker":"silven","text":"Суд — корнями."},{"speaker":"lumina","text":"Пощада — светом."},{"speaker":"miya","text":"Клинок — моим дыханием."}]),
 P(8,"Night sky: burned forest shadow, oak, chapel light merge over Arena.",["Ночное небо: тень сожжённого леса, дуб, свет часовни."],[{"speaker":"renSpirit","text":"Не носи мою ненависть как вторую маску."},{"speaker":"miya","text":"Ношу память. Маску сниму с него."}]),
 P(9,"Final splash: trio vs Hakuren wave — Miya leads shuriken fan.",["Финальный залп: веер из трёх сюрикенов ведёт Мия."],[{"speaker":"miya","text":"Дождь из трёх!"},{"speaker":"hakuren","text":"Лепестки поглотят сталь!"},{"speaker":"lumina","text":"Не сегодня!"}],"ВЖУХ-ВЖУХ-ВЖУХ!"),
 P(10,"End card: Miya walks forward, Silven and Lumina behind, wind takes red ribbon.",["Конец главы X. Имя на ветру. Лента уносит ветер — не прощание."],[{"speaker":"miya","text":"Рэн. Я назову его имя вслух. На песке. Без маски."},{"speaker":"silven","text":"Мы рядом."},{"speaker":"lumina","text":"До конца пути."}],"ВЕТЕР…"),
]}

BANNED = [
  "Здесь начинается мой путь","не паникуй","Держись за мою спину","вернул не манекен",
  "Арена не зовёт","обратного тика","сделаю свой тик","боюсь того кем станет",
  "последний пост","невозможное — моя работа","откатил","три секунды запаса","ТИК",
]
text = json.dumps(chapters, ensure_ascii=False)
for phrase in BANNED:
    if phrase in text:
        raise SystemExit("Banned phrase: " + phrase)
for i in range(1, 11):
    if len(chapters[str(i)]["pages"]) != 10:
        raise SystemExit("Chapter " + str(i) + " page count wrong")

mjs = '''import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapters = ''' + json.dumps(chapters, ensure_ascii=False, indent=2) + ''';
const outPath = path.join(__dirname, "miya-chapters-v2.json");
fs.writeFileSync(outPath, JSON.stringify(chapters, null, 2), "utf8");
console.log("Wrote", outPath);
console.log("Chapters:", Object.keys(chapters).length);
console.log("Pages:", Object.values(chapters).reduce((n, c) => n + c.pages.length, 0));
'''
mjs_path = ROOT / "write-miya-chapters-v2.mjs"
mjs_path.write_text(mjs, encoding="utf-8")
subprocess.check_call(["node", str(mjs_path)], cwd=ROOT.parent.parent)