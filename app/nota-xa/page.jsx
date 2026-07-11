"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileSpreadsheet, Plus, Trash2, Upload, ChevronDown,
  ChevronRight, CheckCircle2, Loader2, X, Search
} from "lucide-react";
import Shell from "@/components/Shell";
import {
  createNotaXA, deleteNotaXA, importNotaXARows,
  listNotaXA, toggleReturNotaXA, updateNotaXA,
} from "@/lib/firestore";
import { parseNotaXAExcel } from "@/lib/excelNota";

/* ---------- badge retur ---------- */
function ReturBadge({ retur, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`badge ${retur ? "badge-danger" : "badge-neutral"}`}
      style={{ cursor: "pointer", border: "none", fontSize: 11 }}
      title="Klik untuk toggle"
    >
      {retur ? "YES" : "No"}
    </button>
  );
}

/* ---------- baris detail nota (expandable) ---------- */
function NotaRow({ nota, onReturToggle, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr style={{ background: open ? "var(--ok-soft)" : undefined }}>
        <td style={{ width: 32 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpen((v) => !v)}
            title={open ? "Tutup detail" : "Lihat detail item"}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 12.5, color: "var(--channel)", fontWeight: 600,
              padding: 0, textDecoration: "underline dotted",
            }}
            title="Klik untuk lihat detail"
          >
            {nota.invoiceNo}
          </button>
        </td>
        <td>{nota.sentDate || <span className="muted">-</span>}</td>
        <td>{nota.namaCustomer || <span className="muted">-</span>}</td>
        <td>{nota.salesName || <span className="muted">-</span>}</td>
        <td>{(nota.items || []).length} item</td>
        <td>
          <ReturBadge retur={nota.retur} onClick={() => onReturToggle(nota)} />
        </td>
        <td>
          <button className="icon-btn" onClick={() => onDelete(nota)} title="Hapus nota">
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} style={{ padding: 0, borderBottom: "2px solid var(--channel)" }}>
            <div style={{ background: "#f7fbfc", padding: "10px 14px 14px" }}>
              <p style={{ fontSize: 12, color: "var(--steel)", margin: "0 0 8px" }}>
                Detail item nota <strong>{nota.invoiceNo}</strong>
                {nota.sentDate && ` · ${nota.sentDate}`}
                {nota.namaCustomer && ` · ${nota.namaCustomer}`}
              </p>
              <div className="table-wrap">
                <table className="data" style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Part Number</th>
                      <th>Part Name</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(nota.items || []).length === 0 && (
                      <tr><td colSpan={4} className="muted">Tidak ada item.</td></tr>
                    )}
                    {(nota.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="muted">{idx + 1}</td>
                        <td><span className="tag">{item.partNumber}</span></td>
                        <td>{item.partName}</td>
                        <td>{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ---------- modal tambah nota manual ---------- */
function AddNotaModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    invoiceNo: "", sentDate: "", namaCustomer: "", salesName: "",
  });
  const [items, setItems] = useState([{ partNumber: "", partName: "", qty: "" }]);
  const [saving, setSaving] = useState(false);

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function setItem(idx, k, v) {
    setItems((arr) => arr.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  }
  function addItem() { setItems((arr) => [...arr, { partNumber: "", partName: "", qty: "" }]); }
  function removeItem(idx) { setItems((arr) => arr.filter((_, i) => i !== idx)); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.invoiceNo) return;
    setSaving(true);
    try {
      await createNotaXA({
        ...form,
        items: items
          .filter((it) => it.partNumber)
          .map((it) => ({ ...it, qty: Number(it.qty) || 0 })),
      });
      onSaved();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-head">
          <h2>Tambah Nota XA</h2>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-grid cols-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label className="field-label">Invoice No<span className="req">*</span></label>
              <input className="input mono" value={form.invoiceNo}
                onChange={(e) => setF("invoiceNo", e.target.value)} required />
            </div>
            <div className="field">
              <label className="field-label">Tanggal Nota</label>
              <input type="date" className="input" value={form.sentDate}
                onChange={(e) => setF("sentDate", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Nama Customer</label>
              <input className="input" value={form.namaCustomer}
                onChange={(e) => setF("namaCustomer", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Sales Name</label>
              <input className="input" value={form.salesName}
                onChange={(e) => setF("salesName", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 13 }}>Item Nota</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
              <Plus size={13} /> Tambah baris
            </button>
          </div>
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table className="data">
              <thead>
                <tr><th>Part Number</th><th>Part Name</th><th>Qty</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      <input className="input mono" style={{ fontSize: 12.5 }}
                        value={it.partNumber}
                        onChange={(e) => setItem(idx, "partNumber", e.target.value)} />
                    </td>
                    <td>
                      <input className="input" style={{ fontSize: 12.5 }}
                        value={it.partName}
                        onChange={(e) => setItem(idx, "partName", e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" className="input" style={{ maxWidth: 80, fontSize: 12.5 }}
                        value={it.qty}
                        onChange={(e) => setItem(idx, "qty", e.target.value)} />
                    </td>
                    <td>
                      <button type="button" className="icon-btn" onClick={() => removeItem(idx)}>
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <Loader2 size={14} className="spin" />}
              {saving ? "Menyimpan..." : "Simpan Nota"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- main page ---------- */
export default function NotaXAPage() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    setNotas(await listNotaXA());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleReturToggle(nota) {
    const before = nota.retur;
    setNotas((list) => list.map((n) => n.id === nota.id ? { ...n, retur: !before } : n));
    toggleReturNotaXA(nota.id, before).catch(() => {
      setNotas((list) => list.map((n) => n.id === nota.id ? { ...n, retur: before } : n));
      alert("Gagal menyimpan, dikembalikan ke semula.");
    });
  }

  async function handleDelete(nota) {
    if (!confirm(`Hapus nota ${nota.invoiceNo}?`)) return;
    await deleteNotaXA(nota.id);
    load();
  }

  async function handleImport(file) {
    setImporting(true);
    setImportResult("");
    try {
      const { rows } = await parseNotaXAExcel(file);
      const { created, updated } = await importNotaXARows(rows);
      setImportResult(`${created} nota baru ditambahkan, ${updated} nota diperbarui.`);
      load();
    } catch (err) {
      setImportResult(`Gagal: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  const term = search.trim().toLowerCase();
  const filtered = notas.filter((n) =>
    !term ||
    (n.invoiceNo || "").toLowerCase().includes(term) ||
    (n.namaCustomer || "").toLowerCase().includes(term) ||
    (n.salesName || "").toLowerCase().includes(term)
  );

  return (
    <Shell title="Nota XA" subtitle="Daftar nota pesanan customer / XA">
      {/* toolbar */}
      <div className="card">
        <div className="toolbar">
          <div className="field" style={{ minWidth: 260 }}>
            <div className="ss-control">
              <span style={{ position: "absolute", left: 10, top: 9, color: "var(--steel)" }}>
                <Search size={14} />
              </span>
              <input
                className="input"
                style={{ paddingLeft: 30 }}
                placeholder="Cari nomor nota, nama customer, sales..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="spacer" />

          {/* import */}
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <button
            className="btn"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
            {importing ? "Mengimpor..." : "Import Excel"}
          </button>

          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Tambah Nota
          </button>
        </div>

        {importResult && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
            fontSize: 13, color: importResult.startsWith("Gagal") ? "var(--danger)" : "var(--ok)",
          }}>
            <CheckCircle2 size={15} /> {importResult}
          </div>
        )}

        {/* tabel */}
        {loading ? (
          <div className="skeleton">Memuat nota...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {notas.length === 0
              ? "Belum ada nota. Import dari Excel atau tambah manual."
              : "Tidak ada nota yang cocok dengan pencarian ini."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Invoice No</th>
                  <th>Tanggal Nota</th>
                  <th>Nama Customer</th>
                  <th>Sales Name</th>
                  <th>Jml Item</th>
                  <th>Retur</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((nota) => (
                  <NotaRow
                    key={nota.id}
                    nota={nota}
                    onReturToggle={handleReturToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Menampilkan {filtered.length} dari {notas.length} nota.
        </p>
      </div>

      {showAdd && (
        <AddNotaModal onClose={() => setShowAdd(false)} onSaved={load} />
      )}
    </Shell>
  );
}
