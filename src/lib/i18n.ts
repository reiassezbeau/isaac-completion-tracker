// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * i18n — moteur de traduction léger, 100 % offline (aucune API réseau).
 * Langues : les 10 les plus parlées au monde + additions de la communauté Isaac
 * (allemand, polonais, japonais). Arabe/Ourdou en RTL.
 *
 * Catalogue = clé -> { par langue }. Repli : langue demandée -> anglais -> clé.
 * Les traductions non-latines (hi/ar/bn/ur/zh/ja) sont générées et perfectibles :
 * corrections communautaires bienvenues (projet open-source).
 */

export type Lang = "en" | "fr" | "es" | "pt" | "de" | "ru" | "pl" | "zh" | "ja" | "hi" | "ar" | "bn" | "ur";

export const LANGS: { code: Lang; native: string; rtl?: boolean }[] = [
  { code: "en", native: "English" },
  { code: "fr", native: "Français" },
  { code: "es", native: "Español" },
  { code: "pt", native: "Português" },
  { code: "de", native: "Deutsch" },
  { code: "ru", native: "Русский" },
  { code: "pl", native: "Polski" },
  { code: "zh", native: "中文" },
  { code: "ja", native: "日本語" },
  { code: "hi", native: "हिन्दी" },
  { code: "ar", native: "العربية", rtl: true },
  { code: "bn", native: "বাংলা" },
  { code: "ur", native: "اردو", rtl: true },
];

export const LANG_CODES: Lang[] = LANGS.map((l) => l.code);
export function isRtl(lang: Lang): boolean {
  return !!LANGS.find((l) => l.code === lang)?.rtl;
}

type Entry = Partial<Record<Lang, string>>;

