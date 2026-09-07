# Ангийн Дэвтэр

Багш нарт зориулсан хичээл заах, шалгалт авах веб апп. React (Vite) + Supabase.

## 1. Supabase тохируулах

1. https://supabase.com дээр үнэгүй бүртгүүлж, шинэ project үүсгэнэ (Database password-оо тэмдэглэж ав).
2. Project нээгдсэний дараа зүүн талын цэснээс **SQL Editor** руу орно.
3. Энэ репо доторх `supabase-schema.sql` файлын бүх агуулгыг хуулж, SQL Editor-т буулгаад **Run** дарна. Ингэснээр `lessons`, `quizzes`, `attempts` гэсэн 3 хүснэгт болон холбогдох эрхүүд (RLS policy) үүснэ.
4. Зүүн талын цэснээс **Project Settings → API** руу орж, дараах 2 утгыг хуулж ав:
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

## Аюулгүй байдлын тэмдэглэл

Одоогийн `supabase-schema.sql` дотор байгаа Row Level Security policy-үүд нь **нээлттэй** — хэн ч (linktай хүн бүр) хичээл/шалгалт нэмэх, устгах боломжтой. Жижиг ангийн хэрэглээнд энэ хангалттай, гэхдээ олон нийтэд нээлттэй болгож байгаа бол дараах зүйлсийг нэмэхийг зөвлөж байна:

- Supabase Auth ашиглан багш нарт нэвтрэх систем нэмэх
- Зөвхөн нэвтэрсэн багш л `insert`/`delete` хийх боломжтой болгож RLS policy-г чангатгах

Хэрэв ийм нэвтрэлтийн систем нэмэх шаардлагатай бол хэлээрэй, нэмж хөгжүүлье.

## Файлын бүтэц

```
angiin-devter/
├── src/
│   ├── App.jsx           ← гол апп (UI + логик)
│   ├── supabaseClient.js ← Supabase холболт
│   ├── main.jsx
│   └── index.css
├── supabase-schema.sql   ← Supabase-д ажиллуулах SQL
├── .env.example
├── vercel.json
└── package.json
```
