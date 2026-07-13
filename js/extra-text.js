/*
 * extra-text.js — сборка «богатых» отчётов для Telegram Mini App «Nomerolog».
 *
 * Три отчёта:
 *   - composePairReport(profileA, profileB)          — «Совместимость пары»
 *   - composeFamilyReport(profiles)                  — «Карта семьи»
 *   - composeMarriageReport(marriageDateStr, A, B)   — «Дата свадьбы»
 *
 * Вся арифметика (числа, пороги, score) импортируется из ./numerology.js —
 * здесь она НЕ дублируется. Этот модуль отвечает только за ТЕКСТ: логика
 * ветвления по числам портирована 1:1 из декомпилированного Kotlin
 * (DeepCompatibilityCalculator / PairMapCalculator / FamilyMapCalculator /
 * MarriageDateCalculator / CompatibilityCalculator), а сами формулировки
 * переписаны своими словами (дословных копий оригинала нет).
 *
 * profile = { name:string, birthDate:{day,month,year} }
 * Возвращаемая структура (StructuredReport):
 *   { title, subtitle, meta, chips:[{k,v}], summary:[{label,value}], sections:[Section] }
 *   Section = { title, subtitle?, values:[{label,value}], bulletGroups:[{title,bullets:[string]}] }
 * При ошибке функции возвращают { error: 'сообщение' }.
 */

import {
  calculateMap,
  calculateCompatibility,
  calculatePairMap,
  calculateDeepCompatibility,
  calculateMarriageDate,
  calculateFamilyMap,
  parseBirthDate,
  parseFutureDate,
} from './numerology.js';

import { DICT } from './data.js';

// ---------------------------------------------------------------------------
// Текстовые бакеты (все переписанные формулировки). Префиксы:
//   bc_ — базовая совместимость (CompatibilityCalculator)
//   pm_ — карта пары (PairMapCalculator)
//   dc_ — глубокая совместимость (DeepCompatibilityCalculator)
//   fm_ — карта семьи (FamilyMapCalculator)
//   md_ — дата свадьбы (MarriageDateCalculator)
// ---------------------------------------------------------------------------