// Chaque clé porte ses 13 traductions. en = repli universel.
const T: Record<string, Entry> = {
  // ── Navigation ──────────────────────────────────────────────────────────
  "nav.dashboard": { en: "Dashboard", fr: "Tableau de bord", es: "Panel", pt: "Painel", de: "Übersicht", ru: "Панель", pl: "Panel", zh: "总览", ja: "ダッシュボード", hi: "डैशबोर्ड", ar: "لوحة", bn: "ড্যাশবোর্ড", ur: "ڈیش بورڈ" },
  "nav.character": { en: "Character", fr: "Personnage", es: "Personaje", pt: "Personagem", de: "Charakter", ru: "Персонаж", pl: "Postać", zh: "角色", ja: "キャラクター", hi: "पात्र", ar: "الشخصية", bn: "চরিত্র", ur: "کردار" },
  "nav.grid": { en: "The Grid", fr: "La Grille", es: "La Rejilla", pt: "A Grade", de: "Das Raster", ru: "Сетка", pl: "Siatka", zh: "标记网格", ja: "グリッド", hi: "ग्रिड", ar: "الشبكة", bn: "গ্রিড", ur: "گرڈ" },
  "nav.predictor": { en: "Predictor", fr: "Prédicteur", es: "Predictor", pt: "Preditor", de: "Vorhersage", ru: "Предсказатель", pl: "Predyktor", zh: "预测器", ja: "予測", hi: "प्रेडिक्टर", ar: "المتنبئ", bn: "প্রেডিক্টর", ur: "پیش گو" },
  "nav.achievements": { en: "Achievements", fr: "Succès", es: "Logros", pt: "Conquistas", de: "Erfolge", ru: "Достижения", pl: "Osiągnięcia", zh: "成就", ja: "実績", hi: "उपलब्धियाँ", ar: "الإنجازات", bn: "অর্জন", ur: "کارنامے" },
  "nav.roadmap": { en: "Roadmap", fr: "Roadmap", es: "Hoja de ruta", pt: "Roteiro", de: "Fahrplan", ru: "План", pl: "Plan", zh: "路线图", ja: "ロードマップ", hi: "रोडमैप", ar: "خارطة الطريق", bn: "রোডম্যাপ", ur: "روڈ میپ" },
  "nav.optimizer": { en: "Optimizer", fr: "Optimiseur", es: "Optimizador", pt: "Otimizador", de: "Optimierer", ru: "Оптимизатор", pl: "Optymalizator", zh: "优化器", ja: "最適化", hi: "ऑप्टिमाइज़र", ar: "المُحسِّن", bn: "অপ্টিমাইজার", ur: "آپٹیمائزر" },
  "nav.build": { en: "Build Assistant", fr: "Assistant build", es: "Asistente de build", pt: "Assistente de build", de: "Build-Assistent", ru: "Помощник билда", pl: "Asystent buildu", zh: "配装助手", ja: "ビルド支援", hi: "बिल्ड सहायक", ar: "مساعد البناء", bn: "বিল্ড সহায়ক", ur: "بلڈ اسسٹنٹ" },
  "nav.stats": { en: "Stats", fr: "Stats", es: "Estadísticas", pt: "Estatísticas", de: "Statistik", ru: "Статистика", pl: "Statystyki", zh: "统计", ja: "統計", hi: "आँकड़े", ar: "الإحصاءات", bn: "পরিসংখ্যান", ur: "شماریات" },
  "nav.card": { en: "Card", fr: "Carte", es: "Tarjeta", pt: "Cartão", de: "Karte", ru: "Карточка", pl: "Karta", zh: "卡片", ja: "カード", hi: "कार्ड", ar: "بطاقة", bn: "কার্ড", ur: "کارڈ" },
  "nav.diagnostic": { en: "Diagnostic", fr: "Diagnostic", es: "Diagnóstico", pt: "Diagnóstico", de: "Diagnose", ru: "Диагностика", pl: "Diagnostyka", zh: "诊断", ja: "診断", hi: "निदान", ar: "التشخيص", bn: "ডায়াগনস্টিক", ur: "تشخیص" },
  "nav.settings": { en: "Overrides", fr: "Corrections", es: "Correcciones", pt: "Correções", de: "Korrekturen", ru: "Правки", pl: "Korekty", zh: "手动修正", ja: "修正", hi: "सुधार", ar: "التصحيحات", bn: "সংশোধন", ur: "درستیاں" },
  "nav.about": { en: "About", fr: "À propos", es: "Acerca de", pt: "Sobre", de: "Über", ru: "О программе", pl: "O aplikacji", zh: "关于", ja: "情報", hi: "बारे में", ar: "حول", bn: "সম্পর্কে", ur: "بارے میں" },

  // ── Actions communes ────────────────────────────────────────────────────
  "common.refresh": { en: "Refresh", fr: "Rafraîchir", es: "Actualizar", pt: "Atualizar", de: "Aktualisieren", ru: "Обновить", pl: "Odśwież", zh: "刷新", ja: "更新", hi: "ताज़ा करें", ar: "تحديث", bn: "রিফ্রেশ", ur: "ریفریش" },
  "common.loading": { en: "Opening the grimoire…", fr: "Ouverture du grimoire…", es: "Abriendo el grimorio…", pt: "Abrindo o grimório…", de: "Das Grimoire öffnet sich…", ru: "Открываем гримуар…", pl: "Otwieranie grimuaru…", zh: "正在打开魔典…", ja: "魔導書を開いています…", hi: "ग्रिमोयर खुल रहा है…", ar: "يُفتح الكتاب…", bn: "গ্রিমোয়ার খুলছে…", ur: "گریموار کھل رہا ہے…" },
  "common.cancel": { en: "Cancel", fr: "Annuler", es: "Cancelar", pt: "Cancelar", de: "Abbrechen", ru: "Отмена", pl: "Anuluj", zh: "取消", ja: "キャンセル", hi: "रद्द करें", ar: "إلغاء", bn: "বাতিল", ur: "منسوخ" },
  "common.gotIt": { en: "Got it", fr: "Compris", es: "Entendido", pt: "Entendi", de: "Verstanden", ru: "Понятно", pl: "Rozumiem", zh: "知道了", ja: "了解", hi: "समझ गया", ar: "فهمت", bn: "বুঝেছি", ur: "سمجھ گیا" },
  "common.later": { en: "Later", fr: "Plus tard", es: "Más tarde", pt: "Mais tarde", de: "Später", ru: "Позже", pl: "Później", zh: "以后", ja: "後で", hi: "बाद में", ar: "لاحقًا", bn: "পরে", ur: "بعد میں" },
  "common.search": { en: "Search…", fr: "Rechercher…", es: "Buscar…", pt: "Pesquisar…", de: "Suchen…", ru: "Поиск…", pl: "Szukaj…", zh: "搜索…", ja: "検索…", hi: "खोजें…", ar: "بحث…", bn: "খুঁজুন…", ur: "تلاش…" },

  // ── Écran d'accueil / chrome ──────────────────────────────────────────────
  "app.tagline": { en: "The Binding of Isaac · Repentance+", fr: "The Binding of Isaac · Repentance+" },
  "slot.pick": { en: "Choose your save. Auto-detected in Steam Cloud and Documents. Read-only — your save is never modified.", fr: "Choisis ta sauvegarde. Détection auto dans Steam Cloud et Documents. Lecture seule — ta save n'est jamais modifiée.", es: "Elige tu partida. Detección automática en Steam Cloud y Documentos. Solo lectura — tu partida nunca se modifica.", pt: "Escolha seu save. Detecção automática no Steam Cloud e Documentos. Somente leitura — seu save nunca é modificado.", de: "Wähle deinen Spielstand. Automatisch in Steam Cloud und Dokumente erkannt. Nur Lesen — dein Spielstand wird nie verändert.", ru: "Выберите сохранение. Автопоиск в Steam Cloud и «Документах». Только чтение — сохранение не изменяется.", pl: "Wybierz zapis. Automatyczne wykrywanie w Steam Cloud i Dokumentach. Tylko odczyt — zapis nigdy nie jest zmieniany.", zh: "选择你的存档。自动检测 Steam Cloud 和文档。只读——绝不修改你的存档。", ja: "セーブを選択。Steam Cloud とドキュメントを自動検出。読み取り専用でセーブは変更されません。", hi: "अपना सेव चुनें। Steam Cloud और Documents में स्वतः पहचान। केवल-पढ़ने — आपका सेव कभी नहीं बदला जाता।", ar: "اختر ملف الحفظ. كشف تلقائي في Steam Cloud والمستندات. للقراءة فقط — لا يُعدَّل ملفك أبدًا.", bn: "আপনার সেভ বেছে নিন। Steam Cloud ও Documents-এ স্বয়ংক্রিয় শনাক্তকরণ। কেবল-পঠন — আপনার সেভ কখনও পরিবর্তিত হয় না।", ur: "اپنا سیو منتخب کریں۔ Steam Cloud اور Documents میں خودکار شناخت۔ صرف پڑھنے کے لیے — آپ کا سیو کبھی تبدیل نہیں ہوتا۔" },
  "app.disclaimer": { en: "Isaac Completion Tracker · community tool, not affiliated with Nicalis / Edmund McMillen", fr: "Isaac Completion Tracker · outil communautaire, non affilié à Nicalis / Edmund McMillen", es: "Isaac Completion Tracker · herramienta comunitaria, sin afiliación con Nicalis / Edmund McMillen", pt: "Isaac Completion Tracker · ferramenta comunitária, sem afiliação com Nicalis / Edmund McMillen", de: "Isaac Completion Tracker · Community-Tool, nicht mit Nicalis / Edmund McMillen verbunden", ru: "Isaac Completion Tracker · любительский инструмент, не связан с Nicalis / Edmund McMillen", pl: "Isaac Completion Tracker · narzędzie społeczności, niezwiązane z Nicalis / Edmund McMillen", zh: "Isaac Completion Tracker · 社区工具，与 Nicalis / Edmund McMillen 无关", ja: "Isaac Completion Tracker · コミュニティ製、Nicalis / Edmund McMillen とは無関係", hi: "Isaac Completion Tracker · सामुदायिक उपकरण, Nicalis / Edmund McMillen से संबद्ध नहीं", ar: "Isaac Completion Tracker · أداة مجتمعية، غير تابعة لـ Nicalis / Edmund McMillen", bn: "Isaac Completion Tracker · কমিউনিটি টুল, Nicalis / Edmund McMillen-এর সাথে সম্পর্কিত নয়", ur: "Isaac Completion Tracker · کمیونٹی ٹول، Nicalis / Edmund McMillen سے وابستہ نہیں" },
  "settings.language": { en: "Language", fr: "Langue", es: "Idioma", pt: "Idioma", de: "Sprache", ru: "Язык", pl: "Język", zh: "语言", ja: "言語", hi: "भाषा", ar: "اللغة", bn: "ভাষা", ur: "زبان" },
};

/** Traduit une clé pour une langue (repli langue -> anglais -> clé). */
export function translate(key: string, lang: Lang): string {
  const e = T[key];
  if (!e) return key;
  return e[lang] ?? e.en ?? key;
}
