"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import {
  createOrder,
  updateOrder,
  getPartNumber,
  searchPartNumbersByPrefix,
} from "@/lib/firestore";

const EMPTY = {
  dlvType: "",
  orderDate: "",
  poNo: "",
  wosNo: "",
  partNumber: "",
  partName: "",
  qOrder: 0,
  loc: "",
  shipments: [],
  namaCustomer: "",
  sales: "",
  nomorNota: "",
  notes: "",
  status: "Open",
};

export default function OrderEditModal({ order, master, onClose, onSaved }) {
  const isEdit = Boolean(order);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setForm({
        ...EMPTY,
        ...order,
        shipments: order.shipments || [],
      });
    } else {
      setForm(EMPTY);
    }
  }, [order]);

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

  function addShipment() {
    set("shipments", [...form.shipments, { date: "", qty: "" }]);
  }

  function updateShipment(idx, key, value) {
    const next = form.shipments.map((s, i) =>
      i === idx ? { ...s, [key]: value } : s
    );
    set("shipments", next);
  }

  function removeShipment(idx) {
    set("shipments", form.shipments.filter((_, i) => i !== idx));
  }

  const qShipped = form.shipments.reduce(
    (sum, s) => sum + (Number(s.qty) || 0),
    0
  );
  const qRem = Math.max((Number(form.qOrder) || 0) - qShipped, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        qOrder: Number(form.qOrder) || 0,
        qShipped,
        qRem,
        shipments: form.shipments
          .filter((s) => s.date && s.qty !== "")
          .map((s) => ({ date: s.date, qty: Number(s.qty) || 0 })),
      };
      if (isEdit) {
        await updateOrder(order.id, payload);
      } else {
        await createOrder(payload);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>{isEdit ? "Edit Pesanan" : "Tambah Pesanan"}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid cols-4">
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label className="field-label">
                Nama Customer<span className="req">*</span>
              </label>
              <input
                className="input"
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
            />

            <SearchableSelect
              label="Status"
              value={form.status}
              onChange={(v) => set("status", v)}
              options={master.status}
            />

            <SearchableSelect
              label="DLV Type"
              required
              value={form.dlvType}
              onChange={(v) => set("dlvType", v)}
              options={master.dlvType}
            />

            <div className="field">
              <label className="field-label">Order Date</label>
              <input
                type="date"
                className="input"
                value={form.orderDate}
                onChange={(e) => set("orderDate", e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">PO No.</label>
              <input
                className="input mono"
                value={form.poNo}
                onChange={(e) => set("poNo", e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">WOS No.</label>
              <input
                className="input mono"
                value={form.wosNo}
                onChange={(e) => set("wosNo", e.target.value)}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <SearchableSelect
                label="Part Number"
                required
                value={form.partNumber}
                onChange={handlePartNumberChange}
                onSearch={(term) =>
                  searchPartNumbersByPrefix(term, 20).then((res) =>
                    res.map((p) => ({
                      value: p.partNumber,
                      label: `${p.partNumber} — ${p.description}`,
                    }))
                  )
                }
                placeholder="Cari part number..."
                emptyText="Part number tidak ditemukan di database."
              />
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <label className="field-label">Nama Part</label>
              <input className="input" value={form.partName} disabled />
            </div>

            <SearchableSelect
              label="Lokasi"
              value={form.loc}
              onChange={(v) => set("loc", v)}
              options={master.loc}
            />

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

            <div className="field">
              <label className="field-label">Qty Terkirim</label>
              <input className="input" value={qShipped} disabled />
            </div>

            <div className="field">
              <label className="field-label">Qty Sisa</label>
              <input className="input" value={qRem} disabled />
            </div>

            <div className="field">
              <label className="field-label">Nomor Nota</label>
              <input
                className="input mono"
                value={form.nomorNota}
                onChange={(e) => set("nomorNota", e.target.value)}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 4" }}>
              <label className="field-label">Catatan</label>
              <textarea
                className="textarea"
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="card-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 13 }}>Riwayat Pengiriman</h2>
              <button type="button" className="btn btn-sm btn-ghost" onClick={addShipment}>
                <Plus size={14} /> Tambah baris
              </button>
            </div>
            {form.shipments.length === 0 && (
              <p className="muted" style={{ fontSize: 12.5 }}>
                Belum ada pengiriman tercatat.
              </p>
            )}
            {form.shipments.map((s, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                <input
                  type="date"
                  className="input"
                  value={s.date}
                  onChange={(e) => updateShipment(idx, "date", e.target.value)}
                  style={{ maxWidth: 170 }}
                />
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder="Qty"
                  value={s.qty}
                  onChange={(e) => updateShipment(idx, "qty", e.target.value)}
                  style={{ maxWidth: 110 }}
                />
                <button type="button" className="icon-btn" onClick={() => removeShipment(idx)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <Loader2 size={14} className="spin" />}
              {saving ? "Menyimpan..." : "Simpan Pesanan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
