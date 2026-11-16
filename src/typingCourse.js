// Монгол кирилл гар: суурь хуруу Й Ы Б Ө | Р О Л Д. Гүвгэр товч нь Ө (F) ба Р (J).

export const PASS_ACCURACY = 0.9;

export const FINGER_LABEL = {
  lp: "Зүүн чигчий",
  lr: "Зүүн ядам",
  lm: "Зүүн дунд",
  li: "Зүүн долоовор",
  ri: "Баруун долоовор",
  rm: "Баруун дунд",
  rr: "Баруун ядам",
  rp: "Баруун чигчий",
  th: "Эрхий хуруу",
};

export const FINGER_COLOR = {
  lp: "#D46A4C",
  lr: "#D4923A",
  lm: "#C4A035",
  li: "#2F8F6B",
  ri: "#2C6FAE",
  rm: "#5A62B0",
  rr: "#8A5696",
  rp: "#C45C78",
  th: "#6B6858",
};

function letter(ch, finger, extra = {}) {
  const lower = ch.toLocaleLowerCase("mn");
  const upper = ch.toLocaleUpperCase("mn");
  return { id: lower, label: upper, finger, chars: [lower, upper], ...extra };
}

export const KEY_ROWS = [
  [
    letter("1", "lp"),
    letter("2", "lr"),
    letter("3", "lm"),
    letter("4", "li"),
    letter("5", "li"),
    letter("6", "ri"),
    letter("7", "ri"),
    letter("8", "rm"),
    letter("9", "rr"),
    letter("0", "rp"),
    letter("Е", "rp"),
    letter("Щ", "rp"),
  ],
  [
    letter("Ф", "lp"),
    letter("Ц", "lr"),
    letter("У", "lm"),
    letter("Ж", "li"),
    letter("Э", "li"),
    letter("Н", "ri"),
    letter("Г", "ri"),
    letter("Ш", "rm"),
    letter("Ү", "rr"),
    letter("З", "rp"),
    letter("К", "rp"),
    letter("Ъ", "rp"),
  ],
  [
    letter("Й", "lp"),
    letter("Ы", "lr"),
    letter("Б", "lm"),
    letter("Ө", "li", { bump: true }),
    letter("А", "li"),
    letter("Х", "ri"),
    letter("Р", "ri", { bump: true }),
    letter("О", "rm"),
    letter("Л", "rr"),
    letter("Д", "rp"),
    letter("П", "rp"),
  ],
  [
    { id: "shift-l", label: "Shift", finger: "lp", shift: "left", wide: true },
    letter("Я", "lp"),
    letter("Ч", "lr"),
    letter("Ё", "lm"),
    letter("С", "li"),
    letter("М", "li"),
    letter("И", "ri"),
    letter("Т", "ri"),
    letter("Ь", "rm"),
    letter("В", "rr"),
    letter("Ю", "rp"),
    { id: "shift-r", label: "Shift", finger: "rp", shift: "right", wide: true },
  ],
];

const CHAR_FINGER = { " ": "th" };
for (const row of KEY_ROWS) {
  for (const key of row) {
    for (const ch of key.chars || []) CHAR_FINGER[ch] = key.finger;
  }
}

export function fingerFor(ch) {
  if (!ch) return null;
  return CHAR_FINGER[ch] || CHAR_FINGER[ch.toLocaleLowerCase("mn")] || null;
}

export function isUpperCyr(ch) {
  if (!ch || ch === " ") return false;
  const lower = ch.toLocaleLowerCase("mn");
  const upper = ch.toLocaleUpperCase("mn");
  return ch === upper && lower !== upper;
}

export function shiftSideFor(ch) {
  if (!isUpperCyr(ch)) return null;
  const finger = fingerFor(ch);
  if (!finger || finger === "th") return null;
  return finger.startsWith("l") ? "right" : "left";
}

