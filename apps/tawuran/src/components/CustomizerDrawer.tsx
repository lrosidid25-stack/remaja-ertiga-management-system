import React from 'react';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { PetasanSvgIcon, WeaponSvgIcon } from './SvgIcons';
import {
  MAX_GIR_LENGTH,
  MIN_GIR_LENGTH,
  THROWABLE_SPECS,
  WEAPON_ORDER,
  WEAPON_SPECS,
  clampGirLength,
  getEffectiveWeaponSpec,
} from '../game/rules';
import {
  DEFAULT_CHARACTER,
  type CharacterConfig,
  type HeadgearStyle,
  type OutfitStyle,
  type PantsStyle,
  type ThemeMode,
  type ThrowableId,
} from '../game/types';

export type CharacterModelMode = 'prosedural' | 'glb';

interface CustomizerDrawerProps {
  config: CharacterConfig;
  theme: ThemeMode;
  modelMode: CharacterModelMode;
  onChange: (next: CharacterConfig) => void;
  onChangeModelMode: (mode: CharacterModelMode) => void;
  onBack: () => void;
  onStart: () => void;
}

const OUTFIT_OPTIONS: Array<{ id: OutfitStyle; label: string }> = [
  { id: 'jaket_bomber', label: 'Jaket Bomber' },
  { id: 'putih_abu', label: 'Putih Abu' },
  { id: 'pramuka', label: 'Pramuka' },
  { id: 'kemeja_terbuka', label: 'Kemeja Terbuka' },
];

const PANTS_OPTIONS: Array<{ id: PantsStyle; label: string }> = [
  { id: 'abu_sekolah', label: 'Abu Sekolah' },
  { id: 'hitam_bahan', label: 'Hitam Bahan' },
  { id: 'jeans_sobek', label: 'Jeans Gelap' },
];

const HEADGEAR_OPTIONS: Array<{ id: HeadgearStyle; label: string }> = [
  { id: 'slayer_wajah', label: 'Slayer Wajah' },
  { id: 'topi_sekolah', label: 'Topi Sekolah' },
  { id: 'helm_proyek', label: 'Helm Proyek' },
  { id: 'rambut_gondrong', label: 'Gondrong' },
  { id: 'rambut_rapih', label: 'Rapih' },
];

const SKIN_TONES = [
  { label: 'Sawo Matang', hex: '#c68b59' },
  { label: 'Kuning Langsat', hex: '#dfb48a' },
  { label: 'Gelap', hex: '#8d5524' },
];

const JACKET_COLORS = [
  { label: 'Biru Dongker', hex: '#27303f' },
  { label: 'Merah Marun', hex: '#581c1c' },
  { label: 'Hijau Army', hex: '#2d3b2d' },
  { label: 'Hitam Pekat', hex: '#18181b' },
];

const SLAYER_COLORS = [
  { label: 'Merah', hex: '#b91c1c' },
  { label: 'Oranye', hex: '#c2410c' },
  { label: 'Hitam', hex: '#18181b' },
  { label: 'Biru', hex: '#1d4ed8' },
];

