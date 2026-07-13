# AGENTS.md — Aturan Proyek (Project Rules)

Dokumen ini berisi aturan yang **wajib** diikuti saat mengembangkan, mengubah, atau meninjau kode di repositori ini. Aturan ini berlaku untuk semua kontributor manusia maupun AI agent.

## 🌐 Aturan Bahasa (Language Rule)

**Semua teks antarmuka (UI) pada dashboard dan seluruh respons dari API harus menggunakan Bahasa Inggris (English).**

Ketentuan detail:

1. **Dashboard / Frontend (React)**
   - Semua label, judul, tombol, placeholder, pesan error, tooltip, dan teks statis lainnya di UI harus berbahasa Inggris.
   - Jangan menambahkan teks bahasa Indonesia (atau bahasa lain) ke dalam komponen UI, kecuali itu adalah data dinamis dari pengguna (mis. nama yang diinput user).
   - Nama variabel, komponen, dan fungsi tetap mengikuti konvensi penamaan kode (bahasa Inggris), bukan teks yang ditampilkan ke pengguna.

2. **API Responses (Backend / Microservices)**
   - Semua pesan respons API — termasuk `message`, `error`, `description`, validasi field, dan status — harus berbahasa Inggris.
   - Jangan mengembalikan pesan error atau status dalam bahasa Indonesia (atau bahasa lain).
   - Log internal (server logs) boleh menggunakan bahasa yang dipakai tim, namun payload/respons yang dikirim ke klien (dashboard/app) harus selalu English.

3. **Dokumentasi API (OpenAPI/Swagger, contoh request/response)**
   - Contoh dan deskripsi endpoint juga menggunakan Bahasa Inggris agar konsisten dengan respons aktual.

> Catatan: Dokumentasi proyek (`planning.md`, `roadmap.md`, komentar deskriptif) boleh tetap berbahasa Indonesia karena ditujukan untuk tim internal, namun **produk yang diakses end-user (dashboard & API) selalu English**.
