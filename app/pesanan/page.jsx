"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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
        onClick={() => { setDraft(value || ""); setEditing(true); }}
        title="Klik untuk edit"
      >
        {value ? (tag ? <span className="tag">{value}</span> : value) : (
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
      compact autoOpen
      value={value}
      options={options}
      placeholder={placeholder}
      onClose={() => setEditing(false)}
      onChange={(v) => { setEditing(false); if (v !== (value || "")) onSave(v); }}
    />
  );
}

// Kolom yang bisa diurutkan beserta field yang dipakai sebagai kunci sort.
const SORT_COLS = {
  dlvType:      (o) => o.dlvType || "",
  orderDate:    (o) => o.orderDate || "",
  poNo:         (o) => o.poNo || "",
  namaCustomer: (o) => o.namaCustomer || "",
  sales:        (o) => o.sales || "",
  partNumber:   (o) => o.partNumber || "",
  partName:     (o) => o.partName || "",
  qOrder:       (o) => Number(o.qOrder) || 0,
  nomorNota:    (o) => o.nomorNota || "",
  status:       (o) => o.status || "",
};

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={13} style={{ opacity: 0.35, flexShrink: 0 }} />;
  return sortDir === "asc"
    ? <ChevronUp size={13} style={{ color: "var(--channel)", flexShrink: 0 }} />
    : <ChevronDown size={13} style={{ color: "var(--channel)", flexShrink: 0 }} />;
}

function SortTh({ col, label, sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        color: active ? "var(--channel)" : undefined,
        fontWeight: active ? 700 : undefined,
      }}>
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </span>
    </th>
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [sortCol, setSortCol] = useState("orderDate");
  const [sortDir, setSortDir] = useState("desc");

  async function load() {
    setLoading(true);
    const [m, o] = await Promise.all([getAllMasterLists(), listOrders()]);
    setMaster(m);
    setOrders(o);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = orders.filter((o) => {
      if (term) {
        const hay = `${o.namaCustomer || ""} ${o.poNo || ""} ${o.partNumber || ""} ${o.nomorNota || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (salesFilter && o.sales !== salesFilter) return false;
      if (statusFilter && o.status !== statusFilter) return false;
      if (dlvFilter && o.dlvType !== dlvFilter) return false;
      if (dateFrom && (o.orderDate || "") < dateFrom) return false;
      if (dateTo && (o.orderDate || "") > dateTo) return false;
      return true;
    });

    const key = SORT_COLS[sortCol];
    if (!key) return rows;
    return [...rows].sort((a, b) => {
      const va = key(a);
      const vb = key(b);
      let cmp = 0;
      if (typeof va === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "id");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [orders, search, salesFilter, statusFilter, dlvFilter, dateFrom, dateTo, sortCol, sortDir]);

  function openCreate() { setEditingOrder(null); setModalOpen(true); }
  function openEdit(order) { setEditingOrder(order); setModalOpen(true); }

  async function handleDelete(order) {
    if (!confirm(`Hapus pesanan ${order.partNumber} milik ${order.namaCustomer || "customer ini"}?`)) return;
    await deleteOrder(order.id);
    load();
  }

  function saveCell(order, field, value) {
    const before = order[field];
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, [field]: value } : o)));
    updateOrder(order.id, { [field]: value }).catch(() => {
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, [field]: before } : o)));
      alert("Gagal menyimpan perubahan, dikembalikan ke semula. Coba lagi.");
    });
  }

  const sortProps = { sortCol, sortDir, onSort: handleSort };

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
          <SearchableSelect value={salesFilter} onChange={setSalesFilter} options={master.sales} placeholder="Filter Sales" />
          <SearchableSelect value={statusFilter} onChange={setStatusFilter} options={master.status} placeholder="Filter Status" />
          <SearchableSelect value={dlvFilter} onChange={setDlvFilter} options={master.dlvType} placeholder="Filter DLV Type" />
          <div className="date-range-filter">
            <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>Tanggal:</span>
            <input
              type="date"
              className="input"
              style={{ width: 145 }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Dari tanggal"
            />
            <span className="muted" style={{ fontSize: 12 }}>—</span>
            <input
              type="date"
              className="input"
              style={{ width: 145 }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Sampai tanggal"
            />
            {(dateFrom || dateTo) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                title="Reset filter tanggal"
                style={{ padding: "5px 8px", color: "var(--danger)" }}
              >
                ✕
              </button>
            )}
          </div>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Tambah Pesanan
          </button>
        </div>

        {loading ? (
          <div className="skeleton">Memuat data pesanan...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">Tidak ada pesanan yang cocok dengan pencarian/filter ini.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <SortTh col="dlvType"      label="DLV"           {...sortProps} />
                  <SortTh col="orderDate"    label="Tanggal"       {...sortProps} />
                  <SortTh col="poNo"         label="PO No."        {...sortProps} />
                  <SortTh col="namaCustomer" label="Nama Customer" {...sortProps} />
                  <SortTh col="sales"        label="Sales"         {...sortProps} />
                  <SortTh col="partNumber"   label="Part Number"   {...sortProps} />
                  <SortTh col="partName"     label="Nama Part"     {...sortProps} />
                  <SortTh col="qOrder"       label="Qty"           {...sortProps} />
                  <SortTh col="nomorNota"    label="Nomor Nota"    {...sortProps} />
                  <SortTh col="status"       label="Status"        {...sortProps} />
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
                      <InlineTextCell value={o.namaCustomer} placeholder="Klik untuk isi nama customer"
                        onSave={(v) => saveCell(o, "namaCustomer", v)} />
                    </td>
                    <td>
                      <InlineSelectCell value={o.sales} options={master.sales} placeholder="Pilih sales"
                        onSave={(v) => saveCell(o, "sales", v)} />
                    </td>
                    <td><span className="tag">{o.partNumber}</span></td>
                    <td>{o.partName}</td>
                    <td>{o.qShipped}/{o.qOrder}</td>
                    <td>
                      <InlineTextCell value={o.nomorNota} placeholder="Klik untuk isi nomor nota"
                        onSave={(v) => saveCell(o, "nomorNota", v)} tag />
                    </td>
                    <td>
                      <InlineSelectCell value={o.status} options={master.status} placeholder="Pilih status"
                        onSave={(v) => saveCell(o, "status", v)}
                        renderDisplay={(v) => <StatusBadge status={v} />} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="icon-btn" onClick={() => openEdit(o)} title="Edit"><Pencil size={14} /></button>
                        <button className="icon-btn" onClick={() => handleDelete(o)} title="Hapus"><Trash2 size={14} /></button>
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
          {sortCol && <> · Diurutkan: <strong>{sortCol}</strong> ({sortDir === "asc" ? "A→Z" : "Z→A"})</>}
          {(dateFrom || dateTo) && (
            <> · Tanggal: <strong>{dateFrom || "..."}</strong> s/d <strong>{dateTo || "..."}</strong></>
          )}
        </p>
      </div>

      {modalOpen && (
        <OrderEditModal order={editingOrder} master={master}
          onClose={() => setModalOpen(false)} onSaved={load} />
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

