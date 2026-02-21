# 🪙 Dompetku — Expense Tracker

Aplikasi pelacak keuangan pribadi berbasis web yang ringan, cepat, dan bisa dijalankan langsung di browser tanpa instalasi apapun.

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## ✨ Fitur

- 🔐 **Login & Registrasi** — Sistem autentikasi berbasis username & password, data tersimpan per akun
- 💰 **Pemasukan** — Catat sumber pendapatan dengan kategori, tanggal, dan catatan
- 💸 **Pengeluaran** — Pantau pengeluaran harian secara detail
- 📊 **Ringkasan** — Dashboard dengan 3 jenis grafik interaktif:
  - Bar chart tren 6 bulan terakhir
  - Doughnut chart pengeluaran per kategori
  - Line chart arus kas 30 hari terakhir
- 🏷️ **Kategori Kustom** — Tambah & hapus kategori sendiri dengan emoji
- 🔍 **Filter** — Filter transaksi berdasarkan kategori dan bulan
- 📱 **Responsive** — Tampilan menyesuaikan di desktop maupun mobile

---

## 🗂️ Struktur File

```
dompetku/
├── index.html    # Struktur & elemen HTML
├── style.css     # Styling & tema soft blue
├── app.js        # Logika aplikasi (auth, CRUD, grafik)
└── README.md     # Dokumentasi ini
```

---

## 🚀 Cara Menjalankan Lokal

### Opsi 1 — Live Server (VS Code)
1. Install extension **Live Server** di VS Code
2. Klik kanan `index.html` → **Open with Live Server**
3. Buka `http://127.0.0.1:5500`

### Opsi 2 — Buka Langsung
1. Double klik file `index.html`
2. Otomatis terbuka di browser default

---

> 💡 **Catatan:** Data pengguna tersimpan di `localStorage` browser masing-masing. Artinya data hanya ada di browser/device yang digunakan untuk mendaftar — tidak sinkron antar device.

---

## 🛠️ Teknologi

| Teknologi | Kegunaan |
|-----------|----------|
| HTML5 | Struktur halaman |
| CSS3 | Styling & animasi |
| Vanilla JavaScript | Logika aplikasi |
| localStorage | Penyimpanan data per user |
| [Chart.js](https://www.chartjs.org/) | Grafik interaktif |
| [Google Fonts](https://fonts.google.com/) | Font Playfair Display & DM Sans |

---