export const CustomizerDrawer: React.FC<CustomizerDrawerProps> = ({
  config,
  theme,
  modelMode,
  onChange,
  onChangeModelMode,
  onBack,
  onStart,
}) => {
  const isDark = theme === 'dark';

  const panelClass = isDark
    ? 'bg-zinc-950/94 border-zinc-800 text-zinc-100'
    : 'bg-white/95 border-zinc-300 text-zinc-900';

  const sectionLabelClass = `text-xs font-semibold tracking-wide ${
    isDark ? 'text-zinc-400' : 'text-zinc-600'
  }`;

  const chipClass = (active: boolean) =>
    `min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-colors cursor-pointer text-left ${
      active
        ? 'bg-amber-600 border-amber-500 text-white font-semibold'
        : isDark
          ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
          : 'bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200'
    }`;

  const girLen = clampGirLength(config.girLengthMeters);
  const selectedWeapon = getEffectiveWeaponSpec(config.primaryWeapon, girLen);
  const swingCycleSec = (
    selectedWeapon.windupSec +
    selectedWeapon.activeSec +
    selectedWeapon.recoverySec
  ).toFixed(2);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex items-end md:items-stretch justify-start p-3 sm:p-5 [@media(max-height:520px)]:p-2">
      <aside
        aria-label="Panel Kustomisasi Karakter"
        className={`pointer-events-auto w-full md:w-[400px] [@media(max-height:520px)]:w-[min(62vw,380px)] max-h-[86dvh] [@media(max-height:520px)]:max-h-[calc(100dvh-0.5rem)] md:max-h-full rounded-xl border shadow-2xl flex flex-col overflow-hidden ${panelClass}`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3.5 [@media(max-height:520px)]:px-3 [@media(max-height:520px)]:py-2 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-zinc-800' : 'border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onBack();
            }}
            className={`min-h-[44px] px-3 rounded-lg text-sm font-medium flex items-center gap-1.5 border cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                : 'bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          <h2 className="font-display font-bold text-xl tracking-wide">
            Kustomisasi Karakter
          </h2>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onChange({ ...DEFAULT_CHARACTER });
            }}
            aria-label="Reset Karakter"
            className={`min-h-[44px] w-11 rounded-lg flex items-center justify-center border cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable options */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-4 [@media(max-height:520px)]:p-3 space-y-5 [@media(max-height:520px)]:space-y-3.5">
          {/* Nama Pelajar */}
          <div>
            <label htmlFor="char-name-input" className={sectionLabelClass}>
              Nama Pelajar / Julukan
            </label>
            <input
              id="char-name-input"
              type="text"
              maxLength={22}
              value={config.name}
              onChange={(e) => onChange({ ...config, name: e.target.value })}
              className={`mt-1.5 w-full min-h-[44px] px-3 rounded-lg border text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500 ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                  : 'bg-zinc-50 border-zinc-300 text-zinc-900'
              }`}
            />
          </div>

          {/* Model Karakter: prosedural vs GLB modular */}
          <div>
            <div className={sectionLabelClass}>Model Karakter 3D</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeModelMode('prosedural')}
                className={chipClass(modelMode === 'prosedural')}
              >
                Prosedural (bawaan)
              </button>
              <button
                type="button"
                onClick={() => onChangeModelMode('glb')}
                className={chipClass(modelMode === 'glb')}
              >
                GLB Modular
              </button>
            </div>
            <p className={`mt-1.5 text-[11px] leading-snug ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              GLB = karakter modular (skeleton + socket aksesori). Kalau asetnya
              tidak ada, otomatis kembali ke prosedural.
            </p>
          </div>

          {/* Seragam & Jaket */}
          <div>
            <div className={sectionLabelClass}>Seragam & Pakaian Atas</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OUTFIT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...config, outfit: opt.id })}
                  className={chipClass(config.outfit === opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {config.outfit === 'jaket_bomber' && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-xs text-zinc-500 mr-1">Warna Jaket:</span>
                {JACKET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    aria-label={`Warna Jaket ${c.label}`}
                    onClick={() => onChange({ ...config, jacketColor: c.hex })}
                    className={`w-9 h-9 rounded-full border-2 cursor-pointer ${
                      config.jacketColor === c.hex
                        ? 'border-amber-400 scale-110'
                        : 'border-zinc-600'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Celana & Warna Kulit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className={sectionLabelClass}>Celana</div>
              <div className="mt-2 flex flex-col gap-2">
                {PANTS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ ...config, pants: opt.id })}
                    className={chipClass(config.pants === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className={sectionLabelClass}>Warna Kulit</div>
              <div className="mt-2 flex items-center gap-2.5">
                {SKIN_TONES.map((s) => (
                  <button
                    key={s.hex}
                    type="button"
                    aria-label={`Warna Kulit ${s.label}`}
                    onClick={() => onChange({ ...config, skinTone: s.hex })}
                    className={`w-10 h-10 rounded-full border-2 cursor-pointer ${
                      config.skinTone === s.hex
                        ? 'border-amber-400 scale-110'
                        : 'border-zinc-600'
                    }`}
                    style={{ backgroundColor: s.hex }}
                  />
                ))}
              </div>

              {config.headgear === 'slayer_wajah' && (
                <div className="mt-4">
                  <div className={sectionLabelClass}>Warna Slayer</div>
                  <div className="mt-2 flex items-center gap-2">
                    {SLAYER_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={`Slayer ${c.label}`}
                        onClick={() => onChange({ ...config, slayerColor: c.hex })}
                        className={`w-9 h-9 rounded-full border-2 cursor-pointer ${
                          config.slayerColor === c.hex
                            ? 'border-amber-400 scale-110'
                            : 'border-zinc-600'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kepala & Penutup */}
          <div>
            <div className={sectionLabelClass}>Gaya Rambut & Pelindung Kepala</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {HEADGEAR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChange({ ...config, headgear: opt.id })}
                  className={chipClass(config.headgear === opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Senjata Utama */}
          <div>
            <div className={sectionLabelClass}>Senjata Utama</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {WEAPON_ORDER.map((wId) => {
                const spec = WEAPON_SPECS[wId];
                const active = config.primaryWeapon === wId;
                return (
                  <button
                    key={wId}
                    type="button"
                    onClick={() => onChange({ ...config, primaryWeapon: wId })}
                    className={`${chipClass(active)} flex items-center gap-2`}
                  >
                    <WeaponSvgIcon weapon={wId} className="w-5 h-5 shrink-0" />
                    <span className="truncate">{spec.shortName}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected weapon breakdown */}
            <div
              className={`mt-2.5 p-3 rounded-lg border text-xs space-y-1.5 ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
              }`}
            >
              <div className="font-semibold text-sm">{selectedWeapon.name}</div>
              <div className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                {selectedWeapon.role}
              </div>
              <div className="pt-0.5 flex flex-wrap items-center gap-2 font-mono-num">
                <span>Daya: {selectedWeapon.damage}</span>
                <span>·</span>
                <span>Jangkauan: {selectedWeapon.reach}m</span>
                <span>·</span>
                <span>Ayun: {swingCycleSec}dtk</span>
              </div>

              {config.primaryWeapon === 'gir_sabuk' && (
                <div className="pt-2 mt-1 border-t border-zinc-700/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="gir-length-slider" className="font-semibold">
                      Panjang Sabuk Gir
                    </label>
                    <span className="font-mono-num font-bold text-amber-400">
                      {girLen.toFixed(1)} m
                    </span>
                  </div>
                  <input
                    id="gir-length-slider"
                    type="range"
                    min={MIN_GIR_LENGTH}
                    max={MAX_GIR_LENGTH}
                    step={0.5}
                    value={girLen}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        girLengthMeters: clampGirLength(parseFloat(e.target.value)),
                      })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-1.5">
                    {[2, 3.5, 5, 6].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => onChange({ ...config, girLengthMeters: preset })}
                        className={`min-h-[34px] rounded-md text-xs font-mono-num font-semibold border cursor-pointer ${
                          girLen === preset
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : isDark
                              ? 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                              : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-200'
                        }`}
                      >
                        {preset}m
                      </button>
                    ))}
                  </div>
                  <p className={`text-[11px] leading-snug ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Pendek (2m): ayunan cepat, daya kecil · Panjang (6m): putaran lambat, daya besar
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Petasan */}
          <div>
            <div className={sectionLabelClass}>Petasan / Peledak Lempar</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['petasan_banting', 'petasan_roman'] as ThrowableId[]).map((tId) => {
                const spec = THROWABLE_SPECS[tId];
                return (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => onChange({ ...config, throwable: tId })}
                    className={`${chipClass(config.throwable === tId)} flex items-center gap-2`}
                  >
                    <PetasanSvgIcon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{spec.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div
          className={`p-4 [@media(max-height:520px)]:p-2.5 border-t shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-white'
          }`}
        >
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="w-full min-h-[48px] [@media(max-height:520px)]:min-h-[44px] px-5 py-3 [@media(max-height:520px)]:py-2 rounded-lg bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-display font-bold text-xl [@media(max-height:520px)]:text-lg tracking-wide flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Simpan & Mulai Tawuran</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
