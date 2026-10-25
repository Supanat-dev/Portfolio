# Portfolio Analytics Dashboard

เว็บแยกสำหรับดูประวัติการเข้าชม Portfolio โดย source code อยู่ใน repository เดียวกับเว็บพอร์ต แต่ deploy เป็น Cloudflare Worker คนละ URL

## สิ่งที่ระบบเก็บ

- เวลาเริ่มเข้าชมและเวลาที่เห็นล่าสุด
- เวลาออกโดยประมาณและระยะเวลาที่อยู่บนเว็บ
- path/hash ที่เปิด, referrer, ภาษา, timezone, ขนาดหน้าจอ, ประเภทอุปกรณ์ และประเทศโดยประมาณ
- ไม่เก็บชื่อ อีเมล IP address หรือ cookie ติดตามข้ามแท็บ
- เคารพการตั้งค่า `Do Not Track` ของเบราว์เซอร์

## Deploy ครั้งแรก

ต้องมี Node.js และ Cloudflare account ที่เปิด Workers/D1

1. เข้าโฟลเดอร์นี้แล้วติดตั้ง dependency: `npm install`
2. Login: `npx wrangler login`
3. สร้างฐานข้อมูล: `npx wrangler d1 create portfolio-analytics`
4. นำ `database_id` ที่ได้ไปแทน `REPLACE_WITH_D1_DATABASE_ID` ใน `wrangler.jsonc`
5. ตั้ง origin ของเว็บพอร์ตใน `ALLOWED_ORIGINS` เช่น `https://supanat-dev.github.io` หากมีหลาย origin ให้คั่นด้วย comma
6. สร้าง Admin Token ที่ยาวและสุ่ม แล้วบันทึกเป็น secret: `npx wrangler secret put ADMIN_TOKEN`
7. รัน migration: `npm run db:migrate:remote`
8. Deploy: `npm run deploy`
9. นำ URL ที่ได้ไปใส่ใน `data-analytics-endpoint` ของ `index.html` ที่ root

จากนั้น deploy เว็บพอร์ตอีกครั้ง Tracker จึงเริ่มบันทึกข้อมูล

## ทดสอบในเครื่อง

1. รัน `npm run db:migrate:local`
2. สร้างไฟล์ `.dev.vars` (ไฟล์นี้ห้าม commit) โดยใส่ `ADMIN_TOKEN=รหัสสำหรับทดสอบ`
3. รัน `npm run dev`
4. เปิดเว็บพอร์ตที่ `http://localhost:8000` ซึ่งอยู่ใน allowlist เริ่มต้น

## ความแม่นยำของเวลาออก

Tracker ส่ง heartbeat ทุก 15 วินาทีและส่ง end event ตอนออกจากหน้า หากเบราว์เซอร์ถูกปิดทันทีหรือเน็ตหลุด ระบบจะใช้ heartbeat ล่าสุดและทำเครื่องหมาย `timeout` จึงอาจคลาดเคลื่อนได้ประมาณ 15–45 วินาที
