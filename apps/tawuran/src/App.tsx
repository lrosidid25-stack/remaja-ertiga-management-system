import { useCallback, useEffect, useRef, useState } from 'react';
import { BrawlEngine } from './game/engine';
import { clampGirLength } from './game/rules';
import { LEVELS, MAX_LEVEL, loadUnlockedLevel } from './game/maps';
import {
  DEFAULT_CHARACTER,
  type CharacterConfig,
  type HudSnapshot,
  type ThemeMode,
  type WeaponId,
} from './game/types';
import { TitleOverlay } from './components/TitleOverlay';
import { IntroOverlay } from './components/IntroOverlay';
import { CustomizerDrawer } from './components/CustomizerDrawer';
import { GameHud } from './components/GameHud';
import { GameModal } from './components/GameModal';
import { RotatePrompt } from './components/RotatePrompt';

const CHAR_STORAGE_KEY = 'tawuran_char_config_v1';

const INITIAL_HUD: HudSnapshot = {
  state: 'title',
  introBeat: 0,
  introTotalBeats: 4,
  hp: 100,
  maxHp: 100,
  ghostHp: 100,
  stamina: 100,
  maxStamina: 100,
  ammoPetasan: 5,
  maxPetasan: 5,
  petasanCooldown: 0,
  activeWeapon: DEFAULT_CHARACTER.primaryWeapon,
  activeThrowable: DEFAULT_CHARACTER.throwable,
  girLengthMeters: DEFAULT_CHARACTER.girLengthMeters,
  wave: 1,
  maxWaves: 3,
  alliesAlive: 2,
  alliesTotal: 2,
  score: 0,
  bestScore: 0,
  combo: 0,
  comboTimer: 0,
  enemiesAlive: 0,
  enemiesTotalInWave: 0,
  defeatedCount: 0,
  maxCombo: 0,
  damageTaken: 0,
  isVictory: false,
  hitFeedbackLabel: '',
  isBlocking: false,
  parryFlashTimer: 0,
  waveBannerText: '',
  level: 1,
  mapName: LEVELS[0].nama,
  maxLevel: MAX_LEVEL,
  unlockedLevel: 1,
};

