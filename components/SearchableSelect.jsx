"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

/**
 * Dropdown dengan kotak pencarian di dalamnya.
 *
 * - options: array string ATAU array {label, value}
 * - onSearch: opsional, async (term) => options. Kalau diisi, komponen
 *   ini akan memanggil fungsi tersebut tiap kali user mengetik (dipakai
 *   untuk pencarian Part Number langsung dari Firestore).
 * - allowCustom: kalau false (default), nilai HARUS salah satu dari
 *   options/onSearch hasil pencarian (dipakai untuk validasi Part Number).
 */
export default function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  onSearch,
  placeholder = "Cari atau pilih...",
  allowCustom = false,
  disabled = false,
  required = false,
  renderOption,
  emptyText = "Tidak ada hasil.",
  autoOpen = false,
  onClose,
  compact = false,
}) {
  const [open, setOpen] = useState(autoOpen);
  const [term, setTerm] = useState("");
  const [remoteOptions, setRemoteOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const prevOpenRef = useRef(open);

  const normalized = (opts) =>
    opts.map((o) => (typeof o === "string" ? { label: o, value: o } : o));

  const baseOptions = useMemo(() => normalized(options), [options]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Beritahu parent setiap kali panel ini berubah dari terbuka -> tertutup
  // (baik karena pilih opsi maupun klik di luar). Dipakai untuk mode edit
  // inline di tabel supaya sel otomatis keluar dari mode edit.
  useEffect(() => {
    if (prevOpenRef.current && !open && onClose) onClose();
    prevOpenRef.current = open;
  }, [open, onClose]);

  useEffect(() => {
    if (!onSearch || !open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await onSearch(term);
        if (active) setRemoteOptions(normalized(res));
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term, open, onSearch]);

  const filtered = useMemo(() => {
    const pool = onSearch ? remoteOptions || [] : baseOptions;
    if (onSearch) return pool; // remote sudah memfilter
    if (!term) return pool;
    return pool.filter((o) =>
      o.label.toLowerCase().includes(term.toLowerCase())
    );
  }, [term, baseOptions, remoteOptions, onSearch]);

  const selectedLabel = useMemo(() => {
    const found = baseOptions.find((o) => o.value === value);
    if (found) return found.label;
    return value || "";
  }, [value, baseOptions]);

  function pick(opt) {
    onChange(opt.value, opt);
    setTerm("");
    setOpen(false);
  }

  function handleBlurCommit() {
    // Kalau allowCustom, biarkan teks yang diketik jadi nilai walau
    // tidak ada di daftar (misal untuk field non-validasi).
    if (allowCustom && term && term !== selectedLabel) {
      onChange(term);
    }
  }

  return (
    <div className={compact ? "ss-inline" : "field"} ref={wrapRef}>
      {label && (
        <label className="field-label">
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      <div className={`ss-control ${disabled ? "ss-disabled" : ""}`}>
        <button
          type="button"
          className={`ss-trigger ${compact ? "ss-trigger-compact" : ""}`}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={value ? "ss-value" : "ss-placeholder"}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown size={14} className="ss-chevron" />
        </button>
        {value && !disabled && !compact && (
          <button
            type="button"
            className="ss-clear"
            title="Hapus pilihan"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="ss-panel">
          <div className="ss-search">
            <Search size={14} />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onBlur={handleBlurCommit}
              placeholder="Ketik untuk mencari..."
            />
          </div>
          <div className="ss-options">
            {loading && <div className="ss-empty">Mencari...</div>}
            {!loading && filtered.length === 0 && (
              <div className="ss-empty">{emptyText}</div>
            )}
            {!loading &&
              filtered.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={`ss-option ${
                    opt.value === value ? "ss-option-active" : ""
                  }`}
                  onClick={() => pick(opt)}
                >
                  {renderOption ? renderOption(opt) : opt.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
