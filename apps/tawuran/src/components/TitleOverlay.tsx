import React from 'react';
import { SlidersHorizontal, Sun, Moon, Play, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { TitleEmblemSvg } from './SvgIcons';
import { WEAPON_SPECS, THROWABLE_SPECS } from '../game/rules';
import type { CharacterConfig, ThemeMode } from '../game/types';

interface TitleOverlayProps {
  config: CharacterConfig;
  bestScore: number;
  theme: ThemeMode;
  muted: boolean;
  onStart: () => void;
  onOpenCustomizer: () => void;
  onToggleTheme: () => void;
  onToggleMute: () => void;
  onActivateLandscape: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  config,
  bestScore,
  theme,
  muted,
  onStart,
  onOpenCustomizer,
  onToggleTheme,
  onToggleMute,
  onActivateLandscape,
}) => {
  const isDark = theme === 'dark';
  const activeWeaponSpec = WEAPON_SPECS[config.primaryWeapon];
  const activeThrowableSpec = THROWABLE_SPECS[config.throwable];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-6 [@media(max-height:520px)]:p-3">
      {/* Top-right compact utility controls */}
      <div className="flex justify-end items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onActivateLandscape();
          }}
          aria-label="Layar Penuh Miring"
          className="h-10 sm:h-11 px-3 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1.5 border transition-colors cursor-pointer bg-zinc-900/90 text-zinc-100 border-zinc-700 hover:bg-zinc-800"
        >
          <Maximize2 className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline whitespace-nowrap">Layar Penuh</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleTheme();
          }}
          aria-label={isDark ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
          className="h-10 sm:h-11 px-3 sm:px-3.5 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-2 border transition-colors cursor-pointer bg-zinc-900/90 text-zinc-100 border-zinc-700 hover:bg-zinc-800"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />}
          <span className="hidden sm:inline whitespace-nowrap">
            {isDark ? 'Mode Terang' : 'Mode Gelap'}
          </span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg flex items-center justify-center border transition-colors cursor-pointer bg-zinc-900/90 text-zinc-100 border-zinc-700 hover:bg-zinc-800"
        >
          {muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Left-Aligned Composition over negative space (Hero stands on right-center) */}
      <div className="max-w-md [@media(max-height:520px)]:max-w-sm w-full my-auto pointer-events-auto">
        <div
          className={`p-4 sm:p-6 [@media(max-height:520px)]:p-3.5 rounded-xl border shadow-2xl ${
            isDark
              ? 'bg-zinc-950/88 border-zinc-800 text-zinc-100'
              : 'bg-white/92 border-zinc-300 text-zinc-900'
          }`}
        >
          <div className="[@media(max-height:520px)]:max-w-[235px]">
            <TitleEmblemSvg isDark={isDark} />
          </div>

          {/* Active Loadout Summary - Unboxed clean metadata */}
          <div
            className={`mt-3 [@media(max-height:520px)]:mt-2 pt-2.5 [@media(max-height:520px)]:pt-2 border-t text-xs sm:text-sm flex flex-wrap items-center gap-x-2 gap-y-1 ${
              isDark ? 'border-zinc-800 text-zinc-300' : 'border-zinc-200 text-zinc-700'
            }`}
          >
            <span className="font-semibold">{config.name}</span>
            <span aria-hidden="true">·</span>
            <span>{activeWeaponSpec.shortName}</span>
            <span aria-hidden="true">·</span>
            <span>{activeThrowableSpec.shortName}</span>
            {bestScore > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-amber-500 font-semibold">
                  Rekor {bestScore.toLocaleString('id-ID')}
                </span>
              </>
            )}
          </div>

          {/* Clear Primary + Secondary CTAs */}
          <div className="mt-4 [@media(max-height:520px)]:mt-3 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStart();
              }}
              className="flex-1 min-h-[44px] sm:min-h-[48px] px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-display font-bold text-lg sm:text-xl tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Mulai Tawuran</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCustomizer();
              }}
              className={`min-h-[44px] sm:min-h-[48px] px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800'
                  : 'bg-zinc-100 border-zinc-300 text-zinc-900 hover:bg-zinc-200'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-500" />
              <span className="whitespace-nowrap">Kustomisasi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Single flat inline control-hint line */}
      <div className="text-center">
        <p className="inline-block text-[11px] sm:text-sm font-medium text-zinc-200 hud-text-stroke">
          WASD Gerak · J / Klik Serang · K Tangkis · L / E Petasan · Spasi Hindar · 1-4 Ganti Senjata
        </p>
      </div>
    </div>
  );
};
