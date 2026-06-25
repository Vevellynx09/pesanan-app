"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import Shell from "@/components/Shell";
import QuickOrderForm from "@/components/QuickOrderForm";
import BulkAssignByPo from "@/components/BulkAssignByPo";
import { DlvBadge, StatusBadge } from "@/components/StatusBadge";
import { getAllMasterLists, listOrders } from "@/lib/firestore";

export default function BerandaPage() {
  const router = useRouter();
  const [master, setMaster] = useState({ sales: [], status: [], dlvType: [], loc: [] });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState("");

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

  const total = orders.length;
  const open = orders.filter((o) => o.status === "Open").length;
  const emg = orders.filter((o) => o.dlvType === "EMG").length;
  const selesai = orders.filter((o) => o.status === "Selesai").length;

  function goSearch(e) {
    e.preventDefault();
    router.push(`/pesanan?q=${encodeURIComponent(quickSearch)}`);
  }

  return (
    <Shell title="Beranda" subtitle="Ringkasan pesanan & input cepat pesanan baru">
      <div className="kpi-row">
        <div className="kpi">
          <div className="eyebrow">Total Pesanan</div>
          <div className="value">{loading ? "—" : total}</div>
        </div>
        <div className="kpi">
          <div className="eyebrow">Status Open</div>
          <div className="value">{loading ? "—" : open}</div>
        </div>
        <div className="kpi">
          <div className="eyebrow">Pengiriman EMG</div>
          <div className="value">{loading ? "—" : emg}</div>
        </div>
        <div className="kpi">
          <div className="eyebrow">Selesai</div>
          <div className="value">{loading ? "—" : selesai}</div>
        </div>
      </div>

      <div className="card">
        <form onSubmit={goSearch} style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <input
              className="input"
              placeholder="Cari cepat nama customer, PO No., atau part number..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            <Search size={15} />
            Cari Pesanan
          </button>
        </form>
      </div>

      <BulkAssignByPo orders={orders} master={master} onApplied={load} />

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Input Cepat</div>
            <h2>Tambah Pesanan Baru</h2>
          </div>
        </div>
        <QuickOrderForm master={master} onCreated={load} />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Aktivitas Terbaru</div>
            <h2>10 Pesanan Terakhir</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/pesanan")}>
            Lihat semua <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="skeleton">Memuat data...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">Belum ada pesanan. Tambahkan lewat form di atas.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>DLV</th>
                  <th>Tanggal</th>
                  <th>Nama Customer</th>
                  <th>Sales</th>
                  <th>Part Number</th>
                  <th>Nomor Nota</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.id} className={o.dlvType === "EMG" ? "dlv-emg" : "dlv-reg"}>
                    <td><DlvBadge type={o.dlvType} /></td>
                    <td>{o.orderDate || "-"}</td>
                    <td>{o.namaCustomer || <span className="muted">-</span>}</td>
                    <td>{o.sales || <span className="muted">-</span>}</td>
                    <td><span className="tag">{o.partNumber}</span></td>
                    <td>{o.nomorNota ? <span className="tag">{o.nomorNota}</span> : <span className="muted">-</span>}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