const T = {
  // ===== Базовая совместимость (CompatibilityCalculator, тексты переписаны) =====
  bc_cons_same: 'Схожая энергия сознания: партнёрам проще узнавать себя друг в друге.',
  bc_cons_close: 'Близкий жизненный курс: ценности и реакции во многом совпадают.',
  bc_cons_diff: 'Разный ритм сознания: важно учиться читать язык друг друга.',
  bc_mis_same: 'Миссии звучат в унисон: легче согласовать шаги и общие планы.',
  bc_mis_mirror: 'Один партнёр естественно подсвечивает другому его способ действовать.',
  bc_mis_diff: 'Способы действия могут расходиться: проговаривайте ожидания заранее.',
  bc_lines_a: 'Совпавшие активные линии: ',
  bc_lines_b: '.',
  bc_conflict_1_7: 'Пара 1 и 7 склонна к борьбе за признание и влияние — здесь нужны правила диалога.',
  bc_conflict_3_6: 'Пара 3 и 6 сталкивает анализ и уют — не подменяйте тепло инструкциями.',
  bc_py_same: 'Похожая тема личного года — общий фон периода воспринимается схоже.',
  bc_py_diff: 'Учитывайте разные темы личного года — у каждого свой темп событий.',
  bc_rec_empty: 'Согласуйте решения до действий и оставляйте партнёру право на свой ритм.',
  bc_rec_always: 'Читайте карту как повод к разговору, а не как приговор человеку.',
  bc_str_empty: 'Пара раскрывает потенциал через осознанный диалог и уважение к различиям.',
  bc_ten_empty: 'Явных напряжений по базовым числам не обнаружено.',
  bc_level_high: 'высокая совместимость',
  bc_level_good: 'заметный потенциал',
  bc_level_work: 'рабочее сочетание',
  bc_level_tune: 'нужна осознанная притирка',
  bc_overview: '{n1} — ЧС {c1} ({a1}), {n2} — ЧС {c2} ({a2}). Итоговый показатель — {score}%, {level}.',

  // ===== Карта пары (PairMapCalculator) =====
  pm_title_a: 'Карта пары: ',
  pm_title_b: ' + ',
  pm_core_a: 'Код пары ',
  pm_core_b: ' — это ',
  pm_core_c: '. ',
  pm_c1: 'В союзе много инициативы и лидерского импульса. Следите, чтобы решения не превращались в спор за последнее слово.',
  pm_c2: 'Главная тема союза — понимание, чуткость и живой отклик. Атмосфера раскрывается через мягкий диалог.',
  pm_c3: 'Пара строится на анализе, договорённостях и общих планах. Только не заменяйте теплоту сухими инструкциями.',
  pm_c4: 'Союз несёт энергию перемен, честности и новых целей. Берегите близость — слишком резкая правда способна её надломить.',
  pm_c5: 'Пару держат общение, движение и интерес. Ей нужны свобода, разговор и смена впечатлений.',
  pm_c6: 'В союзе сильны любовь, красота и уют. Не застревайте в ожидании, пока всё станет идеальным.',
  pm_c7: 'Такая пара бывает глубокой, преображающей и совсем не простой. Здесь важны признание и уважение к личному пути каждого.',
  pm_c8: 'Союз тянется к результату, делам и прочной материальной опоре. Главное — не задавить друг друга контролем и обязанностями.',
  pm_c_default: 'Пара расцветает во взаимопомощи, благодарности и общем деле. Не копите обиды за незаметный вклад.',
  pm_sr_empty: 'Общих активных линий почти не видно: сила пары рождается из уважения к различиям и продуманного распределения ролей.',
  pm_sr_prefix: 'Общий ресурс пары — ',
  pm_sr_suffix: '. Опирайтесь на эти линии, когда решаете что-то вдвоём.',
  pm_gv_a: 'Общая миссия пары ',
  pm_gv_b: ': ',
  pm_gv_c: '. ',
  pm_gv_energies_a: ' Энергии, которые стоит развивать вместе: ',
  pm_gv_energies_b: '.',
  pm_dr_0: 'Сначала озвучьте ожидания и только потом принимайте решение.',
  pm_dr_1: 'Не превращайте карту в приговор — это лишь повод завести разговор.',
  pm_dr_2: 'Различайте личную энергию каждого и общую энергию вашего союза.',
  pm_dr_3: 'В момент напряжения спрашивайте себя: что сейчас укрепит союз, а не мою правоту?',

  // ===== Глубокая совместимость (DeepCompatibilityCalculator) =====
  dc_level_high: 'глубокий, ресурсный союз',
  dc_level_strong: 'крепкая пара с зонами роста',
  dc_level_tuning: 'пара, которой нужна осознанная притирка',
  dc_level_load: 'союз с серьёзной учебной нагрузкой',
  dc_overview_tail: 'Глубокая совместимость учитывает не только общий процент, но и сценарии ссор, деньги, быт, диалог, миссию пары и матрицу.',

  // energyResonance
  dc_er_diff_a: 'Энергии сознания у вас разные: ',
  dc_er_diff_b: ' действует через «',
  dc_er_diff_c: '», а ',
  dc_er_diff_d: ' — через «',
  dc_er_diff_e: '». Это учёба на различиях, а не на сходстве.',
  dc_er_close_a: 'Энергии сознания смотрят в одну сторону. ',
  dc_er_close_b: ' несёт архетип «',
  dc_er_close_c: '», ',
  dc_er_close_d: ' — «',
  dc_er_close_e: '»: о ценностях договориться проще, но роли всё же надо распределить.',
  dc_er_same_a: 'У обоих одно Число Сознания ',
  dc_er_same_b: '. Это усиливает взаимопонимание, но может удвоить общую тень: ',

  // missionResonance
  dc_mr_diff_a: 'Миссии у вас разные: ',
  dc_mr_diff_b: ' движется через «',
  dc_mr_diff_c: '», ',
  dc_mr_diff_d: ' — через «',
  dc_mr_diff_e: '». Не ждите друг от друга одинаковой скорости решений.',
  dc_mr_mirror: 'Миссия одного откликается в сознании другого. Получается связка «наставник — зеркало»: один сам собой показывает второму путь к действию.',
  dc_mr_same_a: 'Миссии совпали: у обоих тема «',
  dc_mr_same_b: '». Тут важно не соперничать за один способ действовать, а подпитывать друг друга.',

  // emotionalPattern
  dc_ep_1: 'Эмоции у пары горячие: решения вспыхивают мгновенно, но так же легко разгорается спор о том, кто прав. Нужны правила лидерства и очередь на инициативу.',
  dc_ep_2: 'Пара очень чуткая: оба ловят настроения, интонации и паузы. Сила здесь в мягкости, слабость — в привычке домысливать за другого.',
  dc_ep_3: 'Пара рассудочная: выручают анализ, порядок и объяснения. Опасность — сводить чувства к лекции или взаимному оцениванию.',
  dc_ep_4: 'Пара обновляющаяся: связь то и дело перестраивается через честность и перемены. Важно не рушить прежнее, пока не заключён новый уговор.',
  dc_ep_5: 'Пару держат разговор, свобода и движение. Риск — увязнуть в словесных спорах вместо того, чтобы подкреплять уговоры делом.',
  dc_ep_6: 'Паре нужны тепло, красота и чувство, что вы выбираете друг друга. Риск — копить обиды, когда партнёр не угадал желание.',
  dc_ep_7: 'Пара глубокая и местами непростая: многое переживается внутри себя. Нужны уважение к дистанции и умение проговаривать своё состояние.',
  dc_ep_8: 'Пара нацелена на стабильность, результат и материальную опору. Риск — контроль, нажим и оценка партнёра по его пользе.',
  dc_ep_default: 'Пара раскрывается через помощь, смысл и общее дело. Риск — впадать в спасательство и ждать благодарности.',
  dc_ep_suffix_pre: 'Связка ЧС ',
  dc_ep_suffix_mid: ' и ',
  dc_ep_suffix_post: ' подсказывает: эмоции стоит переводить в ясные договорённости.',

  // moneyAndHousehold
  dc_mah_1a: 'В быту и финансах ',
  dc_mah_1b: ' обычно задействует канал: ',
  dc_mah_2: ' обычно задействует канал: ',
  dc_mah_3a: 'Общее поле реализации пары собирается из ',
  dc_mah_3b: ' и ',
  dc_mah_3c: ': заранее решите, кто отвечает за идеи, порядок, ресурсы и доведение дел до конца.',

  // conflictScenario
  dc_cs_a: 'Основной риск: болевая точка ',
  dc_cs_b: ' — ',
  dc_cs_c: ', у ',
  dc_cs_d: ' — ',
  dc_conflict_1_7: 'Один способен продавливать активностью, другой — замыкаться и держаться за свою правоту. Помогут паузы и уважение к личному пространству.',
  dc_conflict_3_6: 'Один склонен разбирать и поправлять, другой ждёт тепла и принятия. Нужен баланс между анализом и нежностью.',
  dc_conflict_4_8: 'Тяга всё обновлять сталкивается с желанием всё держать под контролем. Помогут план перемен и понятные финансовые правила.',
  dc_conflict_2_5: 'Один тонко чувствует, другой быстро говорит и легко переключается. Нужен бережный диалог, где чувства не обесценивают.',
  dc_conflict_6_9: 'Один жаждет личного тепла, другой растворяется в заботе обо всех подряд. Нужны границы и приоритет своей пары.',
  dc_conflict_default: 'В ссоре стоит искать не виноватого, а ту потребность каждого, что осталась без ответа.',

  // intimacyRhythm
  dc_ir_1: 'Близость крепнет на общих целях, инициативе и уважении к силе каждого.',
  dc_ir_2: 'Близость расцветает от нежности, внимания к словам и чувства эмоциональной защищённости.',
  dc_ir_3: 'Близость опирается на доверие к уму партнёра, честные объяснения и надёжные договорённости.',
  dc_ir_4: 'Близости нужна свежесть: новым впечатлениям стоит придавать форму, а не скатываться в хаос.',
  dc_ir_5: 'Близость растёт из разговоров, смеха, свободы и общего движения.',
  dc_ir_6: 'Близость подпитывается красотой, заботой, телесным уютом и чувством избранности.',
  dc_ir_7: 'Близость глубокая, но неспешная: важны доверие, тишина и уважение к внутреннему миру.',
  dc_ir_8: 'Близость укрепляют надёжность, поступки, ответственность и честный обмен ресурсами.',
  dc_ir_default: 'Близость раскрывается через поддержку, благодарность и общее дело — но без спасательства.',

  // communicationStyle / communicationLanguage
  dc_style_first: 'Первому партнёру',
  dc_style_second: 'Второму партнёру',
  dc_style_body_1: 'нужны уважение к его порыву и честный прямой ответ.',
  dc_style_body_2: 'важны мягкий тон и подтверждение, что контакт есть.',
  dc_style_body_3: 'нужны логика, пояснения и честная аргументация.',
  dc_style_body_4: 'важны искренность, новизна и отсутствие нажима.',
  dc_style_body_5: 'нужны право высказаться, динамика и быстрый обмен мыслями.',
  dc_style_body_6: 'важны теплота, красивая подача и чувство, что его выбрали.',
  dc_style_body_7: 'нужны пауза, глубина и уважение к личному пространству.',
  dc_style_body_8: 'нужны факты, чёткие правила и ощущение опоры.',
  dc_style_body_default: 'важны смысл, признательность и уважение к его вкладу.',
  dc_comm_common: 'Общий ключ: говорить проще и точнее, а потом сверять, одинаково ли вы поняли сказанное.',

  // strongestResources
  dc_sr_code_a: 'Общий код пары ',
  dc_sr_code_b: ' — ',
  dc_sr_mission_a: 'Совместная миссия пары ',
  dc_sr_mission_b: ' — ',
  dc_sr_lines_a: 'Общие активные линии: ',
  dc_sr_lines_b: ' — это природные опоры вашего союза.',
  dc_sr_matrix_a: 'Взаимодополнение матриц: один партнёр способен подсвечивать другому энергии ',

  // riskZones
  dc_rz_missing_a: 'Общие пробелы матрицы: ',
  dc_rz_missing_b: '. В этих темах паре лучше не винить друг друга, а завести внешние правила и привычки.',
  dc_rz_tension: 'Под напряжением пара спорит не о фактах, а о том, как каждому ощутить безопасность и признание.',

  // dialogueKeys
  dc_dk_0: 'Сначала назови своё состояние, потом просьбу: «я чувствую… мне важно… давай договоримся…». ',
  dc_dk_1: 'Не разбирай партнёра, пока он в минусе. Сперва пауза, затем разговор об одном конкретном вопросе.',
  dc_dk_2: 'Отделяй свою личную задачу от задачи пары: не всякое напряжение надо решать внутри отношений.',
  dc_dk_3: 'Раз в неделю сверяйте три темы: деньги, быт, эмоции. Коротко и без диагнозов друг другу.',

  // practices
  dc_pr_0: 'Практика пары: завести один общий ритуал на неделю — прогулку, беседу, планирование или совместное дело.',
  dc_pr_1: 'Практика для ссор: каждый называет не претензию, а одну потребность и один конкретный шаг вперёд.',
  dc_pr_2: 'Практика ресурса: раз в неделю отмечайте, чем партнёр был полезен, пусть даже в мелочи.',
  dc_pr_3: 'Практика границ: заранее договаривайтесь, где нужна близость, а где каждому важно своё пространство.',

  // ===== Карта семьи (FamilyMapCalculator) =====
  fm_title: 'Семейная карта',
  fm_error: 'Чтобы построить карту семьи, выберите хотя бы два профиля.',
  fm_overview: 'Семейная карта сводит вместе {size} профиля(ей) и раскрывает общий фон, роли, повторяющиеся энергии и точки настройки. Это повод для диалога, а не оценка людей.',
  fm_clim_1: 'Здесь на первом плане инициатива, самостоятельность и право выбора. Стоит признавать лидерскую жилку в каждом.',
  fm_clim_2: 'Такая семья держится на заботе, мягкости и чуткости к настроению близких.',
  fm_clim_3: 'Опора этой семьи — порядок: общие правила, учёба, планы и ясные договорённости.',
  fm_clim_4: 'Атмосфера тут завязана на перемены и обновление. Главное — в откровенных разговорах не сжигать мосты.',
  fm_clim_5: 'Этой семье важны живое общение, движение и свобода. Ключ — говорить сразу, не копя недомолвки.',
  fm_clim_6: 'В сердце семьи — тепло, уют, красота и забота. Только не требуйте от родных совершенства.',
  fm_clim_7: 'Такая семья способна быть глубокой и меняющей людей. Нужны личные границы и уважение к пути каждого.',
  fm_clim_8: 'Семья стоит на ответственности, делах и надёжности. Важно, чтобы обязанности не вытесняли теплоту.',
  fm_clim_default: 'Такая семья живёт помощью, благодарностью и общей пользой. Следите, чтобы забота не переросла в жертвенность.',
  fm_res_code: 'Общий семейный код {code} — {archetype}: {essence}',
  fm_res_repeated: 'Линии, что повторяются в семье: {lines}.',
  fm_res_prominent: 'Ярче всего в семейной матрице звучат энергии: {energies}.',
  fm_res_mission: 'Миссия семьи {mission} — {missionTitle}.',
  fm_att_absent: 'Непрокачанные энергии семьи: {digits}. Растить их стоит привычками, а не упрёками.',
  fm_att_samebase: 'У части членов совпадает базовая энергия: это сближает, но грозит повтором одного и того же сценария.',
  fm_att_1_8: 'Присматривайте, чтобы контроль, лидерство и ответственность не оборачивались давлением.',
  fm_att_5: 'Такой семье особенно важны чёткие уговоры: кто, что и в какой срок делает.',
  fm_att_7: 'Не замыкайтесь в молчании — глубокие чувства лучше облекать в понятные слова.',
  fm_att_default: 'Главное, за чем стоит следить, — озвучивать потребности прежде, чем они станут обидами.',
  fm_role_line: '{name}: сознание {c} — {archetype}; миссия {m}.',
  fm_rec_weekly: 'Раз в неделю устраивайте короткий семейный разговор: что удалось, что вымотало, кому нужна помощь.',
  fm_rec_mission: 'Семейную миссию {n} превращайте в мелкие шаги, а не в громкие ожидания.',
  fm_rec_energies: 'Под энергии {list} подберите простые ритуалы: наведение порядка, беседу, общее занятие, отдых или учёбу.',
  fm_rec_nocompare: 'Не ставьте родных в сравнение друг с другом — у каждого своя роль на общей карте.',

  // ===== Дата свадьбы (MarriageDateCalculator) =====
  md_score_low: 'дате нужна аккуратная доработка',
  md_score_neutral: 'ровная, нейтральная дата',
  md_score_good: 'удачная дата',
  md_score_great: 'на редкость гармоничная дата',
  md_sum: '{n1} + {n2}: дата {date} несёт энергию дня {v11} и общий код брака {v13}. Это не предсказание судьбы, а подсказка для выбора атмосферы, формата и акцентов торжества.',
  md_hl_day: 'Заряд дня {n} — {arch}: {ess}',
  md_hl_union: 'Код вашего союза на эту дату {n} — {title}.',
  md_hl_intimacy: 'Этот день усиливает близость, взаимопонимание и домашний уют.',
  md_hl_lines: 'Общая сила пары прибавляется за счёт: {lines}.',
  md_hl_py: 'Дата совпадает с личным годом одного из вас, поэтому событие может ощущаться по-особенному важным.',
  md_c1: 'Не дайте подготовке превратиться в спор о том, кто главный и за кем последнее слово.',
  md_c3: 'Не перегружайте день тотальным контролем, указаниями и мечтой об идеальном сценарии.',
  md_c4: 'День способен обострить тему перемен — заранее обсудите границы и формат торжества.',
  md_c5: 'Держите под присмотром суету, тайминг, дорогу и связь с гостями.',
  md_c7: 'Дата глубокая, но непростая — стоит добавить тепла и простых радостных деталей.',
  md_c8: 'Не растворяйтесь целиком в логистике, бюджете и контроле — сберегите живые чувства праздника.',
  md_c9: 'Не взваливайте на себя заботу обо всех и сразу.',
  md_c_mercury: 'Закрепляйте договорённости на бумаге: время, место, документы, кто за что отвечает.',
  md_c_fallback: 'Главное — не гнаться за идеалом, а заранее проговорить ожидания и распределить роли.',
  md_rf1: 'Выделите личный выбор двоих: обеты, знак нового старта, совместно озвученное намерение.',
  md_rf2: 'Больше теплоты и мягкости: близкий круг, разговоры по душам, благодарность родным и друг другу.',
  md_rf3: 'Продумайте заранее сценарий, ведущего, тосты и ход дня, чтобы за деталями не растерять эмоции.',
  md_rf4: 'Сделайте акцент на переменах: новый быт, общие правила, честные уговоры и символ перехода.',
  md_rf5: 'Пусть день будет динамичным: музыка, движение, гости, лёгкость и живописные маршруты.',
  md_rf6: 'Добавьте красоты, уюта и романтики: продуманный стиль и по-домашнему тёплая атмосфера.',
  md_rf7: 'Наполните день смыслом: свой ритуал пары, момент уединения, значимый символ или общее намерение.',
  md_rf8: 'Опирайтесь на порядок: бумаги, бюджет, зоны ответственности, надёжный план и ясные роли.',
  md_rf_default: 'Подчеркните благодарность, союз двух семей, добрый смысл, завершение прошлого и начало нового витка.',
  md_close: 'Относитесь к расчёту как к фильтру смысла: выберите дату, при которой обоим спокойно на душе, и сверьте её не только с числами, но и с реальными обстоятельствами.',
};

