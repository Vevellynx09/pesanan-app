import * as XLSX from "xlsx";

function excelDateToISO(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  // handle dd-Mon-yy / dd-Mon-yyyy (e.g. "01-Jul-26")
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const months = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
    const mm = months[m[2]] || 1;
    let yr = parseInt(m[3]);
    if (yr < 100) yr += 2000;
    return `${yr}-${String(mm).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  return s;
}

/**
 * Parse Excel nota XA.
 * Format: Nomor Nota / Nama Customer / Sales hanya diisi di baris pertama tiap nota.
 * Baris berikutnya (item lanjutan) biarkan kosong di kolom itu.
 * Kolom yang dibaca: Jml (qty), Part No. (partNumber), Part Name (partName),
 *   Nomor Nota (invoiceNo), Nama Customer (namaCustomer), Sales (salesName),
 *   Sent Date (sentDate) — opsional.
 * Harga & Subtotal diabaikan.
 */
export function parseNotaXAExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const notaMap = new Map(); // invoiceNo -> nota object
        const orderKeys = []; // preserve insertion order

        let currentInvoice = null;

        raw.forEach((r) => {
          const invoiceNo = String(r["Nomor Nota"] || "").trim();
          const namaCustomer = String(r["Nama Customer"] || "").trim();
          const salesName = String(r["Sales"] || "").trim();
          const sentDate = excelDateToISO(r["Sent Date"] || r["Tanggal"] || "");
          const partNumber = String(r["Part No."] || r["Part Number"] || "").trim();
          const partName = String(r["Part Name"] || "").trim();
          const qty = Number(r["Jml"] || r["Qty"] || r["Q.Order"] || 0) || 0;

          // Tentukan nota mana yang berlaku baris ini
          if (invoiceNo) {
            currentInvoice = invoiceNo;
            if (!notaMap.has(invoiceNo)) {
              notaMap.set(invoiceNo, {
                invoiceNo,
                sentDate,
                namaCustomer,
                salesName,
                items: [],
              });
              orderKeys.push(invoiceNo);
            } else {
              // Kalau nota sudah ada tapi sentDate/customer baru diisi di baris ini, update
              const n = notaMap.get(invoiceNo);
              if (sentDate && !n.sentDate) n.sentDate = sentDate;
              if (namaCustomer && !n.namaCustomer) n.namaCustomer = namaCustomer;
              if (salesName && !n.salesName) n.salesName = salesName;
            }
          }

          if (!currentInvoice) return; // baris sebelum nota pertama, skip

          // Tambahkan item kalau ada Part No.
          if (partNumber) {
            notaMap.get(currentInvoice).items.push({ partNumber, partName, qty });
          }
        });

        resolve({ rows: orderKeys.map((k) => notaMap.get(k)), errors: [] });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsArrayBuffer(file);
  });
}
