// Function Lab — сабақ және нұсқа деректері.
// Бұл файлды өзгерту арқылы сабақтың мәтіні мен нұсқаларын жаңартуға болады,
// интерфейс логикасына тиіспей-ақ.

export const LESSON_INFO = {
  university: "Қ. Жұбанов атындағы Ақтөбе өңірлік университеті",
  subject: "Python-да қосымшалар құру",
  topic: "Python-дағы функциялар",
  subtopic: "Қайталанатын кодтан шағын қосымшаға",
  program: "6B06103 — Есептеу техникасы және программалық қамтамасыз ету",
  course: 3,
  semester: 5,
  week: 6,
  duration: "50 минут",
  studentCount: 8,
  date: "14.10.2026",
  startTime: "11:10",
  room: "519 б.",
  teacher: "Практикант Елеуберген Ж.А.",
  supervisor: "Байбактина А.Т.",
  defaultGroup: "",
};

export const TIME_MAP = [
  { range: "0–2 мин", title: "Ұйымдастыру" },
  { range: "2–5 мин", title: "Мәселе қою" },
  { range: "5–13 мин", title: "Түсіндіру" },
  { range: "13–18 мин", title: "Орындамай тұрып болжау" },
  { range: "18–33 мин", title: "Жеке практикалық жұмыс" },
  { range: "33–41 мин", title: "Жұптық тексеру" },
  { range: "41–46 мин", title: "Шағын қорғау" },
  { range: "46–50 мин", title: "Қорытынды, бағалау, үй тапсырмасы" },
];

export const SECTIONS = [
  { id: "start", num: 1, title: "Бастау", time: "≈ 5 мин", doing: "Сабақ мақсатын және мәселені танысу" },
  { id: "understand", num: 2, title: "Түсіну", time: "≈ 8 мин", doing: "Функция теориясын оқу, мысалды орындау" },
  { id: "predict", num: 3, title: "Болжау", time: "≈ 5 мин", doing: "Нәтижені алдын ала болжап, тексеру" },
  { id: "variant", num: 4, title: "Менің нұсқам", time: "≈ 15 мин", doing: "Өз нұсқаңызда функция жазу" },
  { id: "check", num: 5, title: "Тексеру", time: "≈ 13 мин", doing: "Автотест, жұптық тексеру, шағын қорғау" },
  { id: "summary", num: 6, title: "Қорытынды", time: "≈ 4 мин", doing: "Рефлексия, үй тапсырмасы, жұмысты сақтау" },
];

// price × quantity × (1 − discount/100) — барлық нұсқаларға ортақ формула.
export const VARIANTS = [
  { id: 1, title: "Кино билеттерінің құны", funcName: "ticket_total", price: 1500, quantity: 2, discount: 10, fee: 200, unitLabel: "билет саны" },
  { id: 2, title: "Құжат басып шығару құны", funcName: "print_total", price: 50, quantity: 40, discount: 10, fee: 100, unitLabel: "бет саны" },
  { id: 3, title: "Коворкингтегі жұмыс орнының құны", funcName: "workspace_total", price: 800, quantity: 3, discount: 10, fee: 150, unitLabel: "күн саны" },
  { id: 4, title: "Велосипедті жалға алу құны", funcName: "rental_total", price: 1200, quantity: 2, discount: 10, fee: 100, unitLabel: "сағат саны" },
  { id: 5, title: "Оқу курсы сабақтарының құны", funcName: "course_total", price: 2000, quantity: 4, discount: 10, fee: 300, unitLabel: "сабақ саны" },
  { id: 6, title: "Сәлемдемелерді жеткізу құны", funcName: "parcel_total", price: 700, quantity: 5, discount: 10, fee: 250, unitLabel: "сәлемдеме саны" },
  { id: 7, title: "Компьютер жабдықтарын сатып алу құны", funcName: "hardware_total", price: 3500, quantity: 2, discount: 10, fee: 200, unitLabel: "дана саны" },
  { id: 8, title: "Бұлттық сақтау қызметінің құны", funcName: "storage_total", price: 900, quantity: 6, discount: 10, fee: 100, unitLabel: "ай саны" },
];

