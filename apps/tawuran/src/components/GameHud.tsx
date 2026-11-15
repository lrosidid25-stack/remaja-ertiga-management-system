import React from 'react';
import { Maximize2, Moon, Pause, Shield, Sun, Volume2, VolumeX } from 'lucide-react';
import { PetasanSvgIcon, WeaponSvgIcon } from './SvgIcons';
import { TouchControls } from './TouchControls';
import { WEAPON_ORDER, WEAPON_SPECS } from '../game/rules';
import type { HudSnapshot, ThemeMode, WeaponId } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  playerName: string;
  theme: ThemeMode;
  muted: boolean;
  onSelectWeapon: (weapon: WeaponId) => void;
  onChangeGirLength: (meters: number) => void;
  onThrowPetasan: () => void;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleTheme: () => void;
  onActivateLandscape: () => void;
  onTouchMove: (dx: number, dy: number) => void;
  onTouchAttack: () => void;
  onTouchBlock: (active: boolean) => void;
  onTouchDodge: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  playerName,
  theme,
  muted,
  onSelectWeapon,
  onChangeGirLength,
  onThrowPetasan,
  onPause,
  onToggleMute,
  onToggleTheme,
  onActivateLandscape,
  onTouchMove,
  onTouchAttack,
  onTouchBlock,
  onTouchDodge,
}) => {
  const isDark = theme === 'dark';
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const ghostPct = Math.max(0, Math.min(100, (hud.ghostHp / hud.maxHp) * 100));
  const stamPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));
  const lowHp = hpPct <= 28;

  const surfaceClass = isDark
    ? 'bg-zinc-950/90 border-zinc-800 text-zinc-100'
    : 'bg-white/94 border-zinc-300 text-zinc-900';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5 [@media(max-height:520px)]:p-2.5">
      {/* Subtle low-HP peripheral vignette */}
      {lowHp && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(220, 38, 38, 0.52)',
          }}
        />
      )}

      {/* TOP PERIMETER CLUSTERS */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left: Vitality, Ghost Damage & Stamina */}
        <div
          className={`w-40 sm:w-68 [@media(max-height:520px)]:w-52 p-2.5 sm:p-3 [@media(max-height:520px)]:p-2 rounded-xl border shadow-lg ${surfaceClass}`}
        >
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="font-display font-bold text-sm sm:text-lg [@media(max-height:520px)]:text-sm tracking-wide truncate">
              {playerName}
            </span>
            <span className="font-mono-num text-xs sm:text-sm font-bold text-red-500 shrink-0">
              {hud.hp}/{hud.maxHp}
            </span>
          </div>

          {/* HP bar with delayed ghost trail */}
          <div className="mt-1.5 [@media(max-height:520px)]:mt-1 relative h-2.5 sm:h-3 [@media(max-height:520px)]:h-2 w-full rounded bg-zinc-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-amber-400/75 transition-all duration-150"
              style={{ width: `${ghostPct}%` }}
            />
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-75 ${
                lowHp ? 'bg-red-500' : 'bg-red-600'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          {/* Stamina bar */}
          <div className="mt-1.5 sm:mt-2 [@media(max-height:520px)]:mt-1 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold opacity-75 w-9 shrink-0">TENAGA</span>
            <div className="flex-1 h-1.5 rounded bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${stamPct}%` }}
              />
            </div>
          </div>

          {hud.isBlocking && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Tangkis Aktif</span>
            </div>
          )}
        </div>

        {/* Top-Right: Wave, Score & Utility Buttons */}
        <div className="flex flex-col items-end gap-1.5 sm:gap-2">
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 pointer-events-auto">
            <div
              className={`px-2.5 sm:px-3.5 [@media(max-height:520px)]:px-2.5 py-1.5 sm:py-2 [@media(max-height:520px)]:py-1.5 rounded-xl border shadow-lg flex items-center gap-2 sm:gap-3 [@media(max-height:520px)]:gap-2 ${surfaceClass}`}
            >
              <div>
                <div className="text-[9px] sm:text-[10px] font-semibold opacity-70">GELOMBANG</div>
                <div className="font-mono-num font-bold text-xs sm:text-base [@media(max-height:520px)]:text-sm">
                  {hud.wave}/{hud.maxWaves}
                </div>
              </div>
              <div className="w-px h-5 sm:h-6 bg-zinc-700/50" />
              <div>
                <div className="text-[9px] sm:text-[10px] font-semibold opacity-70">REKAN</div>
                <div className="font-mono-num font-bold text-xs sm:text-base [@media(max-height:520px)]:text-sm text-emerald-400">
                  {hud.alliesAlive}/{hud.alliesTotal}
                </div>
              </div>
              <div className="w-px h-5 sm:h-6 bg-zinc-700/50" />
              <div>
                <div className="text-[9px] sm:text-[10px] font-semibold opacity-70">LAWAN</div>
                <div className="font-mono-num font-bold text-xs sm:text-base [@media(max-height:520px)]:text-sm text-amber-500">
                  {hud.enemiesAlive}
                </div>
              </div>
              <div className="w-px h-5 sm:h-6 bg-zinc-700/50" />
              <div>
                <div className="text-[9px] sm:text-[10px] font-semibold opacity-70">SKOR</div>
                <div className="font-mono-num font-bold text-xs sm:text-base [@media(max-height:520px)]:text-sm">
                  {hud.score.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onActivateLandscape();
                }}
                aria-label="Layar Penuh Miring"
                className={`h-9 w-9 sm:h-11 sm:w-11 [@media(max-height:520px)]:h-10 [@media(max-height:520px)]:w-10 rounded-lg sm:rounded-xl border flex items-center justify-center cursor-pointer ${surfaceClass}`}
              >
                <Maximize2 className="w-4 h-4 text-emerald-400" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleTheme();
                }}
                aria-label="Ubah Mode Gelap atau Terang"
                className={`h-9 w-9 sm:h-11 sm:w-11 [@media(max-height:520px)]:h-10 [@media(max-height:520px)]:w-10 rounded-lg sm:rounded-xl border flex items-center justify-center cursor-pointer ${surfaceClass}`}
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-600" />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                aria-label={muted ? 'Nyalakan Suara' : 'Matikan Suara'}
                className={`h-9 w-9 sm:h-11 sm:w-11 [@media(max-height:520px)]:h-10 [@media(max-height:520px)]:w-10 rounded-lg sm:rounded-xl border flex items-center justify-center cursor-pointer ${surfaceClass}`}
              >
                {muted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                aria-label="Jeda Permainan"
                className={`h-9 w-9 sm:h-11 sm:w-11 [@media(max-height:520px)]:h-10 [@media(max-height:520px)]:w-10 rounded-lg sm:rounded-xl border flex items-center justify-center cursor-pointer ${surfaceClass}`}
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {hud.combo > 1 && (
            <div className="px-3 py-1 rounded-lg bg-amber-600 text-white font-display font-bold text-lg sm:text-xl [@media(max-height:520px)]:text-base tracking-wide shadow-md">
              <span className="font-mono-num">{hud.combo}x</span> KOMBO
            </div>
          )}
        </div>
      </div>

      {/* Transient Top-Center Wave / Hit Feedback */}
      <div className="absolute top-32 sm:top-20 [@media(max-height:520px)]:top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none w-max max-w-[90vw]">
        {hud.waveBannerText && (
          <div className="px-4 py-1 rounded-lg bg-red-600 text-white font-display font-extrabold text-lg sm:text-2xl [@media(max-height:520px)]:text-lg tracking-wider shadow-xl">
            {hud.waveBannerText}
          </div>
        )}
        {hud.hitFeedbackLabel && (
          <div className="font-display font-bold text-base sm:text-xl [@media(max-height:520px)]:text-base text-amber-400 hud-text-stroke tracking-wide">
            {hud.hitFeedbackLabel}
          </div>
        )}
      </div>

      {/* Responsive Mobile/Tablet Touch Controls */}
      <TouchControls
        ammoPetasan={hud.ammoPetasan}
        petasanCooldown={hud.petasanCooldown}
        onMove={onTouchMove}
        onAttack={onTouchAttack}
        onThrowPetasan={onThrowPetasan}
        onBlockChange={onTouchBlock}
        onDodge={onTouchDodge}
      />

      {/* BOTTOM PERIMETER WEAPON & PETASAN DOCK (Compact on portrait & short landscape so clear of TouchControls) */}
      <div className="flex flex-col items-center gap-1.5">
        {hud.activeWeapon === 'gir_sabuk' && (
          <div
            className={`pointer-events-auto px-2 py-1 rounded-lg border shadow-md flex items-center gap-1.5 text-[11px] font-semibold ${surfaceClass}`}
          >
            <span className="opacity-75">Sabuk Gir:</span>
            {[2, 3.5, 5, 6].map((len) => (
              <button
                key={len}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onChangeGirLength(len);
                }}
                aria-label={`Panjang Gir ${len} meter`}
                className={`min-h-[28px] px-2 rounded font-mono-num cursor-pointer transition-colors ${
                  hud.girLengthMeters === len
                    ? 'bg-amber-600 text-white'
                    : isDark
                      ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {len}m
              </button>
            ))}
          </div>
        )}

        <div
          className={`pointer-events-auto p-1 sm:p-1.5 [@media(max-height:520px)]:p-1 rounded-xl border shadow-xl flex items-center gap-1 sm:gap-2 [@media(max-height:520px)]:gap-1 max-w-full ${surfaceClass}`}
        >
          {WEAPON_ORDER.map((wId, idx) => {
            const spec = WEAPON_SPECS[wId];
            const active = hud.activeWeapon === wId;
            return (
              <button
                key={wId}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectWeapon(wId);
                }}
                aria-label={`Pilih ${spec.name}`}
                className={`min-h-[42px] sm:min-h-[44px] [@media(max-height:520px)]:min-h-[40px] px-2 sm:px-3.5 [@media(max-height:520px)]:px-2 py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-red-600 text-white'
                    : isDark
                      ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                      : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                }`}
              >
                <span className="font-mono-num text-[10px] sm:text-[11px] opacity-75">[{idx + 1}]</span>
                <WeaponSvgIcon weapon={wId} className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline [@media(max-height:520px)]:hidden">
                  {spec.shortName}
                </span>
              </button>
            );
          })}

          <div className="w-px h-6 sm:h-7 bg-zinc-700/50 shrink-0" />

          <button
            type="button"
            tabIndex={-1}
            disabled={hud.ammoPetasan <= 0 || hud.petasanCooldown > 0}
            onClick={(e) => {
              e.currentTarget.blur();
              onThrowPetasan();
            }}
            aria-label="Lempar Petasan"
            className={`min-h-[42px] sm:min-h-[44px] [@media(max-height:520px)]:min-h-[40px] px-2.5 sm:px-3 [@media(max-height:520px)]:px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              hud.ammoPetasan > 0 && hud.petasanCooldown <= 0
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : isDark
                  ? 'bg-zinc-900 text-zinc-500'
                  : 'bg-zinc-200 text-zinc-400'
            }`}
          >
            <span className="hidden sm:inline [@media(max-height:520px)]:hidden font-mono-num text-[11px] opacity-80">
              [E]
            </span>
            <PetasanSvgIcon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline [@media(max-height:520px)]:hidden">Petasan</span>
            <span className="font-mono-num font-bold">
              {hud.petasanCooldown > 0 ? `${hud.petasanCooldown}s` : `x${hud.ammoPetasan}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
