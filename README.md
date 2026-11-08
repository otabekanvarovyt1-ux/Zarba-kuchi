# Zarba Kuchi — onlayn (internetda o'ynash)

Bu papkada o'yin + uni internetga chiqaradigan kichik server bor.
Server jangni hisoblamaydi, faqat xonalarni boshqaradi va o'yinchilarning tugma bosishlarini uzatadi,
shuning uchun u juda yengil (bitta kichik server 100+ xonaga yetadi).

## Fayllar
- `public/index.html` — o'yinning o'zi (bitta fayl)
- `server.js` — xona serveri (Node.js)
- `Dockerfile`, `package.json` — joylash uchun

## A) Kompyuteringizda sinab ko'rish (ixtiyoriy)
```
npm install
npm start
```
Brauzerda `http://localhost:8080` ni ikki oynada oching: birida "ONLAYN > XONA YARATISH", ikkinchisida kodni kiriting.

## B) Google Cloud Run'ga joylash (brauzerning o'zida, kompyuter dasturisiz)
1. https://console.cloud.google.com ga kiring, yangi **Project** yarating va **Billing** (to'lov kartasi) ulang.
   Cloud Run'ning bepul limiti bor: kichik o'yin uchun odatda $0 yoki juda arzon.
2. Yuqori o'ng burchakdagi **Cloud Shell** tugmasini (>_) bosing, pastda terminal ochiladi.
3. Cloud Shell menyusidan (⋮) **Upload** orqali `zarba-online.zip` ni yuklang va quyidagini yozing:
```
unzip -o zarba-online.zip -d zarba && cd zarba
gcloud run deploy zarba-kuchi --source . --region europe-west1 --allow-unauthenticated --max-instances 1 --timeout 3600
```
   (Birinchi marta API'larni yoqishni so'rasa, `y` deb javob bering.)
4. Oxirida `Service URL: https://zarba-kuchi-xxxx.a.run.app` chiqadi. Shu havola — sizning o'yiningiz.
   Uni do'stlaringizga yuboring: bosh menyuda **ONLAYN** tugmasi paydo bo'ladi.

> Muhim: `--max-instances 1` o'zgartirilmasin: xonalar server xotirasida saqlanadi, shuning uchun
> hamma o'yinchi bitta serverga ulanishi kerak.

## C) Render.com (bepul, kartasiz variant)
1. Papkani GitHub'ga yuklang.
2. render.com > New > Web Service > shu repozitoriyni tanlang. Build: `npm install`, Start: `npm start`.
3. Bepul tarifda server 15 daqiqa jim turgach uxlaydi: birinchi kirish ~30 soniya olishi mumkin.

## Qanday ishlaydi / cheklovlar
- Hamma o'yinchi bir xil jangni o'z qurilmasida hisoblaydi, tarmoq orqali faqat tugmalar ketadi (kechikish ~0.1 s qo'shiladi).
- Egasi har 0.5 soniyada holat nusxasini yuboradi; farq bo'lsa, avtomatik to'g'rilanadi.
- Kimdir chiqib ketsa, uning o'rnini CPU oladi. Xona egasi chiqsa, xona yopiladi.
- Telefonda brauzer yorlig'i orqada qolsa (boshqa ilovaga o'tilsa), jang hamma uchun qisqa to'xtab turadi.
- Xona kodi 4 harf; havola `?room=KOD` bilan to'g'ridan-to'g'ri xonaga kiritadi.
