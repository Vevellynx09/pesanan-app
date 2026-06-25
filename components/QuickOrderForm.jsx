"use client";

import { useState } from "react";
import { PackagePlus, Loader2 } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import { createOrder, getPartNumber, searchPartNumbersByPrefix } from "@/lib/firestore";

const TODAY = () => new Date().toISOString().slice(0, 10);

export default function QuickOrderForm({ master, onCreated }) {
  const [form, setForm] = useState({
    namaCustomer: "",
    sales: "",
    nomorNota: "",
    dlvType: "",
    partNumber: "",
    partName: "",
    poNo: "",
    qOrder: "",
    loc: "",
    status: "Open",
    orderDate: TODAY(),
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handlePartNumberChange(value) {
    set("partNumber", value);
    if (!value) {
      set("partName", "");
      return;
    }
    const part = await getPartNumber(value);
    if (part) set("partName", part.description);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.namaCustomer || !form.partNumber || !form.dlvType) return;
    setSaving(true);
    setNotice("");
    try {
      await createOrder({
        dlvType: form.dlvType,
        orderDate: form.orderDate,
        poNo: form.poNo,
        wosNo: "",
        partNumber: form.partNumber,
        partName: form.partName,
        qOrder: Number(form.qOrder) || 0,
        qShipped: 0,
        qRem: Number(form.qOrder) || 0,
        loc: form.loc,
        shipments: [],
        namaCustomer: form.namaCustomer,
        sales: form.sales,
        nomorNota: form.nomorNota,
        notes: "",
        status: form.status,
      });
      setNotice("Pesanan baru tersimpan.");
      setForm({
        namaCustomer: "",
        sales: "",
        nomorNota: "",
        dlvType: "",
        partNumber: "",
        partName: "",
        poNo: "",
        qOrder: "",
        loc: "",
        status: "Open",
        orderDate: TODAY(),
      });
      onCreated && onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label className="field-label">
            Nama Customer<span className="req">*</span>
          </label>
          <input
            className="input"
            placeholder="Tulis nama customer..."
            value={form.namaCustomer}
            onChange={(e) => set("namaCustomer", e.target.value)}
            required
          />
        </div>

        <SearchableSelect
          label="Sales"
          required
          value={form.sales}
          onChange={(v) => set("sales", v)}
          options={master.sales}
          placeholder="Pilih sales..."
        />

        <SearchableSelect
          label="DLV Type"
          required
          value={form.dlvType}
          onChange={(v) => set("dlvType", v)}
          options={master.dlvType}
          placeholder="REG / EMG"
        />

        <SearchableSelect
          label="Part Number"
          required
          value={form.partNumber}
          onChange={handlePartNumberChange}
          onSearch={(term) => searchPartNumbersByPrefix(term, 20).then(
            (res) => res.map((p) => ({ value: p.partNumber, label: `${p.partNumber} — ${p.description}` }))
          )}
          placeholder="Cari part number..."
          emptyText="Part number tidak ditemukan di database."
        />

        <div className="field">
          <label className="field-label">Nama Part</label>
          <input className="input" value={form.partName} disabled placeholder="Terisi otomatis" />
        </div>

        <div className="field">
          <label className="field-label">Nomor Nota</label>
          <input
            className="input mono"
            value={form.nomorNota}
            onChange={(e) => set("nomorNota", e.target.value)}
            placeholder="cth. INV-00123"
          />
        </div>

        <div className="field">
          <label className="field-label">PO No.</label>
          <input
            className="input mono"
            value={form.poNo}
            onChange={(e) => set("poNo", e.target.value)}
            placeholder="cth. SL-26097"
          />
        </div>

        <div className="field">
          <label className="field-label">Qty Order</label>
          <input
            type="number"
            min="0"
            className="input"
            value={form.qOrder}
            onChange={(e) => set("qOrder", e.target.value)}
          />
        </div>

        <SearchableSelect
          label="Lokasi"
          value={form.loc}
          onChange={(v) => set("loc", v)}
          options={master.loc}
          placeholder="JPN / JKT"
        />

        <SearchableSelect
          label="Status"
          value={form.status}
          onChange={(v) => set("status", v)}
          options={master.status}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : <PackagePlus size={15} />}
          {saving ? "Menyimpan..." : "Simpan Pesanan"}
        </button>
        {notice && <span style={{ color: "var(--ok)", fontSize: 13 }}>{notice}</span>}
      </div>
    </form>
  );
}
