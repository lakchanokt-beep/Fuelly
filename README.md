# Fuelly

เว็บ responsive สำหรับบันทึกและวิเคราะห์การเติมน้ำมัน พร้อม Google Login และซิงก์ข้อมูลข้ามอุปกรณ์ผ่าน Supabase

## ฟีเจอร์

- Dashboard สรุปค่าใช้จ่าย ระยะทาง อัตราการใช้น้ำมัน และจำนวนครั้งที่เติม
- บันทึก แก้ไข ลบ ค้นหา และกรองประวัติการเติมน้ำมัน
- คำนวณราคารวม, km/L และ cost/km อัตโนมัติ
- Analytics และรายงานรายเดือน
- Google Login พร้อมแยกข้อมูลของผู้ใช้ด้วย Supabase Row Level Security
- ดึงราคาน้ำมันล่าสุดและเก็บ snapshot รายวันบน Supabase เวลา 07:05 น. (เวลาไทย)
- เลือกวันที่ย้อนหลังเพื่อใช้ราคาที่บันทึกไว้ของวันนั้น หากไม่มีข้อมูลจะให้กรอกจากใบเสร็จแทน

> ประวัติราคาจะเริ่มสะสมตั้งแต่วันที่เปิดใช้ระบบ snapshot เป็นต้นไป ระบบไม่ใช้ราคาปัจจุบันแทนวันที่ย้อนหลังที่ไม่มีข้อมูล

## พัฒนาในเครื่อง

ต้องใช้ Node.js 22.13 ขึ้นไป

```bash
npm install
copy .env.example .env.local
npm run dev
```

กำหนดค่าต่อไปนี้ใน `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## ตรวจและ build

```bash
npm run lint
npm run build
```

## Deploy ไป Cloudflare Workers

โปรเจกต์เตรียม `wrangler.jsonc` และคำสั่ง deploy ไว้แล้ว

```bash
npx wrangler login
npm run deploy:vinext
```

ก่อน deploy ให้ตั้ง environment variables สองรายการข้างต้นใน Cloudflare Worker หรือ Workers Builds ที่เชื่อมกับ GitHub จากนั้นนำ URL `*.workers.dev` หรือ custom domain ไปเพิ่มใน Supabase Auth Redirect URLs และ Google OAuth Authorized JavaScript origins
