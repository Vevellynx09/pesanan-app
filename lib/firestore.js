import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Gabung riwayat kirim berdasarkan tanggal (tanggal sama -> qty ditimpa,
// tanggal baru -> ditambahkan). Duplikat kecil dari lib/excel.js secara
// sengaja, supaya lib/excel.js (yang membawa library xlsx, berat) tidak
// ikut ter-bundle ke setiap halaman yang memakai lib/firestore.js.
function mergeShipments(existing = [], incoming = []) {
  const map = new Map((existing || []).map((s) => [s.date, Number(s.qty) || 0]));
  (incoming || []).forEach((s) => map.set(s.date, Number(s.qty) || 0));
  return Array.from(map.entries())
    .map(([date, qty]) => ({ date, qty }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ---------------------------------------------------------
   ORDERS  (Pesanan Customer)
--------------------------------------------------------- */
const ORDERS_COL = "orders";

export async function listOrders() {
  const snap = await getDocs(
    query(collection(db, ORDERS_COL), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getOrder(id) {
  const ref = doc(db, ORDERS_COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createOrder(data) {
  const ref = await addDoc(collection(db, ORDERS_COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateOrder(id, data) {
  const ref = doc(db, ORDERS_COL, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteOrder(id) {
  await deleteDoc(doc(db, ORDERS_COL, id));
}

// Isi cepat: terapkan field yang sama (Nama Customer/Sales/Nomor Nota/Status)
// ke banyak pesanan sekaligus, dipakai untuk PO yang punya banyak baris part
// berbeda. Hanya field yang diisi (tidak kosong) yang ditimpa.
export async function bulkAssignOrderFields(ids, fields) {
  const payload = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== "")
  );
  if (Object.keys(payload).length === 0 || ids.length === 0) return 0;

  const CHUNK = 450;
  let updated = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach((id) => {
      batch.update(doc(db, ORDERS_COL, id), { ...payload, updatedAt: serverTimestamp() });
    });
    await batch.commit();
    updated += chunk.length;
  }
  return updated;
}

// Cari pesanan yang sudah ada berdasarkan kombinasi PO No. + Part Number
// (kombinasi ini dianggap "baris yang sama"). Query 2 filter persamaan
// (==) seperti ini tidak butuh composite index tambahan di Firestore.
export async function findOrderByPoAndPart(poNo, partNumber) {
  if (!poNo || !partNumber) return null;
  const snap = await getDocs(
    query(
      collection(db, ORDERS_COL),
      where("poNo", "==", poNo),
      where("partNumber", "==", partNumber)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// Import Excel: untuk setiap baris, kalau sudah ada pesanan dengan PO No.
// + Part Number yang sama, baris itu DIPERBARUI (riwayat kirim digabung,
// bukan baris baru). Kalau belum ada, baris baru dibuat. Part Number yang
// belum terdaftar di database otomatis didaftarkan (tidak ditolak lagi).
export async function importOrderRows(rows, onProgress) {
  // 1) Cari pesanan yang sudah ada untuk tiap baris (paralel, dibatasi).
  const CONCURRENCY = 15;
  const decisions = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const existingList = await Promise.all(
      chunk.map((row) => findOrderByPoAndPart(row.poNo, row.partNumber))
    );
    chunk.forEach((row, idx) => decisions.push({ row, existing: existingList[idx] }));
    if (onProgress) onProgress(Math.min(i + CONCURRENCY, rows.length), rows.length, "memeriksa");
  }

  // 2) Daftarkan Part Number baru yang belum ada di database (sekali per
  //    part number unik, tidak menimpa yang sudah ada).
  const uniqueParts = new Map();
  rows.forEach((row) => {
    if (!uniqueParts.has(row.partNumber)) uniqueParts.set(row.partNumber, row.partName || "");
  });
  const partChecks = await Promise.all(
    Array.from(uniqueParts.keys()).map(async (pn) => ({ pn, exists: await isValidPartNumber(pn) }))
  );
  const toRegister = partChecks.filter((p) => !p.exists);
  for (let i = 0; i < toRegister.length; i += 450) {
    const chunk = toRegister.slice(i, i + 450);
    const batch = writeBatch(db);
    chunk.forEach(({ pn }) => {
      batch.set(
        doc(db, PARTS_COL, partDocId(pn)),
        { partNumber: pn, description: uniqueParts.get(pn) || "", partType: "", retailPrice: 0 },
        { merge: true }
      );
    });
    await batch.commit();
  }

  // 3) Simpan: update pesanan yang sudah ada, atau buat baris baru.
  let created = 0;
  let updated = 0;
  for (let i = 0; i < decisions.length; i += 450) {
    const chunk = decisions.slice(i, i + 450);
    const batch = writeBatch(db);
    chunk.forEach(({ row, existing }) => {
      if (existing) {
        const shipments = mergeShipments(existing.shipments, row.shipments);
        const qOrder = row.qOrder || existing.qOrder || 0;
        const shippedTotal = shipments.reduce((sum, s) => sum + s.qty, 0);
        const qShipped = shipments.length > 0 ? shippedTotal : row.qShipped || existing.qShipped || 0;
        const qRem = Math.max(qOrder - qShipped, 0);
        const patch = { shipments, qOrder, qShipped, qRem, updatedAt: serverTimestamp() };
        if (row.dlvType) patch.dlvType = row.dlvType;
        if (row.orderDate) patch.orderDate = row.orderDate;
        if (row.wosNo) patch.wosNo = row.wosNo;
        if (row.partName) patch.partName = row.partName;
        if (row.loc) patch.loc = row.loc;
        if (row.namaCustomer) patch.namaCustomer = row.namaCustomer;
        if (row.sales) patch.sales = row.sales;
        if (row.nomorNota) patch.nomorNota = row.nomorNota;
        if (row.notes) patch.notes = row.notes;
        if (row.status) patch.status = row.status;
        batch.update(doc(db, ORDERS_COL, existing.id), patch);
        updated++;
      } else {
        batch.set(doc(collection(db, ORDERS_COL)), {
          ...row,
          status: row.status || "Open",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
    });
    await batch.commit();
    if (onProgress) onProgress(Math.min(i + 450, decisions.length), decisions.length, "menyimpan");
  }

  return { created, updated, registeredParts: toRegister.length };
}

/* ---------------------------------------------------------
   PART NUMBER DATABASE (sheet "Part Number Database")
   Setiap part number disimpan dengan ID dokumen = part number
   itu sendiri, supaya pengecekan validasi tinggal getDoc().
--------------------------------------------------------- */
const PARTS_COL = "partNumbers";

function partDocId(partNumber) {
  // Firestore doc id tidak boleh mengandung "/". Disimpan huruf besar
  // agar konsisten dengan pencarian prefix di searchPartNumbersByPrefix.
  return String(partNumber).trim().toUpperCase().replace(/\//g, "-");
}

export async function isValidPartNumber(partNumber) {
  if (!partNumber) return false;
  const ref = doc(db, PARTS_COL, partDocId(partNumber));
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function getPartNumber(partNumber) {
  const ref = doc(db, PARTS_COL, partDocId(partNumber));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Daftar part number dipakai untuk dropdown-search. Untuk database
// sebesar ini (20rb+), kita batasi pengambilan awal dan andalkan
// pencarian sisi-klien pada cache yang sudah dimuat (lihat usePartNumberSearch).
export async function listPartNumbers(max = 2000) {
  const snap = await getDocs(
    query(collection(db, PARTS_COL), orderBy("partNumber"), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function countPartNumbers() {
  const snap = await getDocs(collection(db, PARTS_COL));
  return snap.size;
}

// Pencarian dropdown-search part number berdasarkan awalan (prefix),
// dijalankan langsung di Firestore supaya tidak perlu menarik 20rb+
// dokumen ke browser. Part number disimpan & dicari dalam huruf besar.
export async function searchPartNumbersByPrefix(prefix, max = 25) {
  const p = String(prefix || "").trim().toUpperCase();
  if (!p) {
    const snap = await getDocs(
      query(collection(db, PARTS_COL), orderBy("partNumber"), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const snap = await getDocs(
    query(
      collection(db, PARTS_COL),
      orderBy("partNumber"),
      startAt(p),
      endAt(p + "\uf8ff"),
      limit(max)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// (Tidak ada fungsi import massal Part Number di sini secara sengaja —
// pengisian database Part Number hanya lewat scripts/seed.js sekali di awal.)

/* ---------------------------------------------------------
   MASTER DATA (daftar dropdown yang dikontrol admin)
   Disimpan sebagai 1 dokumen per kategori di koleksi "masterData",
   masing-masing berisi field { items: [string, ...] }.
--------------------------------------------------------- */
const MASTER_COL = "masterData";
export const MASTER_KEYS = {
  SALES: "sales",
  STATUS: "status",
  DLV_TYPE: "dlvType",
  LOC: "loc",
};

const MASTER_DEFAULTS = {
  [MASTER_KEYS.SALES]: [],
  [MASTER_KEYS.STATUS]: ["Open", "Proses", "Sebagian Kirim", "Selesai", "Batal"],
  [MASTER_KEYS.DLV_TYPE]: ["REG", "EMG"],
  [MASTER_KEYS.LOC]: ["JPN", "JKT"],
};

export async function getMasterList(key) {
  const ref = doc(db, MASTER_COL, key);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const fallback = MASTER_DEFAULTS[key] || [];
    await setDoc(ref, { items: fallback });
    return fallback;
  }
  return snap.data().items || [];
}

export async function setMasterList(key, items) {
  const ref = doc(db, MASTER_COL, key);
  await setDoc(ref, { items }, { merge: true });
}

export async function addMasterItem(key, item) {
  const current = await getMasterList(key);
  if (current.includes(item)) return current;
  const updated = [...current, item];
  await setMasterList(key, updated);
  return updated;
}

export async function removeMasterItem(key, item) {
  const current = await getMasterList(key);
  const updated = current.filter((i) => i !== item);
  await setMasterList(key, updated);
  return updated;
}

export async function getAllMasterLists() {
  const keys = Object.values(MASTER_KEYS);
  const results = await Promise.all(keys.map((k) => getMasterList(k)));
  return keys.reduce((acc, k, idx) => {
    acc[k] = results[idx];
    return acc;
  }, {});
}

/* ---------------------------------------------------------
   NOTA XA  (Nota Pesanan Customer / XA)
   Setiap dokumen = 1 nota (invoice), berisi:
     invoiceNo, sentDate, namaCustomer, salesName, retur,
     items: [{ partNumber, partName, qty }]
--------------------------------------------------------- */
const NOTA_COL = "notaXA";

export async function listNotaXA() {
  const snap = await getDocs(
    query(collection(db, NOTA_COL), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getNotaXA(id) {
  const snap = await getDoc(doc(db, NOTA_COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createNotaXA(data) {
  const ref = await addDoc(collection(db, NOTA_COL), {
    ...data,
    retur: data.retur || false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNotaXA(id, data) {
  await updateDoc(doc(db, NOTA_COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteNotaXA(id) {
  await deleteDoc(doc(db, NOTA_COL, id));
}

// Toggle retur langsung (optimistic update dipakai di sisi UI)
export async function toggleReturNotaXA(id, current) {
  await updateDoc(doc(db, NOTA_COL, id), {
    retur: !current,
    updatedAt: serverTimestamp(),
  });
}

// Import massal: upsert berdasarkan invoiceNo
// (nota yang sudah ada akan diperbarui, bukan dobel)
export async function importNotaXARows(rows) {
  // 1. Cari semua invoiceNo yang sudah ada
  const existing = await listNotaXA();
  const byInvoice = new Map(existing.map((n) => [n.invoiceNo, n.id]));

  let created = 0;
  let updated = 0;
  const CHUNK = 450;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach((row) => {
      const existingId = byInvoice.get(row.invoiceNo);
      if (existingId) {
        batch.update(doc(db, NOTA_COL, existingId), {
          ...row,
          updatedAt: serverTimestamp(),
        });
        updated++;
      } else {
        const ref = doc(collection(db, NOTA_COL));
        batch.set(ref, {
          ...row,
          retur: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
    });
    await batch.commit();
  }
  return { created, updated };
}

