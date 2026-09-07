# Ангийн Дэвтэр

Багш нарт зориулсан хичээл заах, шалгалт авах веб апп. React (Vite) + Supabase.

## 1. Supabase тохируулах

1. https://supabase.com дээр үнэгүй бүртгүүлж, шинэ project үүсгэнэ (Database password-оо тэмдэглэж ав).
2. Project нээгдсэний дараа зүүн талын цэснээс **SQL Editor** руу орно.
3. Энэ репо доторх `supabase-schema.sql` файлын бүх агуулгыг хуулж, SQL Editor-т буулгаад **Run** дарна.
4. Хэрэв өмнө нь хуучин schema ажиллуулсан бол **нэмж** `supabase-teacher-auth.sql`-ийг Run хийнэ (багшийн эрхийн policy).
5. **Authentication → Providers → Email** идэвхтэй эсэхийг шалгана.
6. **Authentication → Users → Add user** дарж багшийн имэйл, нууц үг үүсгэнэ (эсвэл апп дээр бүртгүүлэхийг зөвшөөрнө).
7. Зүүн талын цэснээс **Project Settings → API** руу орж, дараах 2 утгыг хуулж ав:
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

- **Багш**: Supabase Auth (имэйл + нууц үг) ашиглан нэвтэрнэ. Зөвхөн нэвтэрсэн багш л хичээл/шалгалт нэмж, устгана.
- **Сурагч**: Нэр оруулж орно (нэвтрэлтгүй). Хичээл унших, шалгалт өгөх боломжтой.
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
├── .env.example
├── vercel.json
└── package.json
```
