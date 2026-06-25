/**
 * scripts/wipe-all.js
 *
 * Menghapus SEMUA dokumen di collection: _meta, masterData, orders,
 * partNumbers. Dipakai untuk reset total sebelum mulai isi data asli
 * dari nol lewat import Excel.
 *
 * PERINGATAN: Aksi ini TIDAK BISA dibatalkan.
 *
 * Cara pakai:  npm run wipe-all
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
if (!fs.existsSync(keyPath)) {
  console.error(
    "\n[wipe-all] serviceAccountKey.json tidak ditemukan di root project.\n" +
      "Download dari Firebase Console > Project Settings > Service Accounts,\n" +
      "lalu simpan dengan nama itu di root folder project ini.\n"
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();

const COLLECTIONS = ["_meta", "masterData", "orders", "partNumbers"];

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
    console.log(`[wipe-all]   ${colName}: terhapus ${totalDeleted}...`);
  }
  return totalDeleted;
}

(async () => {
  console.log("\nMenghitung jumlah dokumen di tiap collection...");
  const counts = {};
  for (const col of COLLECTIONS) {
    counts[col] = await countDocs(col);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.log("[wipe-all] Semua collection sudah kosong. Tidak ada yang dihapus.");
    process.exit(0);
  }

  console.log("\nIni akan menghapus SEMUA dokumen di collection berikut:");
  COLLECTIONS.forEach((col) => console.log(`  - ${col}: ${counts[col]} dokumen`));
  console.log("\nAkun login admin (Firebase Authentication) TIDAK ikut terhapus.");
  console.log("Aksi ini TIDAK BISA dibatalkan.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) =>
    rl.question('Ketik "HAPUS" (huruf besar semua) untuk konfirmasi, lalu Enter: ', resolve)
  );
  rl.close();

  if (answer.trim() !== "HAPUS") {
    console.log("\n[wipe-all] Dibatalkan. Tidak ada yang dihapus.");
    process.exit(0);
  }

  console.log("\n[wipe-all] Menghapus...");
  let grandTotal = 0;
  for (const col of COLLECTIONS) {
    if (counts[col] === 0) continue;
    grandTotal += await deleteCollection(col);
  }
  console.log(`\n[wipe-all] Selesai. ${grandTotal} dokumen terhapus dari ${COLLECTIONS.length} collection.`);
  process.exit(0);
})().catch((err) => {
  console.error("[wipe-all] Gagal:", err);
  process.exit(1);
});
