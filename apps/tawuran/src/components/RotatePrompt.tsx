import React from 'react';
import { Maximize2, Smartphone, X } from 'lucide-react';

interface RotatePromptProps {
  onActivateLandscape: () => void;
  onDismiss: () => void;
}

export const RotatePrompt: React.FC<RotatePromptProps> = ({
  onActivateLandscape,
  onDismiss,
}) => (
  <div className="fixed inset-x-3 top-3 z-50 pointer-events-auto flex justify-center">
    <div className="w-full max-w-sm rounded-xl border border-amber-500/50 bg-zinc-950/95 text-zinc-100 p-3.5 shadow-2xl flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
        <Smartphone className="w-5 h-5 rotate-90" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-base tracking-wide text-amber-400">
          Mainkan dalam Mode Miring
        </div>
        <p className="text-xs text-zinc-300 leading-snug">
          Putar HP ke posisi mendatar (landscape) agar arena & kontrol lebih lega.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onActivateLandscape}
            className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Putar & Layar Penuh</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
          >
            Nanti
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup Pemberitahuan Mode Miring"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);
