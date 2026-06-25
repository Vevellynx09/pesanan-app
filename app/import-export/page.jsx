"use client";

import { useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import Shell from "@/components/Shell";
import { importOrderRows, listOrders } from "@/lib/firestore";
import { exportOrdersToExcel, parseOrdersExcelFile } from "@/lib/excel";

function ImportCard({ title, hint, accept, onFile, busy, progress, result, errors }) {
  const inputRef = useRef(null);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{hint}</p>
        </div>
      </div>

      <div
        className="import-drop"
        onClick={() => inputRef.current?.click()}
        style={{ cursor: "pointer" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        {busy ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Loader2 size={16} className="spin" /> Memproses {progress || ""}
          </div>
        ) : (
          <div>
            <Upload size={20} style={{ marginBottom: 6 }} />
            <div>Klik untuk pilih file .xlsx</div>
          </div>
        )}
      </div>

      {result && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "var(--ok)", fontSize: 13 }}>
          <CheckCircle2 size={15} /> {result}
        </div>
      )}

      {errors && errors.length > 0 && (
        <div className="error-list">
          <strong>{errors.length} baris dilewati:</strong>
          {errors.slice(0, 50).map((e, i) => (
            <div key={i}>{e}</div>
          ))}
          {errors.length > 50 && <div>...dan {errors.length - 50} lainnya.</div>}
        </div>
      )}
    </div>
  );
}

export default function ImportExportPage() {
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderProgress, setOrderProgress] = useState("");
  const [orderResult, setOrderResult] = useState("");
  const [orderErrors, setOrderErrors] = useState([]);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const orders = await listOrders();
      exportOrdersToExcel(orders);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportOrders(file) {
    setOrderBusy(true);
    setOrderResult("");
    setOrderErrors([]);
    try {
      const { rows, errors } = await parseOrdersExcelFile(file);
      const { created, updated, registeredParts } = await importOrderRows(rows, (done, total, stage) =>
        setOrderProgress(`${stage} ${done}/${total}`)
      );
      const parts = [
        `${created} pesanan baru ditambahkan.`,
        `${updated} pesanan yang sudah ada diperbarui (riwayat kirim digabung).`,
      ];
      if (registeredParts > 0) parts.push(`${registeredParts} Part Number baru otomatis didaftarkan ke database.`);
      setOrderResult(parts.join(" "));
      setOrderErrors(errors);
    } catch (err) {
      setOrderErrors([`Gagal membaca file: ${err.message}`]);
    } finally {
      setOrderBusy(false);
      setOrderProgress("");
    }
  }

  return (
    <Shell title="Import / Export" subtitle="Pertukaran data pesanan lewat Excel">
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Export Pesanan Customer</h2>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              Unduh seluruh data pesanan saat ini sebagai file .xlsx, termasuk rincian riwayat kirim
              per tanggal (D.Shipped-1..6 / Q.Shipped-1..6).
            </p>
          </div>
          <FileSpreadsheet size={18} className="muted" />
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
          {exporting ? "Menyiapkan file..." : "Export ke Excel"}
        </button>
      </div>

      <ImportCard
        title="Import Pesanan Customer"
        hint='File harus memiliki sheet bernama "Pesanan Customer". Baris dengan PO No. + Part Number yang
          sama dengan pesanan yang sudah ada akan DIPERBARUI (riwayat kirim digabung), bukan dibuat baris
          baru. Part Number yang belum ada di database akan otomatis didaftarkan.'
        accept=".xlsx,.xls"
        onFile={handleImportOrders}
        busy={orderBusy}
        progress={orderProgress}
        result={orderResult}
        errors={orderErrors}
      />

      <div className="card">
        <p className="muted" style={{ fontSize: 12.5 }}>
          Database Part Number tumbuh otomatis dari hasil import pesanan di atas — tidak ada lagi import
          khusus untuk database Part Number. Lihat/cari isi databasenya di halaman <strong>Master Data</strong>.
        </p>
      </div>
    </Shell>
  );
}