export function getVariant(id) {
  return VARIANTS.find((v) => v.id === Number(id)) || null;
}

// Дұрыс мәндерді әрқашан осы формула арқылы есептейміз — жауап кілтін
// қолмен қайта теріп, қате жібермеу үшін.
export function trueResult(price, quantity, discount) {
  return price * quantity * (1 - discount / 100);
}

export function makeTestCases(variant) {
  return [
    {
      key: "normal",
      label: "Қалыпты деректер",
      args: [variant.price, variant.quantity, variant.discount],
      expected: trueResult(variant.price, variant.quantity, variant.discount),
    },
    {
      key: "qty0",
      label: "quantity = 0",
      args: [variant.price, 0, variant.discount],
      expected: trueResult(variant.price, 0, variant.discount),
    },
    {
      key: "disc0",
      label: "discount = 0",
      args: [variant.price, variant.quantity, 0],
      expected: trueResult(variant.price, variant.quantity, 0),
    },
  ];
}

export function variantSkeleton(variant) {
  return `def ${variant.funcName}(price, quantity, discount):
    # Есептеуді жазыңыз және нәтижені қайтарыңыз
    pass

# Функцияны шақырыңыз
# Қайтарылған нәтижеге қызмет ақысын қосыңыз
# Нәтижелерді экранға шығарыңыз
`;
}

export const GUIDING_QUESTIONS = [
  "Қандай үш параметр қажет?",
  "Есептелген мәнді қай жол қайтарады?",
  "Жеңілдік пайызын тұрақты 10 санымен емес, қай параметрмен беру керек?",
  "Қызмет ақысын функцияның ішінде ме, сыртында ма қосасыз?",
];

export const THEORY_EXAMPLE_CODE = `def calculate_total(price, quantity):
    amount = price * quantity
    return amount

subtotal = calculate_total(1500, 2)
total = subtotal + 200
print(total)
`;

export const PREDICT_EXAMPLE_CODE = `def calculate_total(price, quantity):
    print(price * quantity)

result = calculate_total(1500, 2)
print(result)
`;

export const PREDICT_FIXED_CODE = `def calculate_total(price, quantity):
    return price * quantity

result = calculate_total(1500, 2)
total = result + 200
print(total)
`;

export const GRADING = {
  total: 100,
  criteria: [
    {
      code: "К1",
      title: "Функцияны анықтау және шақыру",
      items: [
        { label: "дұрыс синтаксис пен шегініс", points: 10 },
        { label: "функцияны дұрыс шақыру", points: 10 },
      ],
    },
    {
      code: "К2",
      title: "Параметрлер",
      items: [
        { label: "үш параметрді қолдану", points: 10 },
        { label: "аргументтерді параметрлерге сәйкес беру", points: 10 },
      ],
    },
    {
      code: "К3",
      title: "Есептеу және return",
      items: [
        { label: "есептеу формуласының дұрыстығы", points: 10 },
        { label: "мәнді қайтарып, оған функция сыртында қызмет ақысын қосу", points: 10 },
      ],
    },
    {
      code: "К4",
      title: "Тестілеу",
      items: [
        { label: "үш талап етілген жағдайды тексеру", points: 10 },
        { label: "күтілетін және нақты нәтижелерді салыстырып, қорытынды жазу", points: 10 },
      ],
    },
    {
      code: "К5",
      title: "Түсіндіру және кері байланыс",
      items: [
        { label: "функцияның кірісі мен нәтижесін түсіндіру", points: 10 },
        { label: "серіктесіне нақты тестке сүйенген кері байланыс беру", points: 10 },
      ],
    },
  ],
  descriptor: [
    { range: "10 балл", desc: "толық әрі дербес орындалса" },
    { range: "5 балл", desc: "ішінара немесе бағыттаушы сұрақпен орындалса" },
    { range: "0 балл", desc: "орындалмаса" },
  ],
};
