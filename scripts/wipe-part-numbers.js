/**
 * scripts/wipe-part-numbers.js
 *
 * Menghapus SEMUA dokumen di koleksi "partNumbers" di Firestore.
 * Dipakai sekali untuk mengosongkan database part number lama, supaya
 * mulai sekarang database itu hanya tumbuh otomatis dari hasil import
 * Pesanan Customer (lihat lib/firestore.js > importOrderRows).
 *
 * PERINGATAN: Aksi ini TIDAK BISA dibatalkan. Pastikan kamu memang mau
 * menghapus semuanya sebelum konfirmasi.
 *
 * Cara pakai:  npm run wipe-parts
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
if (!fs.existsSync(keyPath)) {
  console.error(
    "\n[wipe] serviceAccountKey.json tidak ditemukan di root project.\n" +
      "Download dari Firebase Console > Project Settings > Service Accounts,\n" +
      "lalu simpan dengan nama itu di root folder project ini.\n"
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();

async function countDocs(colName) {
  const snap = await db.collection(colName).count().get();
  return snap.data().count;
}

async function deleteCollection(colName, batchSize = 400) {
  const colRef = db.collection(colName);
  let totalDeleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    totalDeleted += snap.size;
    console.log(`[wipe]   terhapus ${totalDeleted}...`);
  }
  return totalDeleted;
}

(async () => {
  const total = await countDocs("partNumbers");
  if (total === 0) {
    console.log("[wipe] Koleksi partNumbers sudah kosong. Tidak ada yang dihapus.");
    process.exit(0);
  }

  console.log(`\nIni akan menghapus SEMUA ${total} dokumen di koleksi "partNumbers".`);
  console.log("Pesanan yang sudah ada TIDAK terhapus, tapi Part Number-nya jadi belum");
  console.log("terdaftar lagi sampai diisi ulang lewat import Excel atau form pesanan.");
  console.log("Aksi ini TIDAK BISA dibatalkan.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) =>
    rl.question('Ketik "HAPUS" (huruf besar semua) untuk konfirmasi, lalu Enter: ', resolve)
  );
  rl.close();

  if (answer.trim() !== "HAPUS") {
    console.log("\n[wipe] Dibatalkan. Tidak ada yang dihapus.");
    process.exit(0);
  }

  console.log("\n[wipe] Menghapus...");
  const deleted = await deleteCollection("partNumbers");
  console.log(`\n[wipe] Selesai. ${deleted} part number terhapus dari Firestore.`);
  process.exit(0);
})().catch((err) => {
  console.error("[wipe] Gagal:", err);
  process.exit(1);
});
