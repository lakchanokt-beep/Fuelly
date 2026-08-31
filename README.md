# Fuelly

เว็บ responsive สำหรับบันทึกและวิเคราะห์การเติมน้ำมัน โทนสีพาสเทล รองรับ desktop, tablet และ mobile

## ฟีเจอร์

- Dashboard สรุปค่าใช้จ่าย ระยะทาง อัตราการใช้น้ำมัน และจำนวนครั้งที่เติม
- บันทึก แก้ไข และลบรายการเติมน้ำมัน
- คำนวณราคารวม, km/L และ cost/km อัตโนมัติ
- ค้นหาและกรองประวัติตามปั๊มหรือเดือน
- Analytics พร้อมกราฟค่าใช้จ่าย ระยะทาง และประสิทธิภาพ
- รายงานรายเดือนที่พิมพ์หรือบันทึกเป็น PDF ได้
- เก็บข้อมูลใน `localStorage` พร้อม sample data

## วิธีรัน

ต้องใช้ Node.js 22.13 ขึ้นไป

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

สร้างเวอร์ชัน production:

```bash
npm run build
npm run start
```

## โครงสร้างข้อมูล

ชั้นจัดเก็บข้อมูลอยู่ใน `lib/fuel-repository.ts` และเปิดผ่าน `FuelRepository` interface หากต้องการย้ายไป Supabase ให้สร้าง repository ใหม่ที่ implement interface เดียวกัน แล้วเปลี่ยน export `fuelRepository` โดย UI ไม่ต้องแก้ตาม