export const TYPING_SECTIONS = [
  { id: "home", title: "Суурь мөр", blurb: "Й · Ы · Б · Ө · А · Х · Р · О · Л · Д · П" },
  { id: "top", title: "Дээд мөр", blurb: "Ф · Ц · У · Ж · Э · Н · Г · Ш · Ү · З · К · Ъ" },
  { id: "bottom", title: "Доод мөр", blurb: "Я · Ч · Ё · С · М · И · Т · Ь · В · Ю · Е" },
  { id: "words", title: "Үг ба өгүүлбэр", blurb: "Монгол хэлээр бүтэн бичнэ" },
  { id: "shift", title: "Том үсэг", blurb: "Эсрэг гарын чигчийгээр Shift дарна" },
  { id: "speed", title: "Хурд", blurb: "Зорилт 20, 30, 40 үг минутад" },
];

const HOME = "өрбоылйдахп";
const TOP = "жнэгушцүфзкъ";
const BOTTOM = "симтчвяюёье";

function lesson(spec) {
  const lower = spec.chars;
  const upper = spec.upper ? lower.toLocaleUpperCase("mn") : "";
  const allow = new Set(`${lower}${upper} `.split(""));
  for (const ch of spec.prompt) {
    if (!allow.has(ch)) {
      throw new Error(`Дасгал ${spec.id}: «${ch}» үсэг зөвшөөрөгдөөгүй (${lower})`);
    }
  }
  return spec;
}