function loadSavedCharacter(): CharacterConfig {
  try {
    const raw = localStorage.getItem(CHAR_STORAGE_KEY);
    if (!raw) return DEFAULT_CHARACTER;
    const merged = { ...DEFAULT_CHARACTER, ...JSON.parse(raw) };
    return {
      ...merged,
      girLengthMeters: clampGirLength(merged.girLengthMeters),
    };
  } catch {
    return DEFAULT_CHARACTER;
  }
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BrawlEngine | null>(null);

  const [charConfig, setCharConfig] = useState<CharacterConfig>(loadSavedCharacter);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [muted, setMuted] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [unlockedLevel, setUnlockedLevel] = useState(loadUnlockedLevel);
  useEffect(() => {
    if (hud.unlockedLevel > unlockedLevel) setUnlockedLevel(hud.unlockedLevel);
  }, [hud.unlockedLevel, unlockedLevel]);

  // Detect narrow portrait orientation to offer landscape rotation guidance
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortraitMobile(window.innerWidth < 768 && window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Mount Three.js engine once; React HUD updates never tear down the canvas
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    const engine = new BrawlEngine(
      el,
      charConfig,
      (snap) => setHud(snap),
      autostart,
    );
    engineRef.current = engine;
    setUnlockedLevel(engine.getUnlockedLevel());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleActivateLandscape = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen denial inside embedded preview iframes
    }
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (type: string) => Promise<void>;
      };
      await orientation?.lock?.('landscape');
    } catch {
      // Orientation lock requires fullscreen/PWA on supported browsers
    }
  }, []);

  const handleSelectLevel = useCallback((id: number) => {
    setSelectedLevel(id);
    engineRef.current?.setLevel(id);
    setUnlockedLevel(engineRef.current?.getUnlockedLevel() ?? unlockedLevel);
  }, [unlockedLevel]);

  const handleStartWithIntro = useCallback(() => {
    setCustomizerOpen(false);
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      void handleActivateLandscape();
    }
    engineRef.current?.startIntro();
  }, [handleActivateLandscape]);

  const handleRestartDirect = useCallback(() => {
    setCustomizerOpen(false);
    engineRef.current?.startGame();
  }, []);

  const handleConfigChange = useCallback((next: CharacterConfig) => {
    setCharConfig(next);
    try {
      localStorage.setItem(CHAR_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
    engineRef.current?.updateCharacterConfig(next);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSelectWeapon = useCallback((w: WeaponId) => {
    engineRef.current?.switchWeapon(w);
  }, []);

  const handleChangeGirLength = useCallback((meters: number) => {
    const clamped = clampGirLength(meters);
    setCharConfig((prev) => {
      const next = { ...prev, girLengthMeters: clamped };
      try {
        localStorage.setItem(CHAR_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
    engineRef.current?.setGirLength(clamped);
  }, []);

  // Enter / Space title start handshake & M mute shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'KeyM' && !e.repeat) {
        handleToggleMute();
      } else if (
        hud.state === 'title' &&
        !customizerOpen &&
        !e.repeat &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        handleStartWithIntro();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.state, customizerOpen, handleStartWithIntro, handleToggleMute]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-zinc-950">
      {/* Isolated WebGL canvas mount container */}
      <div ref={mountRef} className="fixed inset-0 z-0" />

      {isPortraitMobile && !portraitDismissed && (
        <RotatePrompt
          onActivateLandscape={handleActivateLandscape}
          onDismiss={() => setPortraitDismissed(true)}
        />
      )}

      {hud.state === 'title' && !customizerOpen && (
        <TitleOverlay
          config={charConfig}
          bestScore={hud.bestScore}
          levels={LEVELS}
          selectedLevel={selectedLevel}
          unlockedLevel={unlockedLevel > hud.unlockedLevel ? unlockedLevel : hud.unlockedLevel}
          onSelectLevel={handleSelectLevel}
          theme={theme}
          muted={muted}
          onStart={handleStartWithIntro}
          onOpenCustomizer={() => setCustomizerOpen(true)}
          onToggleTheme={handleToggleTheme}
          onToggleMute={handleToggleMute}
          onActivateLandscape={handleActivateLandscape}
        />
      )}

      {hud.state === 'intro' && !customizerOpen && (
        <IntroOverlay
          config={charConfig}
          beat={hud.introBeat}
          totalBeats={hud.introTotalBeats}
          theme={theme}
          muted={muted}
          onAdvance={() => engineRef.current?.advanceIntroBeat()}
          onSkip={() => engineRef.current?.skipIntro()}
          onToggleMute={handleToggleMute}
        />
      )}

      {customizerOpen && (
        <CustomizerDrawer
          config={charConfig}
          theme={theme}
          onChange={handleConfigChange}
          onBack={() => setCustomizerOpen(false)}
          onStart={handleStartWithIntro}
        />
      )}

      {hud.state === 'playing' && (
        <GameHud
          hud={hud}
          playerName={charConfig.name}
          theme={theme}
          muted={muted}
          onSelectWeapon={handleSelectWeapon}
          onChangeGirLength={handleChangeGirLength}
          onThrowPetasan={() => engineRef.current?.triggerThrowPetasan()}
          onPause={() => engineRef.current?.pauseGame()}
          onToggleMute={handleToggleMute}
          onToggleTheme={handleToggleTheme}
          onActivateLandscape={handleActivateLandscape}
          onTouchMove={(dx, dy) => engineRef.current?.setTouchMove(dx, dy)}
          onTouchAttack={() => engineRef.current?.triggerAttack()}
          onTouchBlock={(active) => engineRef.current?.setTouchBlock(active)}
          onTouchDodge={() => engineRef.current?.triggerDodge()}
        />
      )}

      <GameModal
        hud={hud}
        theme={theme}
        onResume={() => engineRef.current?.resumeGame()}
        onRestart={handleRestartDirect}
        onCustomize={() => {
          engineRef.current?.returnToTitle();
          setCustomizerOpen(true);
        }}
        onReturnTitle={() => {
          setCustomizerOpen(false);
          engineRef.current?.returnToTitle();
        }}
      />
    </main>
  );
}
