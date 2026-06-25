"use client";

export function DlvBadge({ type }) {
  if (type === "EMG") return <span className="badge badge-emg">EMG</span>;
  if (type === "REG") return <span className="badge badge-reg">REG</span>;
  return <span className="badge badge-neutral">{type || "-"}</span>;
}

const STATUS_STYLE = {
  Selesai: "badge-ok",
  "Sebagian Kirim": "badge-warn",
  Proses: "badge-reg",
  Open: "badge-neutral",
  Batal: "badge-danger",
};

export function StatusBadge({ status }) {
  const cls = STATUS_STYLE[status] || "badge-neutral";
  return <span className={`badge ${cls}`}>{status || "Open"}</span>;
}
