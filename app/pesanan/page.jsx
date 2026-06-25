"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import Shell from "@/components/Shell";
import SearchableSelect from "@/components/SearchableSelect";
import OrderEditModal from "@/components/OrderEditModal";
import { DlvBadge, StatusBadge } from "@/components/StatusBadge";
import { deleteOrder, getAllMasterLists, listOrders, updateOrder } from "@/lib/firestore";

function InlineTextCell({ value, placeholder, onSave, tag }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  if (!editing) {
    return (
      <span
        className="cell-editable"
        onClick={() => {
          setDraft(value || "");
          setEditing(true);
        }}
        title="Klik untuk edit"
      >
        {value ? (
          tag ? <span className="tag">{value}</span> : value
        ) : (
          <span className="muted">{placeholder || "-"}</span>
        )}
      </span>
    );
  }

  function commit() {
    setEditing(false);
    if (draft !== (value || "")) onSave(draft);
  }

  return (
    <input
      autoFocus
      className={`cell-edit-input ${tag ? "mono" : ""}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

function InlineSelectCell({ value, options, placeholder, onSave, renderDisplay }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <span className="cell-editable" onClick={() => setEditing(true)} title="Klik untuk edit">
        {renderDisplay ? renderDisplay(value) : value || <span className="muted">{placeholder || "-"}</span>}
      </span>
    );
  }

  return (
    <SearchableSelect
      compact
      autoOpen
      value={value}
      options={options}
      placeholder={placeholder}
      onClose={() => setEditing(false)}
      onChange={(v) => {
        setEditing(false);
        if (v !== (value || "")) onSave(v);
      }}
    />
  );
}

function PesananContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [master, setMaster] = useState({ sales: [], status: [], dlvType: [], loc: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [salesFilter, setSalesFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dlvFilter, setDlvFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  async function load() {
    setLoading(true);
    const [m, o] = await Promise.all([getAllMasterLists(), listOrders()]);
    setMaster(m);
    setOrders(o);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (term) {
        const haystack = `${o.namaCustomer || ""} ${o.poNo || ""} ${o.partNumber || ""} ${o.nomorNota || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (salesFilter && o.sales !== salesFilter) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (dlvFilter && o.dlvType !== dlvFilter) return false;
      return true;
    });
  }, [orders, search, salesFilter, statusFilter, dlvFilter]);

  function openCreate() {
    setEditingOrder(null);
    setModalOpen(true);
  }

  function openEdit(order) {
    setEditingOrder(order);
    setModalOpen(true);
  }

  async function handleDelete(order) {
    if (!confirm(`Hapus pesanan ${order.partNumber} milik ${order.namaCustomer || "customer ini"}?`)) return;
    await deleteOrder(order.id);
    load();
  }

  // Edit langsung di sel tabel: tampilan berubah instan, baru disimpan ke
  // Firestore di belakang. Kalau gagal, dikembalikan ke nilai semula.
  function saveCell(order, field, value) {
    const before = order[field];
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, [field]: value } : o)));
    updateOrder(order.id, { [field]: value }).catch(() => {
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, [field]: before } : o)));
      alert("Gagal menyimpan perubahan, dikembalikan ke semula. Coba lagi.");
    });
  }

  return (
    <Shell title="Pesanan Customer" subtitle="Cari, filter, dan kelola seluruh pesanan customer">
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
                placeholder="Cari nama customer, PO No., part number, nomor nota..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <SearchableSelect
            value={salesFilter}
            onChange={setSalesFilter}
            options={master.sales}
            placeholder="Filter Sales"
          />
          <SearchableSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={master.status}
            placeholder="Filter Status"
          />
          <SearchableSelect
            value={dlvFilter}
            onChange={setDlvFilter}
            options={master.dlvType}
            placeholder="Filter DLV Type"
          />

          <div className="spacer" />
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Tambah Pesanan
          </button>
        </div>

        {loading ? (
          <div className="skeleton">Memuat data pesanan...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            Tidak ada pesanan yang cocok dengan pencarian/filter ini.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>DLV</th>
                  <th>Tanggal</th>
                  <th>PO No.</th>
                  <th>Nama Customer</th>
                  <th>Sales</th>
                  <th>Part Number</th>
                  <th>Nama Part</th>
                  <th>Qty</th>
                  <th>Nomor Nota</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className={o.dlvType === "EMG" ? "dlv-emg" : "dlv-reg"}>
                    <td><DlvBadge type={o.dlvType} /></td>
                    <td>{o.orderDate || "-"}</td>
                    <td><span className="tag">{o.poNo || "-"}</span></td>
                    <td>
                      <InlineTextCell
                        value={o.namaCustomer}
                        placeholder="Klik untuk isi nama customer"
                        onSave={(v) => saveCell(o, "namaCustomer", v)}
                      />
                    </td>
                    <td>
                      <InlineSelectCell
                        value={o.sales}
                        options={master.sales}
                        placeholder="Pilih sales"
                        onSave={(v) => saveCell(o, "sales", v)}
                      />
                    </td>
                    <td><span className="tag">{o.partNumber}</span></td>
                    <td>{o.partName}</td>
                    <td>{o.qShipped}/{o.qOrder}</td>
                    <td>
                      <InlineTextCell
                        value={o.nomorNota}
                        placeholder="Klik untuk isi nomor nota"
                        onSave={(v) => saveCell(o, "nomorNota", v)}
                        tag
                      />
                    </td>
                    <td>
                      <InlineSelectCell
                        value={o.status}
                        options={master.status}
                        placeholder="Pilih status"
                        onSave={(v) => saveCell(o, "status", v)}
                        renderDisplay={(v) => <StatusBadge status={v} />}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="icon-btn" onClick={() => openEdit(o)} title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn" onClick={() => handleDelete(o)} title="Hapus">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Menampilkan {filtered.length} dari {orders.length} pesanan.
        </p>
      </div>

      {modalOpen && (
        <OrderEditModal
          order={editingOrder}
          master={master}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </Shell>
  );
}

export default function PesananPage() {
  return (
    <Suspense fallback={<div className="skeleton">Memuat...</div>}>
      <PesananContent />
    </Suspense>
  );
}