// ---------------------------------------------------------------------------
// Мелкие утилиты
// ---------------------------------------------------------------------------

/** Подстановка {ключ} → значение (безопасно к спецсимволам, без RegExp). */
function fmt(tpl, map) {
  let s = tpl;
  for (const k in map) {
    s = s.split('{' + k + '}').join(String(map[k]));
  }
  return s;
}

/** Сохраняющая порядок дедупликация массива строк. */
function distinct(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  return out;
}

/** Служебная группировка целей сознания (только для сравнения, не отображается). */
function goalGroup(n) {
  switch (n) {
    case 1: case 3: case 8: return 'material';
    case 2: case 4: case 9: return 'relationships';
    case 5: return 'communication';
    case 6: return 'comfort';
    case 7: return 'spiritual';
    default: return 'unknown';
  }
}

// Доступ к словарю трактовок (DICT ключи — строки "1".."9"; числовой индекс приводится сам).
function profile(n) { return DICT.numbers[n] || {}; }
function mission(n) { return DICT.missions[n] || {}; }
function sphere(n) { return DICT.spheres[n] || {}; }
function money(n) { return DICT.money[n] || {}; }
function shadow(n) { return DICT.shadows[n] || {}; }
function karmic(n) { return DICT.karmic[n] || {}; }

