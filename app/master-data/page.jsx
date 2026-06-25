"use client";

import { useEffect, useState } from "react";
import { Plus, X, Database } from "lucide-react";
import Shell from "@/components/Shell";
import {
  MASTER_KEYS,
  countPartNumbers,
  getAllMasterLists,
  setMasterList,
  searchPartNumbersByPrefix,
} from "@/lib/firestore";

const SECTIONS = [
  { key: MASTER_KEYS.SALES, title: "Daftar Sales", hint: "Nama sales yang muncul di dropdown-search seluruh pesanan." },
  { key: MASTER_KEYS.STATUS, title: "Daftar Status Pesanan", hint: "Status yang bisa dipilih untuk setiap pesanan." },
  { key: MASTER_KEYS.DLV_TYPE, title: "Daftar DLV Type", hint: "Tipe pengiriman, contoh: REG, EMG." },
  { key: MASTER_KEYS.LOC, title: "Daftar Lokasi", hint: "Lokasi gudang asal barang, contoh: JPN, JKT." },
];

function MasterListEditor({ section, items, onAdd, onRemove }) {
  const [value, setValue] = useState("");

  function handleAdd(e) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setValue("");
    onAdd(section.key, v);
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{section.title}</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{section.hint}</p>
        </div>
      </div>

      <div className="pill-list">
        {items.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Belum ada data.</span>}
        {items.map((item) => (
          <div className="pill" key={item}>
            {item}
            <button type="button" onClick={() => onRemove(section.key, item)} title="Hapus" aria-label={`Hapus ${item}`}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      <form className="add-pill-row" onSubmit={handleAdd}>
        <input
          className="input"
          placeholder={`Tambah ke daftar ${section.title.toLowerCase()}...`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit">
          <Plus size={14} /> Tambah
        </button>
      </form>
    </div>
  );
}

function PartNumberLookup() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    countPartNumbers().then(setCount);
  }, []);

  useEffect(() => {
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchPartNumbersByPrefix(term, 15);
      if (active) {
        setResults(res);
        setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Database Part Number</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {count === null ? "Memuat jumlah..." : `${count.toLocaleString("id-ID")} part number tersimpan.`}{" "}
            Part Number divalidasi otomatis setiap kali diisi di mana pun di aplikasi.
          </p>
        </div>
        <Database size={18} className="muted" />
      </div>

      <input
        className="input mono"
        placeholder="Cari part number, cth. 62T-11651..."
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Part Number</th>
              <th>Deskripsi</th>
              <th>Tipe</th>
              <th>Harga Retail</th>
            </tr>
          </thead>
          <tbody>
            {searching && (
              <tr><td colSpan={4} className="muted">Mencari...</td></tr>
            )}
            {!searching && results.length === 0 && (
              <tr><td colSpan={4} className="muted">Tidak ada hasil.</td></tr>
            )}
            {!searching && results.map((p) => (
              <tr key={p.id}>
                <td><span className="tag">{p.partNumber}</span></td>
                <td>{p.description}</td>
                <td>{p.partType}</td>
                <td>{p.retailPrice ? p.retailPrice.toLocaleString("id-ID") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MasterDataPage() {
  const [lists, setLists] = useState({ sales: [], status: [], dlvType: [], loc: [] });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setLists(await getAllMasterLists());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Optimistic: UI berubah instan, baru disimpan ke Firestore di belakang.
  // Kalau gagal simpan, balikin lagi (rollback) supaya data tetap konsisten.
  function handleAdd(key, value) {
    const before = lists[key] || [];
    if (before.includes(value)) return;
    const updated = [...before, value];
    setLists((l) => ({ ...l, [key]: updated }));
    setMasterList(key, updated).catch(() => {
      setLists((l) => ({ ...l, [key]: before }));
      alert("Gagal menyimpan ke server, dikembalikan ke semula. Coba lagi.");
    });
  }

  function handleRemove(key, value) {
    const before = lists[key] || [];
    const updated = before.filter((v) => v !== value);
    setLists((l) => ({ ...l, [key]: updated }));
    setMasterList(key, updated).catch(() => {
      setLists((l) => ({ ...l, [key]: before }));
      alert("Gagal menghapus di server, dikembalikan ke semula. Coba lagi.");
    });
  }

  return (
    <Shell
      title="Master Data"
      subtitle="Admin mengontrol seluruh daftar dropdown di sini"
    >
      {loading ? (
        <div className="skeleton">Memuat master data...</div>
      ) : (
        SECTIONS.map((section) => (
          <MasterListEditor
            key={section.key}
            section={section}
            items={lists[section.key] || []}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        ))
      )}

      <PartNumberLookup />
    </Shell>
  );
}
