import React, { useEffect, useRef, useState } from 'react';
import { Copy, Loader2, LogIn, Plus, Users, X } from 'lucide-react';
import type { ThemeMode } from '../game/types';
import type { MabarRole, MabarStatus } from '../net/mabar';
import { MABAR_ROOM_LENGTH, normalizeRoomCode } from '../net/mabar-protocol';

export type MabarUiStatus = 'idle' | MabarStatus;

interface MabarModalProps {
  theme: ThemeMode;
  status: MabarUiStatus;
  role: MabarRole | null;
  code: string;
  detail: string;
  peerName: string;
  levelName: string;
  onHost: () => void;
  onJoin: (code: string) => void;
  onCancel: () => void;
}

export const MabarModal: React.FC<MabarModalProps> = ({
  theme,
  status,
  role,
  code,
  detail,
  peerName,
  levelName,
  onHost,
  onJoin,
  onCancel,
}) => {
  const isDark = theme === 'dark';
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const busy = status === 'connecting' || status === 'waiting' || status === 'ready';
  const surface = isDark
    ? 'bg-zinc-950/95 border-zinc-800 text-zinc-100'
    : 'bg-white/96 border-zinc-300 text-zinc-900';

  const handleJoin = () => {
    const code2 = normalizeRoomCode(input);
    if (!code2) {
      setInputError(`Kode harus ${MABAR_ROOM_LENGTH} huruf/angka (contoh: AB3D)`);
      return;
    }
    setInputError('');
    onJoin(code2);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
    } catch {
      setCopied(true);
    }
  };

  const statusText = () => {
    if (status === 'connecting') return 'Menyambung ke server mabar…';
    if (status === 'waiting') return 'Menunggu teman masuk…';
    if (status === 'ready') return `Tersambung dengan ${peerName || 'teman'}! Memulai duel…`;
    if (status === 'peer-left') return 'Temanmu keluar atau sinyalnya putus.';
    if (status === 'error') return detail || 'Gagal menyambung. Coba lagi.';
    return 'Pilih jadi tuan rumah (bikin kode) atau masuk pakai kode teman.';
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-5 bg-black/70 backdrop-blur-sm">
      <div
        className={`flex flex-col max-h-full min-h-0 w-full max-w-md rounded-xl border shadow-2xl ${surface}`}
        role="dialog"
        aria-label="Mabar Online"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 p-3.5 sm:p-4 pb-2 border-b border-zinc-700/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-8 w-8 shrink-0 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-base sm:text-lg leading-tight truncate">
                Mabar Online · Duel 1v1
              </div>
              <div className="text-[10px] sm:text-[11px] opacity-70 truncate">
                Lawan temanmu di map {levelName} · butuh internet
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup"
            className={`h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center cursor-pointer ${
              isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-100 border-zinc-300'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar touch-pan-y p-3.5 sm:p-4 pt-2.5">
          <p
            className={`text-[11px] sm:text-xs leading-snug ${
              status === 'error' || status === 'peer-left'
                ? 'text-red-500 font-semibold'
                : isDark
                  ? 'text-zinc-300'
                  : 'text-zinc-700'
            }`}
          >
            {status === 'connecting' && <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />}
            {statusText()}
          </p>

          {status === 'idle' && (
            <div className="mt-3 space-y-2.5">
              <button
                type="button"
                onClick={onHost}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Buat Room (jadi tuan rumah)
              </button>

              <div className="flex items-center gap-2">
                <div className={`flex-1 h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
                <span className="text-[10px] uppercase tracking-wider opacity-60">atau</span>
                <div className={`flex-1 h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
              </div>

              <div className="flex items-stretch gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value.toUpperCase().slice(0, MABAR_ROOM_LENGTH));
                    setInputError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoin();
                  }}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="KODE"
                  aria-label="Kode room"
                  className={`flex-1 min-h-[44px] px-3 rounded-lg border font-mono-num text-lg tracking-[0.3em] text-center uppercase ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleJoin}
                  className="min-h-[44px] px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Gabung
                </button>
              </div>
              {inputError && (
                <p className="text-[11px] text-red-500 font-semibold">{inputError}</p>
              )}
            </div>
          )}

          {(role === 'host' || role === 'guest') && status !== 'idle' && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider opacity-60">Kode Room</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="font-mono-num font-bold text-3xl sm:text-4xl tracking-[0.28em] text-amber-500">
                  {code}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Salin kode"
                  className={`h-9 w-9 rounded-lg border flex items-center justify-center cursor-pointer ${
                    isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-100 border-zinc-300'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                </button>
                {copied && <span className="text-[10px] text-emerald-500 font-semibold">Tersalin</span>}
              </div>
              <p className={`mt-2 text-[11px] leading-snug ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {role === 'host'
                  ? 'Kirim kode ini ke temanmu (WhatsApp/chat). Dia buka Tawuran → Mabar → masukkan kode.'
                  : 'Tunggu tuan rumah memulai duel.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3.5 sm:p-4 pt-2.5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 min-h-[42px] px-4 py-2 rounded-lg font-semibold text-sm border cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                : 'bg-zinc-100 border-zinc-300 text-zinc-900'
            }`}
          >
            {busy ? 'Batalkan' : 'Tutup'}
          </button>
        </div>
      </div>
    </div>
  );
};
