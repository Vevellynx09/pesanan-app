/**
 * scripts/seed.js
 *
 * Mengisi Firestore dengan:
 *  - Pesanan Customer awal (data/orders.seed.json) — 192 baris dari sheet
 *    "Pesanan Customer" (kolom Nama Customer/Sales/Nomor Nota/Status masih
 *    kosong, siap diisi admin lewat aplikasi)
 *  - Part Number yang dipakai 192 pesanan itu didaftarkan otomatis ke
 *    koleksi "partNumbers" (perilaku sama seperti import Excel di aplikasi)
 *  - Master data default (sales kosong, status/dlvType/loc terisi default)
 *
 * CATATAN: Database Part Number TIDAK lagi diisi massal lewat script ini.
 * Part Number baru otomatis terdaftar setiap kali ada pesanan yang
 * memakainya (lewat script ini, lewat import Excel di aplikasi, atau lewat
 * form tambah pesanan). Untuk mengosongkan ulang koleksi partNumbers,
 * pakai scripts/wipe-part-numbers.js.
 *
 * Cara pakai:
 *   1. Download service account key dari:
 *      Firebase Console > Project Settings > Service Accounts > Generate new private key
 *      Simpan sebagai serviceAccountKey.json di root project (sudah di .gitignore).
 *   2. Jalankan:  npm run seed
 *
 * Aman dijalankan berulang kali — pesanan awal HANYA ditambahkan sekali
 * (cek flag di _meta/ordersSeed).
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
if (!fs.existsSync(keyPath)) {
  console.error(
    "\n[seed] serviceAccountKey.json tidak ditemukan di root project.\n" +
      "Download dari Firebase Console > Project Settings > Service Accounts,\n" +
      "lalu simpan dengan nama itu di root folder project ini.\n"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

const db = admin.firestore();

function partDocId(partNumber) {
  return String(partNumber).trim().toUpperCase().replace(/\//g, "-");
}

async function seedOrdersAndRegisterParts() {
  const marker = db.collection("_meta").doc("ordersSeed");
  const markerSnap = await marker.get();
  if (markerSnap.exists) {
    console.log("[seed] Pesanan awal sudah pernah diimpor sebelumnya, dilewati.");
    console.log("       (hapus dokumen _meta/ordersSeed di Firestore untuk impor ulang)\n");
    return;
  }

  const file = path.join(__dirname, "..", "data", "orders.seed.json");
  const orders = JSON.parse(fs.readFileSync(file, "utf-8"));
  console.log(`[seed] Mengunggah ${orders.length} pesanan awal...`);

  // Daftarkan Part Number yang dipakai pesanan-pesanan ini ke koleksi
  // partNumbers (kalau belum ada), sama seperti yang dilakukan saat
  // import Excel di aplikasi.
  const uniqueParts = new Map();
  orders.forEach((o) => {
    const pn = String(o.partNumber).toUpperCase();
    if (!uniqueParts.has(pn)) uniqueParts.set(pn, o.partName || "");
  });
  console.log(`[seed] Mendaftarkan ${uniqueParts.size} Part Number unik ke database...`);
  const partEntries = Array.from(uniqueParts.entries());
  for (let i = 0; i < partEntries.length; i += 450) {
    const chunk = partEntries.slice(i, i + 450);
    const batch = db.batch();
    chunk.forEach(([pn, name]) => {
      const ref = db.collection("partNumbers").doc(partDocId(pn));
      batch.set(ref, { partNumber: pn, description: name, partType: "", retailPrice: 0 }, { merge: true });
    });
    await batch.commit();
  }

  const CHUNK = 450;
  for (let i = 0; i < orders.length; i += CHUNK) {
    const chunk = orders.slice(i, i + CHUNK);
    const batch = db.batch();
    chunk.forEach((o) => {
      const ref = db.collection("orders").doc();
      batch.set(ref, {
        ...o,
        partNumber: String(o.partNumber).toUpperCase(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    console.log(`[seed]   ${Math.min(i + CHUNK, orders.length)}/${orders.length}`);
  }
  await marker.set({ seededAt: admin.firestore.FieldValue.serverTimestamp(), count: orders.length });
  console.log("[seed] Pesanan awal & Part Number terkait selesai diunggah.\n");
}

async function seedMasterData() {
  const defaults = {
    sales: [],
    status: ["Open", "Proses", "Sebagian Kirim", "Selesai", "Batal"],
    dlvType: ["REG", "EMG"],
    loc: ["JPN", "JKT"],
  };
  console.log("[seed] Menyiapkan master data default (tidak menimpa yang sudah ada)...");
  for (const [key, items] of Object.entries(defaults)) {
    const ref = db.collection("masterData").doc(key);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ items });
      console.log(`[seed]   masterData/${key} dibuat.`);
    } else {
      console.log(`[seed]   masterData/${key} sudah ada, dilewati.`);
    }
  }
  console.log("[seed] Master data selesai.\n");
}

(async () => {
  console.log("=== Seeding Firestore: Pesanan Customer App ===\n");
  await seedOrdersAndRegisterParts();
  await seedMasterData();
  console.log("=== Selesai. Data siap dipakai di aplikasi. ===");
  process.exit(0);
})().catch((err) => {
  console.error("[seed] Gagal:", err);
  process.exit(1);
});
