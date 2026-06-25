import * as XLSX from "xlsx";

const ORDER_COLUMNS = [
  "DLV Type",
  "Order Date",
  "PO No.",
  "WOS No.",
  "Part Number",
  "Part Name",
  "Q.Order",
  "Q.Shipped",
  "Q.Rem",
  "Loc",
  "D.Shipped-1", "Q.Shipped-1",
  "D.Shipped-2", "Q.Shipped-2",
  "D.Shipped-3", "Q.Shipped-3",
  "D.Shipped-4", "Q.Shipped-4",
  "D.Shipped-5", "Q.Shipped-5",
  "D.Shipped-6", "Q.Shipped-6",
  "Nama Customer",
  "Sales",
  "Nomor Nota",
  "Notes",
  "Status",
];

function excelDateToISO(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return "";
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  return String(value);
}

// Gabung dua daftar riwayat kirim berdasarkan tanggal: tanggal yang sama
// ditimpa qty-nya (untuk koreksi), tanggal baru ditambahkan. Dipakai baik
// untuk gabung baris duplikat dalam 1 file, maupun gabung ke data yang
// sudah tersimpan di Firestore.
export function mergeShipments(existing = [], incoming = []) {
  const map = new Map((existing || []).map((s) => [s.date, Number(s.qty) || 0]));
  (incoming || []).forEach((s) => map.set(s.date, Number(s.qty) || 0));
  return Array.from(map.entries())
    .map(([date, qty]) => ({ date, qty }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ----------------- EXPORT ----------------- */
export function exportOrdersToExcel(orders, filename = "Pesanan_Customer_Export.xlsx") {
  const rows = orders.map((o) => {
    const row = {
      "DLV Type": o.dlvType || "",
      "Order Date": o.orderDate || "",
      "PO No.": o.poNo || "",
      "WOS No.": o.wosNo || "",
      "Part Number": o.partNumber || "",
      "Part Name": o.partName || "",
      "Q.Order": o.qOrder ?? "",
      "Q.Shipped": o.qShipped ?? "",
      "Q.Rem": o.qRem ?? "",
      Loc: o.loc || "",
    };
    const shipments = o.shipments || [];
    for (let i = 0; i < 6; i++) {
      row[`D.Shipped-${i + 1}`] = shipments[i] ? shipments[i].date : "";
      row[`Q.Shipped-${i + 1}`] = shipments[i] ? shipments[i].qty : "";
    }
    row["Nama Customer"] = o.namaCustomer || "";
    row["Sales"] = o.sales || "";
    row["Nomor Nota"] = o.nomorNota || "";
    row["Notes"] = o.notes || "";
    row["Status"] = o.status || "";
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: ORDER_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pesanan Customer");
  XLSX.writeFile(wb, filename);
}

/* ----------------- IMPORT: Pesanan Customer -----------------
   Tidak ada lagi penolakan karena Part Number belum terdaftar — Part
   Number yang belum ada di database akan didaftarkan otomatis saat
   import (lihat lib/firestore.js > importOrderRows). Baris hanya
   ditolak kalau Part Number-nya benar-benar kosong.
   Baris dengan PO No. + Part Number yang sama dalam satu file digabung
   dulu di sini (riwayat kirim digabung) sebelum dicocokkan ke Firestore. */
export async function parseOrdersExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames.includes("Pesanan Customer")
    ? "Pesanan Customer"
    : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const parsed = [];
  const errors = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const rowNum = i + 2; // +1 header, +1 1-indexed
    const partNumber = String(r["Part Number"] || "").trim().toUpperCase();
    const poNo = String(r["PO No."] || "").trim();

    if (!partNumber) {
      errors.push(`Baris ${rowNum}: Part Number kosong, dilewati.`);
      continue;
    }

    const shipments = [];
    for (let s = 1; s <= 6; s++) {
      const dateStr = excelDateToISO(r[`D.Shipped-${s}`]);
      const qty = Number(r[`Q.Shipped-${s}`]) || 0;
      if (dateStr && qty > 0) shipments.push({ date: dateStr, qty });
    }

    const qOrder = Number(r["Q.Order"]) || 0;
    const shipmentTotal = shipments.reduce((sum, s) => sum + s.qty, 0);
    const qShipped = shipments.length > 0 ? shipmentTotal : Number(r["Q.Shipped"]) || 0;
    const qRem = Math.max(qOrder - qShipped, 0);

    parsed.push({
      dlvType: String(r["DLV Type"] || "").trim(),
      orderDate: excelDateToISO(r["Order Date"]),
      poNo,
      wosNo: String(r["WOS No."] || "").trim(),
      partNumber,
      partName: String(r["Part Name"] || "").trim(),
      qOrder,
      qShipped,
      qRem,
      loc: String(r["Loc"] || "").trim(),
      shipments,
      namaCustomer: String(r["Nama Customer"] || "").trim(),
      sales: String(r["Sales"] || "").trim(),
      nomorNota: String(r["Nomor Nota"] || "").trim(),
      notes: String(r["Notes"] || "").trim(),
      status: String(r["Status"] || "").trim(),
    });
  }

  // Gabung baris duplikat (PO No. + Part Number sama) dalam file yang sama.
  const byKey = new Map();
  parsed.forEach((row) => {
    const key = `${row.poNo}__${row.partNumber}`;
    if (!byKey.has(key)) {
      byKey.set(key, row);
      return;
    }
    const cur = byKey.get(key);
    cur.shipments = mergeShipments(cur.shipments, row.shipments);
    const total = cur.shipments.reduce((sum, s) => sum + s.qty, 0);
    cur.qOrder = row.qOrder || cur.qOrder;
    cur.qShipped = cur.shipments.length > 0 ? total : row.qShipped || cur.qShipped;
    cur.qRem = Math.max(cur.qOrder - cur.qShipped, 0);
    if (row.dlvType) cur.dlvType = row.dlvType;
    if (row.orderDate) cur.orderDate = row.orderDate;
    if (row.wosNo) cur.wosNo = row.wosNo;
    if (row.partName) cur.partName = row.partName;
    if (row.loc) cur.loc = row.loc;
    if (row.namaCustomer) cur.namaCustomer = row.namaCustomer;
    if (row.sales) cur.sales = row.sales;
    if (row.nomorNota) cur.nomorNota = row.nomorNota;
    if (row.notes) cur.notes = row.notes;
    if (row.status) cur.status = row.status;
  });

  return { rows: Array.from(byKey.values()), errors };
}