function pad2(n) { return String(n).padStart(2, '0'); }
function pad4(n) { return String(n).padStart(4, '0'); }
function safeName(name, fallback) { return (name && String(name).trim()) || fallback; }

/** Пересечение заголовков активных линий двух карт (порядок — по первой карте). */
function commonLineTitles(mapA, mapB) {
  const b = new Set(mapB.activeLines.map(l => l.title));
  return mapA.activeLines.filter(l => b.has(l.title)).map(l => l.title);
}

/** Цифры 1..9, отсутствующие в обеих матрицах (уже отсортированы по возрастанию). */
function sharedMissingMatrix(mapA, mapB) {
  const out = [];
  for (let d = 1; d <= 9; d++) {
    if (mapA.matrix[d] === 0 && mapB.matrix[d] === 0) out.push(d);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Базовая совместимость (порт CompatibilityCalculator.calculate)
// ---------------------------------------------------------------------------

function baseLevelLabel(score) {
  if (score >= 80) return T.bc_level_high;
  if (score >= 65) return T.bc_level_good;
  if (score >= 50) return T.bc_level_work;
  return T.bc_level_tune;
}

/** Текст тензии для конфликтной пары чисел сознания (или null). */
function baseConflictText(a, b) {
  const s = new Set([a, b]);
  if (s.size === 2 && s.has(1) && s.has(7)) return T.bc_conflict_1_7;
  if (s.size === 2 && s.has(3) && s.has(6)) return T.bc_conflict_3_6;
  return null;
}

/**
 * Воспроизводит ветвление CompatibilityCalculator и собирает списки
 * strengths / tensions / recommendations + level + overview.
 * Score берётся из движка (base.score), тексты переписаны.
 */
function buildBaseCompat(mapA, mapB, nameA, nameB, base) {
  const strengths = [];
  const tensions = [];
  const recs = [];

  const cA = mapA.consciousness;
  const cB = mapB.consciousness;

  // Сознание
  if (cA !== cB) {
    if (goalGroup(cA) !== goalGroup(cB)) tensions.push(T.bc_cons_diff);
    else strengths.push(T.bc_cons_close);
  } else {
    strengths.push(T.bc_cons_same);
  }

  // Миссия
  const mA = mapA.mission;
  const mB = mapB.mission;
  if (mA !== mB) {
    if (mA !== cB && mB !== cA) tensions.push(T.bc_mis_diff);
    else strengths.push(T.bc_mis_mirror);
  } else {
    strengths.push(T.bc_mis_same);
  }

  // Общие активные линии
  const common = commonLineTitles(mapA, mapB);
  if (common.length > 0) {
    strengths.push(T.bc_lines_a + common.join(', ').toLowerCase() + T.bc_lines_b);
  }

  // Конфликтная пара
  const conf = baseConflictText(cA, cB);
  if (conf) tensions.push(conf);

  // Личный год
  if (mapA.personalYear !== mapB.personalYear) recs.push(T.bc_py_diff);
  else strengths.push(T.bc_py_same);

  const level = baseLevelLabel(base.score);

  if (recs.length === 0) recs.push(T.bc_rec_empty);
  recs.push(T.bc_rec_always);

  const overview = fmt(T.bc_overview, {
    n1: nameA,
    c1: cA,
    a1: profile(cA).archetype,
    n2: nameB,
    c2: cB,
    a2: profile(cB).archetype,
    score: base.score,
    level,
  });

  let s = distinct(strengths);
  if (s.length === 0) s = [T.bc_str_empty];
  let t = distinct(tensions);
  if (t.length === 0) t = [T.bc_ten_empty];
  const r = distinct(recs);

  return { strengths: s, tensions: t, recommendations: r, level, overview };
}

// ---------------------------------------------------------------------------
// Карта пары (порт PairMapCalculator.calculate)
// ---------------------------------------------------------------------------

function pmClimate(pairNumber) {
  switch (pairNumber) {
    case 1: return T.pm_c1;
    case 2: return T.pm_c2;
    case 3: return T.pm_c3;
    case 4: return T.pm_c4;
    case 5: return T.pm_c5;
    case 6: return T.pm_c6;
    case 7: return T.pm_c7;
    case 8: return T.pm_c8;
    default: return T.pm_c_default;
  }
}

function pmCoreEnergy(pairNumber) {
  return T.pm_core_a + pairNumber + T.pm_core_b + profile(pairNumber).archetype + T.pm_core_c + profile(pairNumber).essence;
}

function pmSharedResource(sharedLineTitles) {
  if (sharedLineTitles.length === 0) return T.pm_sr_empty;
  return T.pm_sr_prefix + sharedLineTitles.join(', ').toLowerCase() + T.pm_sr_suffix;
}

function pmGrowthVector(pairMission, sharedEnergies) {
  const m = mission(pairMission);
  let s = T.pm_gv_a + pairMission + T.pm_gv_b + (m.title ? m.title.toLowerCase() : '') + T.pm_gv_c;
  s += (m.growthAdvice || '');
  if (sharedEnergies.length > 0) {
    s += T.pm_gv_energies_a + sharedEnergies.join(', ') + T.pm_gv_energies_b;
  }
  return s;
}

function pmDialogueRules() {
  return [T.pm_dr_0, T.pm_dr_1, T.pm_dr_2, T.pm_dr_3];
}

// ---------------------------------------------------------------------------
// Глубокая совместимость (порт DeepCompatibilityCalculator.calculate)
// ---------------------------------------------------------------------------

function deepLevelLabel(score) {
  if (score >= 85) return T.dc_level_high;
  if (score >= 70) return T.dc_level_strong;
  if (score >= 55) return T.dc_level_tuning;
  return T.dc_level_load;
}

function dcCommunicationStyle(n) {
  const bodyKey = {
    1: 'dc_style_body_1', 2: 'dc_style_body_2', 3: 'dc_style_body_3', 4: 'dc_style_body_4',
    5: 'dc_style_body_5', 6: 'dc_style_body_6', 7: 'dc_style_body_7', 8: 'dc_style_body_8',
  }[n] || 'dc_style_body_default';
  const body = T[bodyKey];
  return [T.dc_style_first + ' ' + body, T.dc_style_second + ' ' + body];
}

function dcCommunicationLanguage(a, b) {
  return dcCommunicationStyle(a)[0] + ' ' + dcCommunicationStyle(b)[1] + ' ' + T.dc_comm_common;
}

function dcConflictText(a, b) {
  const s = new Set([a, b]);
  const eq = (x, y) => s.size === 2 && s.has(x) && s.has(y);
  if (eq(1, 7)) return T.dc_conflict_1_7;
  if (eq(3, 6)) return T.dc_conflict_3_6;
  if (eq(4, 8)) return T.dc_conflict_4_8;
  if (eq(2, 5)) return T.dc_conflict_2_5;
  if (eq(6, 9)) return T.dc_conflict_6_9;
  return T.dc_conflict_default;
}

function dcEmotionalPattern(pairCode, a, b) {
  const key = {
    1: 'dc_ep_1', 2: 'dc_ep_2', 3: 'dc_ep_3', 4: 'dc_ep_4',
    5: 'dc_ep_5', 6: 'dc_ep_6', 7: 'dc_ep_7', 8: 'dc_ep_8',
  }[pairCode] || 'dc_ep_default';
  return T[key] + ' ' + T.dc_ep_suffix_pre + a + T.dc_ep_suffix_mid + b + T.dc_ep_suffix_post;
}

function dcIntimacyRhythm(pairCode) {
  const key = {
    1: 'dc_ir_1', 2: 'dc_ir_2', 3: 'dc_ir_3', 4: 'dc_ir_4',
    5: 'dc_ir_5', 6: 'dc_ir_6', 7: 'dc_ir_7', 8: 'dc_ir_8',
  }[pairCode] || 'dc_ir_default';
  return T[key];
}

function dcEnergyResonance(consA, consB, nameA, nameB) {
  const archA = profile(consA).archetype;
  const archB = profile(consB).archetype;
  if (consA !== consB) {
    if (goalGroup(consA) !== goalGroup(consB)) {
      return T.dc_er_diff_a + nameA + T.dc_er_diff_b + archA + T.dc_er_diff_c + nameB + T.dc_er_diff_d + archB + T.dc_er_diff_e;
    }
    return T.dc_er_close_a + nameA + T.dc_er_close_b + archA + T.dc_er_close_c + nameB + T.dc_er_close_d + archB + T.dc_er_close_e;
  }
  const triggerA = (shadow(consA).coreTrigger || '').toLowerCase();
  return T.dc_er_same_a + consA + T.dc_er_same_b + triggerA;
}

function dcMissionResonance(missionA, missionB, consA, consB, nameA, nameB) {
  const titleA = mission(missionA).title;
  const titleB = mission(missionB).title;
  if (missionA !== missionB) {
    if (missionA !== consB && missionB !== consA) {
      return T.dc_mr_diff_a + nameA + T.dc_mr_diff_b + titleA + T.dc_mr_diff_c + nameB + T.dc_mr_diff_d + titleB + T.dc_mr_diff_e;
    }
    return T.dc_mr_mirror;
  }
  return T.dc_mr_same_a + titleA + T.dc_mr_same_b;
}

function dcMoneyAndHousehold(consA, consB, sphereNumA, sphereNumB, nameA, nameB) {
  const channelA = (money(consA).moneyChannel || '').toLowerCase();
  const channelB = (money(consB).moneyChannel || '').toLowerCase();
  const sphereA = (sphere(sphereNumA).title || '').toLowerCase();
  const sphereB = (sphere(sphereNumB).title || '').toLowerCase();
  return T.dc_mah_1a + nameA + T.dc_mah_1b + channelA + '. '
    + nameB + T.dc_mah_2 + channelB + '. '
    + T.dc_mah_3a + sphereA + T.dc_mah_3b + sphereB + T.dc_mah_3c;
}

function dcConflictScenario(consA, consB, nameA, nameB) {
  const triggerA = (shadow(consA).coreTrigger || '').toLowerCase();
  const triggerB = (shadow(consB).coreTrigger || '').toLowerCase();
  return T.dc_cs_a + nameA + T.dc_cs_b + triggerA + T.dc_cs_c + nameB + T.dc_cs_d + triggerB + '. ' + dcConflictText(consA, consB);
}

function dcStrongestResources(pairCode, pairMission, sharedLines, complementEnergies) {
  const out = [];
  const p = profile(pairCode);
  const m = mission(pairMission);
  out.push(T.dc_sr_code_a + pairCode + T.dc_sr_code_b + p.archetype + ': ' + p.essence);
  out.push(T.dc_sr_mission_a + pairMission + T.dc_sr_mission_b + m.title + ': ' + m.goal);
  if (sharedLines.length > 0) {
    out.push(T.dc_sr_lines_a + sharedLines.join(', ').toLowerCase() + T.dc_sr_lines_b);
  }
  if (complementEnergies.length > 0) {
    out.push(T.dc_sr_matrix_a + complementEnergies.join(', ') + '.');
  }
  return distinct(out);
}

function dcRiskZones(consA, consB, nameA, nameB, sharedMissing) {
  const out = [];
  out.push(nameA + ': ' + karmic(consA).repeatingPattern);
  out.push(nameB + ': ' + karmic(consB).repeatingPattern);
  if (sharedMissing.length > 0) {
    out.push(T.dc_rz_missing_a + sharedMissing.join(', ') + T.dc_rz_missing_b);
  }
  out.push(T.dc_rz_tension);
  return distinct(out);
}

function dcDialogueKeys() {
  return [T.dc_dk_0, T.dc_dk_1, T.dc_dk_2, T.dc_dk_3];
}

function dcPractices() {
  return [T.dc_pr_0, T.dc_pr_1, T.dc_pr_2, T.dc_pr_3];
}

// ---------------------------------------------------------------------------
// Дата свадьбы (порт MarriageDateCalculator.calculate)
// ---------------------------------------------------------------------------

function mdScoreLabel(score) {
  if (score >= 84) return T.md_score_great;
  if (score >= 70) return T.md_score_good;
  if (score >= 56) return T.md_score_neutral;
  return T.md_score_low;
}

function mdRitualFocus(unionCode) {
  switch (unionCode) {
    case 1: return T.md_rf1;
    case 2: return T.md_rf2;
    case 3: return T.md_rf3;
    case 4: return T.md_rf4;
    case 5: return T.md_rf5;
    case 6: return T.md_rf6;
    case 7: return T.md_rf7;
    case 8: return T.md_rf8;
    default: return T.md_rf_default;
  }
}

function mdBuildHighlights(dayEnergy, unionCode, commonLines, personalYearResonance) {
  const out = [];
  out.push(fmt(T.md_hl_day, {
    n: dayEnergy,
    arch: (profile(dayEnergy).archetype || '').toLowerCase(),
    ess: (profile(dayEnergy).essence || '').toLowerCase(),
  }));
  out.push(fmt(T.md_hl_union, {
    n: unionCode,
    title: (mission(unionCode).title || '').toLowerCase(),
  }));
  if (dayEnergy === 2 || dayEnergy === 6) out.push(T.md_hl_intimacy);
  if (commonLines.length > 0) out.push(fmt(T.md_hl_lines, { lines: commonLines.join(', ').toLowerCase() }));
  if (personalYearResonance) out.push(T.md_hl_py);
  return out;
}

function mdBuildCautions(dayEnergy, unionCode) {
  const out = [];
  if (dayEnergy === 1) out.push(T.md_c1);
  if (dayEnergy === 3) out.push(T.md_c3);
  if (dayEnergy === 4) out.push(T.md_c4);
  if (dayEnergy === 5) out.push(T.md_c5);
  if (dayEnergy === 7) out.push(T.md_c7);
  if (dayEnergy === 8) out.push(T.md_c8);
  if (dayEnergy === 9) out.push(T.md_c9);
  if (dayEnergy === 5 || unionCode === 5) out.push(T.md_c_mercury); // isMercuryLike
  if (out.length === 0) out.push(T.md_c_fallback);
  return out;
}

// ---------------------------------------------------------------------------
// Карта семьи (порт FamilyMapCalculator.calculate)
// ---------------------------------------------------------------------------

function fmClimate(familyCode) {
  switch (familyCode) {
    case 1: return T.fm_clim_1;
    case 2: return T.fm_clim_2;
    case 3: return T.fm_clim_3;
    case 4: return T.fm_clim_4;
    case 5: return T.fm_clim_5;
    case 6: return T.fm_clim_6;
    case 7: return T.fm_clim_7;
    case 8: return T.fm_clim_8;
    default: return T.fm_clim_default;
  }
}

function fmBuildRoles(members) {
  return members.map(m => fmt(T.fm_role_line, {
    name: m.name,
    c: m.map.consciousness,
    archetype: (profile(m.map.consciousness).archetype || '').toLowerCase(),
    m: m.map.mission,
  }));
}

function fmBuildCommonResources(familyCode, familyMission, repeatedLines, prominentEnergies) {
  const out = [];
  const p = profile(familyCode);
  out.push(fmt(T.fm_res_code, {
    code: familyCode,
    archetype: (p.archetype || '').toLowerCase(),
    essence: (p.essence || '').toLowerCase(),
  }));
  if (repeatedLines.length > 0) {
    out.push(fmt(T.fm_res_repeated, { lines: repeatedLines.join(', ').toLowerCase() }));
  }
  if (prominentEnergies.length > 0) {
    out.push(fmt(T.fm_res_prominent, { energies: prominentEnergies.join(', ') }));
  }
  out.push(fmt(T.fm_res_mission, {
    mission: familyMission,
    missionTitle: (mission(familyMission).title || '').toLowerCase(),
  }));
  return out;
}

function fmBuildAttentionZones(familyCode, absentDigits, consciousnessNumbers) {
  const out = [];
  if (absentDigits.length > 0) out.push(fmt(T.fm_att_absent, { digits: absentDigits.join(', ') }));
  if (distinct(consciousnessNumbers).length === 1) out.push(T.fm_att_samebase);
  if (familyCode === 1 || familyCode === 8) out.push(T.fm_att_1_8);
  if (familyCode === 5) out.push(T.fm_att_5);
  if (familyCode === 7) out.push(T.fm_att_7);
  if (out.length === 0) out.push(T.fm_att_default);
  return out;
}

function fmFamilyRecommendations(familyMission, absentDigits) {
  const out = [];
  out.push(T.fm_rec_weekly);
  out.push(fmt(T.fm_rec_mission, { n: familyMission }));
  if (absentDigits.length > 0) out.push(fmt(T.fm_rec_energies, { list: absentDigits.join(', ') }));
  out.push(T.fm_rec_nocompare);
  return out;
}

// ---------------------------------------------------------------------------
// Публичные функции сборки отчётов
// ---------------------------------------------------------------------------

/**
 * Отчёт «Совместимость пары».
 * @param {{name:string, birthDate:{day,month,year}}} profileA
 * @param {{name:string, birthDate:{day,month,year}}} profileB
 * @returns {object} StructuredReport | {error}
 */
export function composePairReport(profileA, profileB) {
  if (!profileA || !profileB || !profileA.birthDate || !profileB.birthDate) {
    return { error: 'Нужны два профиля с датами рождения.' };
  }

  const nameA = safeName(profileA.name, 'Первый партнёр');
  const nameB = safeName(profileB.name, 'Второй партнёр');

  const mapA = calculateMap(profileA.birthDate);
  const mapB = calculateMap(profileB.birthDate);

  const base = calculateCompatibility(mapA, mapB);
  const pair = calculatePairMap(mapA, mapB);
  const deep = calculateDeepCompatibility(mapA, mapB);

  const bc = buildBaseCompat(mapA, mapB, nameA, nameB, base);

  const deepLevel = deepLevelLabel(deep.score);

  // --- Секция 1: Краткая совместимость (CompatibilityCalculator) ---
  const sectionBrief = {
    title: 'Краткая совместимость',
    subtitle: bc.overview,
    values: [
      { label: 'Уровень', value: bc.level },
    ],
    bulletGroups: [
      { title: 'Сильные стороны', bullets: bc.strengths },
      { title: 'Зоны настройки', bullets: bc.tensions },
      { title: 'Рекомендации', bullets: bc.recommendations },
    ],
  };

  // --- Секция 2: Карта пары (PairMapCalculator) ---
  const pairTitle = T.pm_title_a + nameA + T.pm_title_b + nameB;
  const sectionPairMap = {
    title: 'Карта пары',
    subtitle: pairTitle,
    values: [
      { label: 'Основная энергия', value: pmCoreEnergy(pair.pairCode) },
      { label: 'Эмоциональный фон', value: pmClimate(pair.pairCode) },
      { label: 'Ресурс союза', value: pmSharedResource(pair.commonLines) },
      { label: 'Вектор роста', value: pmGrowthVector(pair.pairMission, pair.commonEnergies) },
    ],
    bulletGroups: [
      { title: 'Правила диалога', bullets: pmDialogueRules() },
    ],
  };

  // --- Секция 3: Глубокая совместимость (DeepCompatibilityCalculator) ---
  const deepOverview = nameA + ' + ' + nameB + ': ' + deep.score + '% — ' + deepLevel + '. ' + T.dc_overview_tail;
  const sharedMissing = sharedMissingMatrix(mapA, mapB);
  const sectionDeep = {
    title: 'Глубокая совместимость',
    subtitle: deepOverview,
    values: [
      { label: 'Энергетический резонанс', value: dcEnergyResonance(mapA.consciousness, mapB.consciousness, nameA, nameB) },
      { label: 'Миссия пары', value: dcMissionResonance(mapA.mission, mapB.mission, mapA.consciousness, mapB.consciousness, nameA, nameB) },
      { label: 'Эмоциональный сценарий', value: dcEmotionalPattern(deep.pairCode, mapA.consciousness, mapB.consciousness) },
      { label: 'Деньги и быт', value: dcMoneyAndHousehold(mapA.consciousness, mapB.consciousness, mapA.sphere, mapB.sphere, nameA, nameB) },
      { label: 'Сценарий конфликта', value: dcConflictScenario(mapA.consciousness, mapB.consciousness, nameA, nameB) },
      { label: 'Ритм близости', value: dcIntimacyRhythm(deep.pairCode) },
      { label: 'Язык диалога', value: dcCommunicationLanguage(mapA.consciousness, mapB.consciousness) },
    ],
    bulletGroups: [
      { title: 'Ресурсы союза', bullets: dcStrongestResources(deep.pairCode, deep.pairMission, [...deep.commonLines].sort(), deep.complementary) },
      { title: 'Зоны риска', bullets: dcRiskZones(mapA.consciousness, mapB.consciousness, nameA, nameB, sharedMissing) },
      { title: 'Ключи диалога', bullets: dcDialogueKeys() },
      { title: 'Практики пары', bullets: dcPractices() },
    ],
  };

  return {
    title: 'Nomerolog',
    subtitle: 'Отчёт совместимости',
    meta: nameA + ' + ' + nameB,
    chips: [
      { k: 'Резонанс', v: deep.score + '%' },
      { k: 'Код пары', v: String(pair.pairCode) },
      { k: 'Миссия', v: String(pair.pairMission) },
    ],
    summary: [
      { label: 'Уровень', value: bc.level },
      { label: 'Код пары', value: String(pair.pairCode) },
      { label: 'Миссия пары', value: String(pair.pairMission) },
      { label: 'Глубокий резонанс', value: deep.score + '% · ' + deepLevel },
    ],
    sections: [sectionBrief, sectionPairMap, sectionDeep],
  };
}

/**
 * Отчёт «Карта семьи».
 * @param {Array<{name:string, birthDate:{day,month,year}, id?}>} profiles
 * @returns {object} StructuredReport | {error}
 */
export function composeFamilyReport(profiles) {
  if (!Array.isArray(profiles)) return { error: T.fm_error };

  // Дедупликация по id (либо по имени + дате, если id отсутствует).
  const seen = new Set();
  const members = [];
  for (const p of profiles) {
    if (!p || !p.birthDate) continue;
    const b = p.birthDate;
    const key = (p.id != null)
      ? String(p.id)
      : safeName(p.name, '') + '|' + b.day + '.' + b.month + '.' + b.year;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push({ name: safeName(p.name, 'Участник ' + (members.length + 1)), map: calculateMap(b) });
  }

  if (members.length < 2) return { error: T.fm_error };

  const maps = members.map(m => m.map);
  const fam = calculateFamilyMap(maps);

  // Непрокачанные (нулевые) энергии семейной матрицы.
  const absentDigits = [];
  for (let d = 1; d <= 9; d++) if (fam.matrix[d] === 0) absentDigits.push(d);

  // Топ-3 заметных энергии по убыванию суммы, при равенстве — по возрастанию цифры; только > 0.
  const promEntries = [];
  for (let d = 1; d <= 9; d++) promEntries.push([d, fam.matrix[d]]);
  promEntries.sort((x, y) => (y[1] - x[1]) || (x[0] - y[0]));
  const prominentEnergies = promEntries.slice(0, 3).filter(e => e[1] > 0).map(e => e[0]);

  const consciousnessNumbers = maps.map(m => m.consciousness);

  const emotionalClimate = fmClimate(fam.familyCode);
  const commonResources = fmBuildCommonResources(fam.familyCode, fam.familyMission, fam.commonLines, prominentEnergies);
  const roles = fmBuildRoles(members);
  const attentionZones = fmBuildAttentionZones(fam.familyCode, absentDigits, consciousnessNumbers);
  const recommendations = fmFamilyRecommendations(fam.familyMission, absentDigits);
  const overview = fmt(T.fm_overview, { size: fam.size });

  const section = {
    title: T.fm_title,
    subtitle: overview,
    values: [
      { label: 'Эмоциональный фон', value: emotionalClimate },
    ],
    bulletGroups: [
      { title: 'Ресурсы семьи', bullets: commonResources },
      { title: 'Роли участников', bullets: roles },
      { title: 'Зоны настройки', bullets: attentionZones },
      { title: 'Рекомендации', bullets: recommendations },
    ],
  };

  return {
    title: 'Nomerolog',
    subtitle: 'Расширенная карта семьи',
    meta: members.map(m => m.name).join(' + '),
    chips: [
      { k: 'Код семьи', v: String(fam.familyCode) },
      { k: 'Миссия', v: String(fam.familyMission) },
      { k: 'Участников', v: String(fam.size) },
    ],
    summary: [
      { label: 'Код семьи', value: String(fam.familyCode) },
      { label: 'Семейная миссия', value: String(fam.familyMission) },
      { label: 'Эмоциональный фон', value: emotionalClimate },
    ],
    sections: [section],
  };
}

/**
 * Отчёт «Дата свадьбы».
 * @param {string} marriageDateStr свободный ввод даты свадьбы
 * @param {{name:string, birthDate:{day,month,year}}} profileA
 * @param {{name:string, birthDate:{day,month,year}}} profileB
 * @returns {object} StructuredReport | {error}
 */
export function composeMarriageReport(marriageDateStr, profileA, profileB) {
  if (!profileA || !profileB || !profileA.birthDate || !profileB.birthDate) {
    return { error: 'Нужны два профиля с датами рождения.' };
  }

  const parsed = parseFutureDate(marriageDateStr, 'Введите дату брака');
  if (!parsed.ok) return { error: parsed.error };
  const marriage = parsed.value;

  const nameA = safeName(profileA.name, 'Первый партнёр');
  const nameB = safeName(profileB.name, 'Второй партнёр');

  const mapA = calculateMap(profileA.birthDate);
  const mapB = calculateMap(profileB.birthDate);

  const md = calculateMarriageDate(marriage, mapA, mapB); // {score, verdict, dayEnergy, dateMission}
  const dayEnergy = md.dayEnergy;
  const unionCode = md.dateMission;

  const dateStr = pad2(marriage.day) + '.' + pad2(marriage.month) + '.' + pad4(marriage.year);
  const scoreLabel = mdScoreLabel(md.score);

  const commonLines = commonLineTitles(mapA, mapB);
  const personalYearResonance = (mapA.personalYear === dayEnergy || mapB.personalYear === dayEnergy);

  const summaryText = fmt(T.md_sum, {
    n1: nameA, n2: nameB, date: dateStr, v11: dayEnergy, v13: unionCode,
  });
  const ritualFocus = mdRitualFocus(unionCode);
  const highlights = mdBuildHighlights(dayEnergy, unionCode, commonLines, personalYearResonance);
  const cautions = mdBuildCautions(dayEnergy, unionCode);

  const section = {
    title: 'Разбор даты',
    subtitle: scoreLabel,
    values: [
      { label: 'Дата', value: dateStr },
      { label: 'Резюме', value: summaryText },
      { label: 'Фокус ритуала', value: ritualFocus },
      { label: 'Важно помнить', value: T.md_close },
    ],
    bulletGroups: [
      { title: 'Акценты даты', bullets: highlights },
      { title: 'На что обратить внимание', bullets: cautions },
    ],
  };

  return {
    title: 'Nomerolog',
    subtitle: 'Дата свадьбы',
    meta: nameA + ' + ' + nameB,
    chips: [
      { k: 'Гармония', v: md.score + '%' },
      { k: 'Энергия дня', v: String(dayEnergy) },
      { k: 'Миссия даты', v: String(unionCode) },
    ],
    summary: [
      { label: 'Оценка', value: scoreLabel },
      { label: 'Энергия дня', value: String(dayEnergy) },
      { label: 'Миссия даты', value: String(unionCode) },
    ],
    sections: [section],
  };
}