const RAW = [
  lesson({
    id: "t01",
    section: "home",
    title: "Танилцуулга",
    focus: "Ө Р",
    kind: "intro",
    chars: "өр",
    goalWpm: 8,
    tip: "Зүүн долоовор Ө дээр, баруун долоовор Р дээр. Гар руу бүү хар.",
    steps: [
      "Нуруугаа тэгшлэн суу. Бугуй ширээнд тулахгүй, дэлгэц нүдний түвшинд байна.",
      "Зүүн долоовор Ө, баруун долоовор Р товч дээр. Хоёр товч бага зэрэг гүвгэр тул харалгүй олдоно.",
      "Үсэг бүрийн дараа хуруугаа суурь байрлалд буцаа. Гар руу харахгүй, зөвхөн дэлгэц рүү хар.",
    ],
    prompt: "өр өр өр рө рө өр",
  }),
  lesson({
    id: "t02",
    section: "home",
    title: "Ө ба Р товч",
    focus: "ө р",
    chars: "өр",
    goalWpm: 8,
    tip: "Ө-г зүүн долоовор, Р-г баруун долоовор дарж, буцаад суурь дээрээ тавь.",
    prompt: "өө рр өр рө өөр рөр өрө өр",
  }),
  lesson({
    id: "t03",
    section: "home",
    title: "Зай",
    focus: "зай",
    chars: "өр",
    goalWpm: 8,
    tip: "Үгийн хоорондох зайг баруун эрхий хуруугаараа дарна.",
    prompt: "ө р ө р өр рө ө р өр",
  }),
  lesson({
    id: "t04",
    section: "home",
    title: "Давтлага: Ө ба Р",
    focus: "өр",
    chars: "өр",
    goalWpm: 10,
    tip: "Алдаа гарвал зогсоод зөв товчийг мэдэр. Буцах товч ашиглахгүй.",
    prompt: "өр рө өөр рөр өрөө рөрө өр рө",
  }),
  lesson({
    id: "t05",
    section: "home",
    title: "Б ба О товч",
    focus: "б о",
    chars: "өрбо",
    goalWpm: 10,
    tip: "Б-г зүүн дунд хуруу, О-г баруун дунд хуруу дарна.",
    prompt: "бб оо бо об ббо ооб бо об",
  }),
  lesson({
    id: "t06",
    section: "home",
    title: "Давтлага: Б ба О",
    focus: "бо",
    chars: "өрбо",
    goalWpm: 10,
    tip: "Дундах хуруу дарсны дараа Ө ба Р дээрээ буц.",
    prompt: "бо об бороо обб өр боо бор",
  }),
  lesson({
    id: "t07",
    section: "home",
    title: "Дасгал: Б ба О",
    focus: "бор",
    chars: "өрбо",
    goalWpm: 12,
    tip: "Богино үгийг бүхэлд нь нэг хэмнэлээр бич.",
    prompt: "бор обр өр бо өрөө бороо бор өр",
  }),
  lesson({
    id: "t08",
    section: "home",
    title: "Тоглоом: өрбө",
    focus: "өрбө",
    chars: "өрбо",
    goalWpm: 12,
    tip: "Үсэг бүрийг зөв хуруугаар дар. Хурд одоо чухал биш.",
    prompt: "өр бор обр өрөө бороо бор өр бороо",
  }),
  lesson({
    id: "t09",
    section: "home",
    title: "Ы ба Л товч",
    focus: "ы л",
    chars: "өрбоыл",
    goalWpm: 12,
    tip: "Ы-г зүүн ядам, Л-г баруун ядам хуруу дарна.",
    prompt: "ыы лл ыл лы лыы ыллы ыл лы",
  }),
  lesson({
    id: "t10",
    section: "home",
    title: "Давтлага: Ы ба Л",
    focus: "ыл",
    chars: "өрбоыл",
    goalWpm: 12,
    tip: "Ядам хуруу сууриасаа нэг товч л холдох ёстой.",
    prompt: "ыл лы бол ыл өр лы лол бол",
  }),
  lesson({
    id: "t11",
    section: "home",
    title: "Дасгал: Ы ба Л",
    focus: "бол",
    chars: "өрбоыл",
    goalWpm: 12,
    tip: "Бол, өл, лол гэдгийг харалгүй бичиж үз.",
    prompt: "бол өл ыл лол олы бор ыл бол",
  }),
  lesson({
    id: "t12",
    section: "home",
    title: "Й ба Д товч",
    focus: "й д",
    chars: "өрбоылйд",
    goalWpm: 12,
    tip: "Й-г зүүн чигчий, Д-г баруун чигчий хуруу дарна.",
    prompt: "йй дд йд дй дой йод йд дй",
  }),
  lesson({
    id: "t13",
    section: "home",
    title: "Давтлага: Й ба Д",
    focus: "дой",
    chars: "өрбоылйд",
    goalWpm: 12,
    tip: "Чигчий хуруу дарсны дараа заавал суурь товч руугаа буц.",
    prompt: "дойр йод бол дор өр дй дой",
  }),
  lesson({
    id: "t14",
    section: "home",
    title: "Эхний найман товч",
    focus: "8",
    chars: "өрбоылйд",
    goalWpm: 14,
    tip: "Суурь найм: Й Ы Б Ө ба Р О Л Д.",
    prompt: "бол дор өрөө дойр йод ылд бол",
  }),
  lesson({
    id: "t15",
    section: "home",
    title: "А ба Х товч",
    focus: "а х",
    chars: "өрбоылйдах",
    goalWpm: 14,
    tip: "А-г зүүн долоовор Ө-өөс баруун тийш, Х-г баруун долоовор Р-ээс зүүн тийш дарж буц.",
    prompt: "аа хх ах ха хар айл ах ха",
  }),
  lesson({
    id: "t16",
    section: "home",
    title: "П товч",
    focus: "п",
    chars: HOME,
    goalWpm: 14,
    tip: "П-г баруун чигчий хуруу Д-ээс баруун тийш дарна.",
    prompt: "пп оп ап пай айл оп пай",
  }),
  lesson({
    id: "t17",
    section: "home",
    title: "Суурь мөрийн үг",
    focus: "үй",
    chars: HOME,
    goalWpm: 14,
    tip: "Одоо суурь мөрөөр богино монгол үг бичнэ.",
    prompt: "ах айл байр хоол орой хайр өрөө бороо далай хар дол дөл хөл одоо",
  }),
  lesson({
    id: "t18",
    section: "top",
    title: "Ж ба Н товч",
    focus: "ж н",
    chars: HOME + "жн",
    goalWpm: 14,
    tip: "Ж-г зүүн долоовор дээш, Н-г баруун долоовор дээш дарж сууриндаа буц.",
    prompt: "жж нн жн нж нар жан өн жор",
  }),
  lesson({
    id: "t19",
    section: "top",
    title: "Давтлага: Ж ба Н",
    focus: "нар",
    chars: HOME + "жн",
    goalWpm: 14,
    tip: "Нар, жан, жор гэдгийг суурь хуруугаа алдалгүй бич.",
    prompt: "нар жан жон өн жор нар жан",
  }),
  lesson({
    id: "t20",
    section: "top",
    title: "Э ба Г товч",
    focus: "э г",
    chars: HOME + "жнэг",
    goalWpm: 14,
    tip: "Э-г зүүн долоовор, Г-г баруун долоовор дээд мөрөнд дарна.",
    prompt: "ээ гг эг гэ гар гэр өглөө гар",
  }),
  lesson({
    id: "t21",
    section: "top",
    title: "У ба Ш товч",
    focus: "у ш",
    chars: HOME + "жнэгуш",
    goalWpm: 14,
    tip: "У-г зүүн дунд, Ш-г баруун дунд хуруу дээшлэнэ.",
    prompt: "уу шш уш шу уул шуу гар уул",
  }),
  lesson({
    id: "t22",
    section: "top",
    title: "Ц ба Ү товч",
    focus: "ц ү",
    chars: HOME + "жнэгушцү",
    goalWpm: 14,
    tip: "Ц-г зүүн ядам, Ү-г баруун ядам хуруу дээд мөрөнд дарна.",
    prompt: "цц үү цэ үг хүн цэнхэр үг",
  }),
  lesson({
    id: "t23",
    section: "top",
    title: "Ф ба З товч",
    focus: "ф з",
    chars: HOME + "жнэгушцүфз",
    goalWpm: 14,
    tip: "Ф-г зүүн чигчий, З-г баруун чигчий хуруу дээш дарна.",
    prompt: "фф зз аз уз зун зураг зун",
  }),
  lesson({
    id: "t24",
    section: "top",
    title: "К ба Ъ товч",
    focus: "к ъ",
    chars: HOME + TOP,
    goalWpm: 14,
    tip: "К ба Ъ-г баруун чигчий хуруу З-ээс цааш дарна. Ъ монгол үгэнд ховор.",
    prompt: "кк ъъ ак ка къ ак ка",
  }),
  lesson({
    id: "t25",
    section: "top",
    title: "Дээд мөр бүтэн",
    focus: "дээш",
    chars: HOME + TOP,
    goalWpm: 16,
    tip: "Дээд мөрөөс дарсан хуруу бүрийг суурь Ө эсвэл Р дээр буцаа.",
    prompt: "зун өглөө нар гарлаа хүн гэр өөд харна",
  }),
  lesson({
    id: "t26",
    section: "bottom",
    title: "С ба И товч",
    focus: "с и",
    chars: HOME + TOP + "си",
    goalWpm: 16,
    tip: "С-г зүүн долоовор, И-г баруун долоовор доош дарж буц.",
    prompt: "сс ии си ис сайн нар ис",
  }),
  lesson({
    id: "t27",
    section: "bottom",
    title: "М ба Т товч",
    focus: "м т",
    chars: HOME + TOP + "симт",
    goalWpm: 16,
    tip: "М-г зүүн долоовор, Т-г баруун долоовор доод мөрөнд дарна.",
    prompt: "мм тт монгол там мат сайн монгол",
  }),
  lesson({
    id: "t28",
    section: "bottom",
    title: "Ч ба В товч",
    focus: "ч в",
    chars: HOME + TOP + "симтчв",
    goalWpm: 16,
    tip: "Ч-г зүүн ядам, В-г баруун ядам хуруу доош дарна.",
    prompt: "чч вв чанар сав овоо чанар",
  }),
  lesson({
    id: "t29",
    section: "bottom",
    title: "Я ба Ю товч",
    focus: "я ю",
    chars: HOME + TOP + "симтчвяю",
    goalWpm: 16,
    tip: "Я-г зүүн чигчий, Ю-г баруун чигчий хуруу доод мөрөнд дарна.",
    prompt: "яя юю баяр аялал юу яа баяр",
  }),
  lesson({
    id: "t30",
    section: "bottom",
    title: "Ё ба Ь товч",
    focus: "ё ь",
    chars: HOME + TOP + "симтчвяюёь",
    goalWpm: 16,
    tip: "Ё-г зүүн дунд, Ь-г баруун дунд хуруу доош дарна.",
    prompt: "ёё ьь хоёр амь соль баяр хоёр",
  }),
  lesson({
    id: "t31",
    section: "bottom",
    title: "Доод мөр бүтэн",
    focus: "доош",
    chars: HOME + TOP + BOTTOM,
    goalWpm: 16,
    tip: "Доод мөрөөс буцаж Ө ба Р товчны гүвгэрийг мэдэр.",
    prompt: "баяр хоёр монгол сайн аялал хоол хоёр",
  }),
  lesson({
    id: "t32",
    section: "bottom",
    title: "Е үсэг",
    focus: "е",
    chars: HOME + TOP + BOTTOM + "е",
    goalWpm: 16,
    tip: "Е үсэг тооны эгнээнд, 0-ийн баруун талд. Баруун чигчий хуруугаар дарна.",
    prompt: "ее энэ бие хэл сур ес энэ хэл",
  }),
  lesson({
    id: "t33",
    section: "words",
    title: "Богино үг",
    focus: "ном",
    chars: HOME + TOP + BOTTOM + "е",
    goalWpm: 18,
    tip: "Үгийг үсэгчлэн бүү хэл. Хуруу өөрөө олох ёстой.",
    prompt: "ном гар гэр хүн ус зун сар өдөр ном",
  }),
  lesson({
    id: "t34",
    section: "words",
    title: "Өдөр тутмын үг",
    focus: "өглөө",
    chars: HOME + TOP + BOTTOM + "е",
    goalWpm: 18,
    tip: "Зайгаар үгийг салга. Эрхий хуруу зөвхөн зай дарна.",
    prompt: "өглөө босоод номоо уншина өглөө ном",
  }),
  lesson({
    id: "t35",
    section: "words",
    title: "Өгүүлбэр",
    focus: "бид",
    chars: HOME + TOP + BOTTOM + "е",
    goalWpm: 18,
    tip: "Өгүүлбэрийг таслалгүй, жигд хурдаар бич.",
    prompt: "өнөөдөр бид ангидаа монгол хэлээр бичиж сурна",
  }),
  lesson({
    id: "t36",
    section: "words",
    title: "Арван хуруу",
    focus: "хуруу",
    chars: HOME + TOP + BOTTOM + "е",
    goalWpm: 18,
    tip: "Урт үг дээр хурууны сууриа бүү алд.",
    prompt: "арван хуруугаараа дэлгэц рүү харж бичээрэй",
  }),
  lesson({
    id: "t37",
    section: "words",
    title: "Догол мөр",
    focus: "хэл",
    chars: HOME + TOP + BOTTOM + "е",
    goalWpm: 18,
    tip: "Алдаа гарсан ч дараагийн үсэг рүү бүү үсэр. Зөв товчийг дарж үргэлжил.",
    prompt: "монгол хэл бол бидний эх хэл өдөр бүр арван хуруугаараа дасгал хийвэл гар чинь өөрөө зөв товчийг олно",
  }),
  lesson({
    id: "t38",
    section: "shift",
    title: "Том Ө ба Р",
    focus: "Ө Р",
    chars: HOME + TOP + BOTTOM + "е",
    upper: true,
    goalWpm: 16,
    tip: "Зүүн гарын үсэгт баруун Shift, баруун гарын үсэгт зүүн Shift. Нөгөө гарын чигчий дарна.",
    prompt: "Өр Рө Өрөө Бор Өр Рө",
  }),
  lesson({
    id: "t39",
    section: "shift",
    title: "Нэр",
    focus: "Нэр",
    chars: HOME + TOP + BOTTOM + "е",
    upper: true,
    goalWpm: 16,
    tip: "Нэрийн эхний үсгийг Shift дарж том бич. Shift-ээ түрүүлж дар.",
    prompt: "Болд Саран Өнөр Болд Саран",
  }),
  lesson({
    id: "t40",
    section: "shift",
    title: "Өгүүлбэрийн эхлэл",
    focus: "Аа",
    chars: HOME + TOP + BOTTOM + "е",
    upper: true,
    goalWpm: 18,
    tip: "Өгүүлбэр том үсгээр эхэлнэ. Бусад үсэг жижиг хэвээр.",
    prompt: "Өнөөдөр бид сургуульдаа ирлээ Багш маань сайхан заалаа",
  }),
  lesson({
    id: "t41",
    section: "speed",
    title: "Зорилт 20 үг",
    focus: "20",
    chars: HOME + TOP + BOTTOM + "е",
    upper: true,
    goalWpm: 20,
    tip: "Гурван од авахын тулд 20 үг/мин хурд, 98% нарийвчлал хэрэгтэй. 90% хүрвэл дараагийнх нээгдэнэ.",
    prompt: "Өглөө бүр арван хуруугаараа дасгал хий Гар руу харахгүй дэлгэц рүү хар Алдаа гаргавал удаан дарж зөв товчийг олоорой",
  }),
  lesson({
    id: "t42",
    section: "speed",
    title: "Зорилт 30 үг",
    focus: "30",
    chars: HOME + TOP + BOTTOM + "е",
    upper: true,
    goalWpm: 30,
    tip: "Эхлээд зөв, дараа нь хурдан. Хуруу сууриасаа гарч буцаж байг.",
    prompt: "Монгол хэлээр хурдан бичихийн тулд өдөр бүр дасгал хийх хэрэгтэй Эхлээд зөв хуруугаар удаан дар Хурд аяндаа нэмэгдэнэ Нуруугаа тэгшлэн сууж бугуйгаа чөлөөтэй байлга",
  }),
  lesson({
    id: "t43",
    section: "speed",
    title: "Зорилт 40 үг",
    focus: "40",
    chars: HOME + TOP + BOTTOM + "е",
    upper: true,
    goalWpm: 40,
    tip: "Нэг минутад 40 үг бол сургуулийн сайн түвшин. Амжихгүй бол нарийвчлалаа хадгалаад дахин ор.",
    prompt: "Сургууль дээр бид монгол хэл математик түүх үздэг Би өдөр бүр ном уншиж арван хуруугаараа тэмдэглэлээ бичдэг Зөв сууж гар руу харалгүй бичвэл алдаа багасна Ингэж дасгалж байвал нэг минутад олон үг бичиж сурна",
  }),
];

