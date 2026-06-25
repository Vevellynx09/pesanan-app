"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Square, Wand2, Loader2 } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import { DlvBadge, StatusBadge } from "./StatusBadge";
import { bulkAssignOrderFields } from "@/lib/firestore";

export default function BulkAssignByPo({ orders, master, onApplied }) {
  const [poTerm, setPoTerm] = useState("");
  const [selected, setSelected] = useState({}); // id -> true/false
  const [fields, setFields] = useState({ namaCustomer: "", sales: "", nomorNota: "", status: "" });
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState("");

  const matches = useMemo(() => {
    const term = poTerm.trim().toLowerCase();
    if (!term) return [];
    return orders.filter((o) => (o.poNo || "").toLowerCase().includes(term));
  }, [poTerm, orders]);

  // Default: semua baris hasil pencarian otomatis tercentang.
  const matchIds = matches.map((m) => m.id).join(",");
  const [lastMatchIds, setLastMatchIds] = useState("");
  if (matchIds !== lastMatchIds) {
    setLastMatchIds(matchIds);
    setSelected(Object.fromEntries(matches.map((m) => [m.id, true])));
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleAll() {
    const allChecked = matches.every((m) => selected[m.id]);
    setSelected(Object.fromEntries(matches.map((m) => [m.id, !allChecked])));
  }

  function setField(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleApply() {
    if (selectedIds.length === 0) return;
    const hasAnyField = Object.values(fields).some((v) => v);
    if (!hasAnyField) {
      setNotice("Isi minimal satu field dulu (Nama Customer, Sales, Nomor Nota, atau Status).");
      return;
    }
    setApplying(true);
    setNotice("");
    try {
      const updated = await bulkAssignOrderFields(selectedIds, fields);
      setNotice(`${updated} baris berhasil diperbarui.`);
      setFields({ namaCustomer: "", sales: "", nomorNota: "", status: "" });
      onApplied && onApplied();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">Isi Cepat</div>
          <h2>Isi Banyak Pesanan Sekaligus per PO No.</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            Cocok untuk 1 PO yang punya banyak baris part berbeda — isi Nama Customer/Sales/Nomor Nota/Status
            sekali, terapkan ke semua baris yang dipilih, tanpa edit satu-satu.
          </p>
        </div>
      </div>

      <input
        className="input mono"
        placeholder="Cari PO No., cth. SL-26134..."
        value={poTerm}
        onChange={(e) => setPoTerm(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {poTerm && matches.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>Tidak ada pesanan dengan PO No. yang cocok.</p>
      )}

      {matches.length > 0 && (
        <>
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <button type="button" className="icon-btn" onClick={toggleAll} title="Pilih/batalkan semua">
                      {matches.every((m) => selected[m.id]) ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                  </th>
                  <th>DLV</th>
                  <th>Part Number</th>
                  <th>Nama Part</th>
                  <th>Qty</th>
                  <th>Saat ini</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((o) => (
                  <tr key={o.id} className={o.dlvType === "EMG" ? "dlv-emg" : "dlv-reg"}>
                    <td>
                      <button type="button" className="icon-btn" onClick={() => toggle(o.id)}>
                        {selected[o.id] ? <CheckSquare size={15} /> : <Square size={15} />}
                      </button>
                    </td>
                    <td><DlvBadge type={o.dlvType} /></td>
                    <td><span className="tag">{o.partNumber}</span></td>
                    <td>{o.partName}</td>
                    <td>{o.qShipped}/{o.qOrder}</td>
                    <td>
                      {o.namaCustomer || <span className="muted">-</span>}
                      {" · "}
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-grid cols-4">
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label className="field-label">Nama Customer</label>
              <input
                className="input"
                placeholder="Kosongkan kalau tidak mau diubah"
                value={fields.namaCustomer}
                onChange={(e) => setField("namaCustomer", e.target.value)}
              />
            </div>
            <SearchableSelect
              label="Sales"
              value={fields.sales}
              onChange={(v) => setField("sales", v)}
              options={master.sales}
              placeholder="Kosongkan = tidak diubah"
            />
            <SearchableSelect
              label="Status"
              value={fields.status}
              onChange={(v) => setField("status", v)}
              options={master.status}
              placeholder="Kosongkan = tidak diubah"
            />
            <div className="field">
              <label className="field-label">Nomor Nota</label>
              <input
                className="input mono"
                placeholder="Kosongkan = tidak diubah"
                value={fields.nomorNota}
                onChange={(e) => setField("nomorNota", e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={handleApply} disabled={applying || selectedIds.length === 0}>
              {applying ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
              {applying ? "Menerapkan..." : `Terapkan ke ${selectedIds.length} baris terpilih`}
            </button>
            {notice && <span style={{ fontSize: 13, color: "var(--ok)" }}>{notice}</span>}
          </div>
        </>
      )}
    </div>
  );
}
