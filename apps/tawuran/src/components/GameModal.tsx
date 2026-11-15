import React from 'react';
import { ChevronRight, Home, Play, RotateCcw, SlidersHorizontal, Trophy, Skull } from 'lucide-react';
import type { HudSnapshot, ThemeMode } from '../game/types';

interface GameModalProps {
  hud: HudSnapshot;
  theme: ThemeMode;
  /** Map berikutnya yang sudah terbuka (null kalau ini map terakhir / belum terbuka). */
  nextLevel?: { id: number; nama: string } | null;
  onResume: () => void;
  onRestart: () => void;
  onNextLevel?: () => void;
  onCustomize: () => void;
  onReturnTitle: () => void;
}

export const GameModal: React.FC<GameModalProps> = ({
  hud,
  theme,
  nextLevel = null,
  onResume,
  onRestart,
  onNextLevel,
  onCustomize,
  onReturnTitle,
}) => {
  const canContinue = Boolean(hud.isVictory && nextLevel && onNextLevel);
  const isDark = theme === 'dark';
  const isPaused = hud.state === 'paused';
  const isGameOver = hud.state === 'gameover';

  if (!isPaused && !isGameOver) return null;

  const cardClass = isDark
    ? 'bg-zinc-950/96 border-zinc-800 text-zinc-100'
    : 'bg-white/96 border-zinc-300 text-zinc-900';

  const secondaryBtnClass = `min-h-[46px] [@media(max-height:520px)]:min-h-[42px] px-4 py-2.5 [@media(max-height:520px)]:py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 border cursor-pointer transition-colors ${
    isDark
      ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
      : 'bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200'
  }`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 [@media(max-height:520px)]:p-2.5 bg-black/65">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        className={`w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl border p-6 [@media(max-height:520px)]:p-4 shadow-2xl ${cardClass}`}
      >
        {isPaused ? (
          <>
            <h2
              id="modal-heading"
              className="font-display font-bold text-3xl [@media(max-height:520px)]:text-2xl tracking-wide"
            >
              Permainan Dijeda
            </h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Gelombang {hud.wave} dari {hud.maxWaves} · Skor{' '}
              <span className="font-mono-num font-semibold">
                {hud.score.toLocaleString('id-ID')}
              </span>
            </p>

            <div className="mt-6 [@media(max-height:520px)]:mt-3.5 flex flex-col gap-3 [@media(max-height:520px)]:gap-2">
              <button
                type="button"
                onClick={onResume}
                className="min-h-[48px] [@media(max-height:520px)]:min-h-[44px] px-5 py-3 [@media(max-height:520px)]:py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xl [@media(max-height:520px)]:text-lg tracking-wide flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Lanjutkan</span>
              </button>

              <button type="button" onClick={onRestart} className={secondaryBtnClass}>
                <RotateCcw className="w-4 h-4" />
                <span>Ulangi Gelombang</span>
              </button>

              <div className="grid grid-cols-2 gap-3 [@media(max-height:520px)]:gap-2">
                <button type="button" onClick={onCustomize} className={secondaryBtnClass}>
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Kustomisasi</span>
                </button>
                <button type="button" onClick={onReturnTitle} className={secondaryBtnClass}>
                  <Home className="w-4 h-4" />
                  <span>Beranda</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {hud.isVictory ? (
                <div className="w-12 h-12 [@media(max-height:520px)]:w-10 [@media(max-height:520px)]:h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
                  <Trophy className="w-6 h-6 [@media(max-height:520px)]:w-5 [@media(max-height:520px)]:h-5" />
                </div>
              ) : (
                <div className="w-12 h-12 [@media(max-height:520px)]:w-10 [@media(max-height:520px)]:h-10 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0">
                  <Skull className="w-6 h-6 [@media(max-height:520px)]:w-5 [@media(max-height:520px)]:h-5" />
                </div>
              )}
              <div>
                <h2
                  id="modal-heading"
                  className="font-display font-bold text-3xl [@media(max-height:520px)]:text-2xl tracking-wide"
                >
                  {hud.isVictory ? 'Jalanan Dikuasai!' : 'Tumbang di Jalanan'}
                </h2>
                <p className={`text-sm [@media(max-height:520px)]:text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {hud.isVictory
                    ? nextLevel
                      ? `Map ${nextLevel.id} · ${nextLevel.nama} sudah terbuka!`
                      : 'Semua gelombang lawan berhasil dipukul mundur.'
                    : `Terhenti di Gelombang ${hud.wave} dari ${hud.maxWaves}.`}
                </p>
              </div>
            </div>

            {/* 3 Tabular Stat Tiles */}
            <div className="mt-5 [@media(max-height:520px)]:mt-3 grid grid-cols-3 gap-2.5 [@media(max-height:520px)]:gap-2">
              <div
                className={`p-3 [@media(max-height:520px)]:p-2 rounded-lg border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                }`}
              >
                <div className="text-[11px] font-semibold opacity-70">SKOR</div>
                <div className="mt-1 [@media(max-height:520px)]:mt-0.5 font-mono-num font-bold text-lg [@media(max-height:520px)]:text-base text-amber-500">
                  {hud.score.toLocaleString('id-ID')}
                </div>
              </div>
              <div
                className={`p-3 [@media(max-height:520px)]:p-2 rounded-lg border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                }`}
              >
                <div className="text-[11px] font-semibold opacity-70">TUMBANG</div>
                <div className="mt-1 [@media(max-height:520px)]:mt-0.5 font-mono-num font-bold text-lg [@media(max-height:520px)]:text-base">
                  {hud.defeatedCount}
                </div>
              </div>
              <div
                className={`p-3 [@media(max-height:520px)]:p-2 rounded-lg border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                }`}
              >
                <div className="text-[11px] font-semibold opacity-70">KOMBO MAKS</div>
                <div className="mt-1 [@media(max-height:520px)]:mt-0.5 font-mono-num font-bold text-lg [@media(max-height:520px)]:text-base">
                  {hud.maxCombo}x
                </div>
              </div>
            </div>

            <div className="mt-3 [@media(max-height:520px)]:mt-2 text-xs opacity-75 flex items-center justify-between">
              <span>Rekor Terbaik</span>
              <span className="font-mono-num font-semibold">
                {hud.bestScore.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="mt-5 [@media(max-height:520px)]:mt-3 flex flex-col gap-3 [@media(max-height:520px)]:gap-2">
              {canContinue && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onNextLevel}
                  className="min-h-[52px] [@media(max-height:520px)]:min-h-[46px] px-5 py-3 [@media(max-height:520px)]:py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xl [@media(max-height:520px)]:text-lg tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                  <span>Lanjut ke Map {nextLevel?.id}</span>
                </button>
              )}

              {!canContinue && (
                <button
                  type="button"
                  data-start="true"
                  onClick={onRestart}
                  className="min-h-[48px] [@media(max-height:520px)]:min-h-[44px] px-5 py-3 [@media(max-height:520px)]:py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xl [@media(max-height:520px)]:text-lg tracking-wide flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>{hud.isVictory ? 'Main Lagi' : 'Coba Lagi'}</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-3 [@media(max-height:520px)]:gap-2">
                {canContinue ? (
                  <>
                    <button type="button" onClick={onRestart} className={secondaryBtnClass}>
                      <RotateCcw className="w-4 h-4" />
                      <span>Main Lagi</span>
                    </button>
                    <button type="button" onClick={onCustomize} className={secondaryBtnClass}>
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>Kustomisasi</span>
                    </button>
                    <button
                      type="button"
                      onClick={onReturnTitle}
                      className={`${secondaryBtnClass} col-span-2`}
                    >
                      <Home className="w-4 h-4" />
                      <span>Beranda</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={onCustomize} className={secondaryBtnClass}>
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>Kustomisasi</span>
                    </button>
                    <button type="button" onClick={onReturnTitle} className={secondaryBtnClass}>
                      <Home className="w-4 h-4" />
                      <span>Beranda</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
