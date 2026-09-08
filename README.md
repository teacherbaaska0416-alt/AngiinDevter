# Ангийн Дэвтэр

Багш нарт зориулсан хичээл заах, шалгалт авах веб апп. React (Vite) + Supabase.

## 1. Supabase тохируулах

1. https://supabase.com дээр үнэгүй бүртгүүлж, шинэ project үүсгэнэ (Database password-оо тэмдэглэж ав).
2. Project нээгдсэний дараа зүүн талын цэснээс **SQL Editor** руу орно.
3. Энэ репо доторх `supabase-schema.sql` файлын бүх агуулгыг хуулж, SQL Editor-т буулгаад **Run** дарна.
4. Хэрэв өмнө нь хуучин schema ажиллуулсан бол **нэмж** `supabase-teacher-auth.sql`-ийг Run хийнэ (багшийн эрхийн policy).
5. Анги үүсгэх функц нэмэхийн тулд **нэмж** `supabase-classes.sql`-ийг Run хийнэ.
6. Сурагч бүртгэх функц нэмэхийн тулд **нэмж** `supabase-students.sql`-ийг Run хийнэ.
7. Хэрэв өмнө нь хуучин сурагчийн хүснэгт (зөвхөн нэг «нэр») байсан бол **нэмж** `supabase-students-v2.sql`-ийг Run хийнэ (Овог, Нэр, нэвтрэх нэр).
8. Сурагч нэвтрэх нэрээр нэвтрэхийн тулд **нэмж** `supabase-student-login.sql`-ийг Run хийнэ.
9. Шалгалтад зураг оруулахын тулд **нэмж** `supabase-quiz-images.sql`-ийг Run хийнэ.
10. Шалгалтын хугацаа / эхлүүлэх эрхийн тулд **нэмж** `supabase-quiz-timing.sql`-ийг Run хийнэ.
11. **Authentication → Providers → Email** идэвхтэй эсэхийг шалгана.
12. **Authentication → Users → Add user** дарж багшийн имэйл, нууц үг үүсгэнэ (эсвэл апп дээр бүртгүүлэхийг зөвшөөрнө).
13. Зүүн талын цэснээс **Project Settings → API** руу орж, дараах 2 утгыг хуулж ав:
   - **Project URL** (жишээ нь `https://xxxxx.supabase.co`)
   - **anon public key**

## 2. Локал дээр ажиллуулах

```bash
npm install
cp .env.example .env
```

`.env` файлыг нээгээд, дээрх Supabase URL болон anon key-гээ бичиж оруул:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Дараа нь:

```bash
npm run dev
```

`http://localhost:5173` дээр апп нээгдэнэ.

## 3. Vercel дээр deploy хийх

1. Энэ фолдерыг GitHub дээр шинэ repo болгож push хийнэ (эсвэл Vercel CLI ашиглаж болно).
2. https://vercel.com дээр нэвтэрч **Add New → Project** дарж, дээрх GitHub repo-г сонго.
3. Vercel автоматаар Vite төсөл гэдгийг таньж, Build command `npm run build`, Output directory `dist` гэж тохируулна (шаардлагатай бол өөрөө шалгаарай).
4. **Environment Variables** хэсэгт доорх 2 хувьсагчийг нэмнэ (`.env`-тэй адилхан утгууд):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Deploy** дарна. Хэдэн минутын дараа таны апп нээлттэй линктэй болно.

## Аюулгүй байдал

- **Багш**: Supabase Auth (имэйл + нууц үг) ашиглан нэвтэрнэ. Зөвхөн нэвтэрсэн багш л анги, хичээл, шалгалт нэмж, устгана.
- **Сурагч**: Багшийн бүртгэсэн **нэвтрэх нэр**-ээр нэвтэрнэ. Хичээл унших, шалгалт өгөх боломжтой.

## Шалгалт PDF/текстээс оруулах

Багш → **Шалгалт үүсгэх** → загвар татаж (эсвэл доорх форматаар) `.txt` / `.pdf` оруулна:

```
Гарчиг: Жишээ шалгалт
Хичээл: Математик

1. Асуултын текст?
А) Сонголт 1
Б) Сонголт 2
В) Сонголт 3
Г) Сонголт 4
Зөв: Б
```

Оруулсны дараа асуултуудыг шалгаад **Шалгалт хадгалах** дарна.

## Шалгалтын зураг

Асуулт болон хариултын сонголт бүрт зураг нэмэх боломжтой (JPG/PNG/WEBP/GIF, 3MB хүртэл).

1. Supabase SQL Editor-т **нэмж** `supabase-quiz-images.sql`-ийг Run хийнэ.
2. Багш → Шалгалт үүсгэх → асуулт/сонголт дээр **Зураг нэмэх**.
- Олон нийтэд нээлттэй бол **Authentication → Settings** дээр шинэ хэрэглэгч бүртгүүлэхийг (`Enable email signups`) идэвхгүй болгож, багшийн account-ыг зөвхөн dashboard-аас үүсгээрэй.

## Файлын бүтэц

```
angiin-devter/
├── src/
│   ├── App.jsx           ← гол апп (UI + логик)
│   ├── supabaseClient.js ← Supabase холболт
│   ├── main.jsx
│   └── index.css
├── supabase-schema.sql        ← Supabase-д ажиллуулах SQL (шинэ project)
├── supabase-teacher-auth.sql  ← Багшийн эрх — хуучин DB дээр migration
├── supabase-classes.sql       ← Анги хүснэгт — хуучин DB дээр migration
├── supabase-students.sql      ← Ангийн сурагчид — хуучин DB дээр migration
├── supabase-students-v2.sql   ← Овог/Нэр/нэвтрэх нэр — хуучин students шинэчлэх
├── supabase-student-login.sql ← Сурагч нэвтрэх нэрээр нэвтрэх RPC
├── supabase-quiz-images.sql   ← Шалгалтын зураг Storage bucket
├── supabase-quiz-timing.sql   ← Шалгалтын хугацаа + нээх/хаах
├── .env.example
├── vercel.json
└── package.json
```