export const TYPING_LESSONS = RAW.map((item, index) => ({ ...item, n: index + 1 }));

export function starsFor(result, goalWpm) {
  if (!result || result.accuracy < PASS_ACCURACY) return 0;
  if (result.accuracy >= 0.98 && result.wpm >= (goalWpm || 0)) return 3;
  if (result.accuracy >= 0.96) return 2;
  return 1;
}

function storageKey(studentId) {
  return `angiin-typing-v1:${studentId || "guest"}`;
}

export function loadTypingProgress(studentId) {
  try {
    const raw = localStorage.getItem(storageKey(studentId));
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export function saveTypingResult(studentId, lessonId, result) {
  const all = loadTypingProgress(studentId);
  if (!result || result.accuracy < PASS_ACCURACY) return all;
  const prev = all[lessonId];
  const stars = starsFor(result, result.goalWpm);
  const record = {
    accuracy: result.accuracy,
    wpm: result.wpm,
    stars,
    passed: true,
    at: Date.now(),
  };
  const better = !prev?.passed
    || stars > (prev.stars || 0)
    || (stars === (prev.stars || 0) && result.accuracy > (prev.accuracy || 0));
  if (!better) return all;
  const next = { ...all, [lessonId]: record };
  try {
    localStorage.setItem(storageKey(studentId), JSON.stringify(next));
  } catch {
    // ignore quota
  }
  return next;
}

export function mergeTypingLessons(overrides) {
  const byId = new Map((overrides || []).filter((row) => row?.id).map((row) => [row.id, row]));
  return TYPING_LESSONS.map((lesson, index) => {
    const over = byId.get(lesson.id);
    if (!over) return lesson;
    const title = String(over.title || "").trim();
    const focus = String(over.focus || "").trim();
    const prompt = String(over.prompt || "").trim();
    const goal = Number(over.goalWpm);
    return {
      ...lesson,
      title: title || lesson.title,
      focus: focus || lesson.focus,
      tip: over.tip == null ? lesson.tip : String(over.tip),
      prompt: prompt || lesson.prompt,
      goalWpm: goal > 0 ? goal : lesson.goalWpm,
      n: index + 1,
      edited: true,
    };
  });
}

export function isLessonUnlocked(index, progress, lessons = TYPING_LESSONS) {
  if (index <= 0) return true;
  const prev = lessons[index - 1];
  return Boolean(prev && progress?.[prev.id]?.passed);
}

export function typingScore(progress) {
  return Object.values(progress || {}).reduce((sum, row) => sum + (row?.passed ? (row.stars || 0) * 100 : 0), 0);
}

export function passedCount(progress, lessons = TYPING_LESSONS) {
  return lessons.filter((lesson) => progress?.[lesson.id]?.passed).length;
}
