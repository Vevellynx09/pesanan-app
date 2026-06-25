# Pesanan Customer — Sales Logistics

Aplikasi web untuk mengelola pesanan customer: pencarian & filter pesanan,
input cepat dari Beranda, validasi Part Number terhadap database yang
sudah diimpor, master data dropdown yang dikontrol admin, serta
import/export Excel. Dibangun dengan **Next.js 14** + **Firebase Firestore**,
siap deploy ke **Vercel**.

Hanya ada satu peran pengguna: **admin** (login lewat Firebase Authentication).

---

## 1. Struktur Data Firestore

| Koleksi | Isi |
|---|---|
| `orders` | Setiap dokumen = 1 baris pesanan (DLV Type, PO No., Part Number, Nama Customer, Sales, Nomor Nota, Status, riwayat pengiriman, dst). |
| `partNumbers` | Database part number yang sudah divalidasi. ID dokumen = part number (huruf besar). Dipakai untuk dropdown-search Part Number — part number yang tidak ada di sini **tidak bisa** dipilih/disimpan. |
| `masterData` | 4 dokumen: `sales`, `status`, `dlvType`, `loc`. Masing-masing berisi `{ items: [...] }` — inilah daftar yang dikontrol admin di halaman **Master Data**. |
| `_meta` | Dokumen penanda internal (status seeding awal). |

Data awal kamu (192 baris Pesanan Customer + 21.097 Part Number dari
file Excel yang diunggah) sudah dikonversi ke `data/orders.seed.json`
dan `data/partNumbers.seed.json`, siap diimpor lewat `scripts/seed.js`.

---

## 2. Setup Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. Di project itu, aktifkan **Firestore Database** (mode production, pilih region terdekat misalnya `asia-southeast2`).
3. Aktifkan **Authentication** → tab **Sign-in method** → aktifkan **Email/Password**.
4. Di tab **Users**, klik **Add user**, buat akun admin (email + password). Ini akun yang dipakai untuk login ke aplikasi.
5. Buka **Project Settings (⚙) > General**, scroll ke **Your apps**, klik **Web (`</>`)**, daftarkan app baru. Salin nilai `firebaseConfig` yang muncul.
6. Terapkan aturan keamanan: buka **Firestore Database > Rules**, tempel isi file `firestore.rules` dari project ini, klik **Publish**.

## 3. Setup Project Lokal

```bash
# 1. Install dependencies
npm install

# 2. Salin file environment
cp .env.local.example .env.local
```

Isi `.env.local` dengan nilai dari `firebaseConfig` Firebase Console:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 4. Import Data Awal ke Firestore

1. Di Firebase Console → **Project Settings > Service Accounts** → klik **Generate new private key**. File akan terdownload.
2. Simpan file itu dengan nama **`serviceAccountKey.json`** di root folder project ini (sudah masuk `.gitignore`, tidak akan ikut ter-commit/ter-deploy).
3. Jalankan:

```bash
npm run seed
```

Proses ini akan mengunggah:
- 21.097 part number ke koleksi `partNumbers` (sekali jalan, aman diulang — data akan di-update/merge)
- 192 pesanan awal ke koleksi `orders` (hanya sekali; kalau dijalankan ulang otomatis dilewati)
- Master data default untuk Status (`Open, Proses, Sebagian Kirim, Selesai, Batal`), DLV Type (`REG, EMG`), dan Lokasi (`JPN, JKT`). Daftar **Sales** dikosongkan dulu — tambahkan nama sales lewat halaman **Master Data** di aplikasi.

Proses ini memakan waktu beberapa menit karena jumlah part number cukup besar.

## 5. Jalankan Lokal

```bash
npm run dev
```

Buka `http://localhost:3000`, login dengan akun admin yang dibuat di langkah 2.4.

---

## 6. Deploy ke Vercel (dari Git)

1. Push project ini ke repository GitHub/GitLab/Bitbucket kamu:
   ```bash
   git init
   git add .
   git commit -m "Inisialisasi aplikasi Pesanan Customer"
   git remote add origin <url-repo-kamu>
   git push -u origin main
   ```
2. Buka [vercel.com](https://vercel.com) → **Add New > Project** → pilih repo tersebut.
3. Vercel otomatis mendeteksi Next.js. Sebelum **Deploy**, buka bagian **Environment Variables** dan isi 6 variabel `NEXT_PUBLIC_FIREBASE_...` yang sama seperti di `.env.local`.
4. Klik **Deploy**. Setelah selesai, Vercel memberi URL publik (`https://nama-project.vercel.app`) — itulah preview/produksi aplikasi kamu yang sudah terhubung ke Firestore yang sama dengan yang dipakai `npm run seed`.

Setiap kali kamu push ke branch utama, Vercel otomatis build & deploy ulang.

---

## 7. Fitur yang Tersedia

- **Beranda** — ringkasan jumlah pesanan, dan form input cepat (Nama Customer ditulis langsung, Sales/DLV Type/Part Number dropdown-search, Nomor Nota teks).
- **Pesanan Customer** — tabel semua pesanan dengan pencarian Nama Customer/PO/Part Number/Nomor Nota, filter dropdown-search untuk Sales, Status, dan DLV Type. Tambah/edit pesanan lewat modal, termasuk riwayat pengiriman bertahap.
- **Master Data** — admin menambah/menghapus isi daftar dropdown Sales, Status, DLV Type, Lokasi. Juga ada pencarian cepat ke database Part Number.
- **Import / Export** —
  - Export seluruh pesanan ke `.xlsx`.
  - Import pesanan dari `.xlsx` — setiap baris divalidasi Part Number-nya; baris dengan Part Number yang tidak ada di database akan ditolak dan ditampilkan di daftar error.
  - Import/update database Part Number dari `.xlsx`.

## 8. Catatan Teknis

- Validasi Part Number: ID dokumen di koleksi `partNumbers` = part number itu sendiri (huruf besar), jadi pengecekan "ada/tidak ada" cukup satu `getDoc`. Pencarian dropdown menggunakan query awalan (`prefix query`) langsung ke Firestore, bukan menarik semua 21rb dokumen ke browser.
- Karena hanya ada satu peran (admin), tidak ada sistem role/permission bertingkat — siapa pun yang berhasil login dianggap admin. Jangan bagikan kredensial admin ke pihak yang tidak berwenang.
- Batas tulis Firestore per `batch()` adalah 500 operasi; semua proses bulk (seed & import) sudah dipecah otomatis per 450 dokumen agar aman.
