/**
 * engine.ts — MESIN GAME (PLACEHOLDER)
 *
 * ⚠️ INI BUKAN MESIN GAME ASLI.
 * `src/game/engine.ts` dari proyek AI Studio belum diunggah, jadi file ini
 * adalah pengganti sementara yang:
 *   1. memenuhi seluruh API `BrawlEngine` yang dipakai `App.tsx`, dan
 *   2. menampilkan scene jalanan 3D sederhana (aspal + dinding beton dari
 *      `public/textures/`) dengan karakter yang bisa digerakkan.
 *
 * Tidak ada pertarungan, musuh, atau damage di sini — hanya alur
 * title → intro → bermain (gerak dasar) supaya APK bisa dipasang, UI asli
 * (TitleOverlay, CustomizerDrawer, GameHud, GameModal) bisa dicoba di HP,
 * dan pipeline build tervalidasi ujung ke ujung.
 *
 * Begitu `engine.ts` asli diunggah, timpa file ini — tidak ada kode lain
 * yang perlu diubah.
 */

import * as THREE from 'three';
import {
  DEFAULT_CHARACTER,
  type CharacterConfig,
  type GameState,
  type HudSnapshot,
  type ThrowableId,
  type WeaponId,
} from './types';
import { WEAPON_SPECS, clampGirLength, getEffectiveWeaponSpec } from './rules';

const INTRO_BEATS = 4;
const INTRO_BEAT_SEC = 2.2;
const WALK_SPEED = 4.2;
const RUN_SPEED = 6.4;
const WORLD_LIMIT = 22;
const HUD_INTERVAL_MS = 100;

type TouchMoveHandler = (dx: number, dy: number) => void;

export class BrawlEngine {
  private container: HTMLElement;
  private config: CharacterConfig;
  private onHud: (snap: HudSnapshot) => void;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private player: THREE.Group | null = null;
  private limbs: { legL?: THREE.Object3D; legR?: THREE.Object3D; armR?: THREE.Object3D } = {};
  private weaponMesh: THREE.Object3D | null = null;
  private hudLabel: HTMLDivElement | null = null;

  private rafId = 0;
  private clock = new THREE.Clock();
  private disposed = false;
  private failed = false;

  private keys = new Set<string>();
  private touchMove: { x: number; y: number } = { x: 0, y: 0 };
  private facing = 0;
  private velocity = new THREE.Vector3();
  private walkPhase = 0;
  private swingT = 0;
  private dodgeT = 0;
  private blocking = false;
  private muted = false;

  private introTimer = 0;
  private lastHudAt = 0;

  private hud: HudSnapshot = this.createInitialHud();

  constructor(
    container: HTMLElement,
    config: CharacterConfig,
    onHud: (snap: HudSnapshot) => void,
    autostart = false,
  ) {
    this.container = container;
    this.config = { ...DEFAULT_CHARACTER, ...config };
    this.onHud = onHud;

    try {
      this.setup();
    } catch (err) {
      this.failed = true;
      console.warn('[BrawlEngine] WebGL tidak tersedia, UI tetap jalan:', err);
    }

    if (autostart && !this.failed) this.startIntro();
    this.emitHud(true);
  }

  // ============================================================
  // SETUP
  // ============================================================

  private setup() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101014');
    scene.fog = new THREE.Fog('#101014', 26, 58);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      200,
    );
    camera.position.set(0, 4.4, 8);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    this.renderer = renderer;
    this.container.appendChild(renderer.domElement);

    this.buildLights();
    this.buildStreet();
    this.buildPlayer();
    this.buildBadge();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);

    this.clock.start();
    this.loop();
  }

  private buildLights() {
    const scene = this.scene!;
    scene.add(new THREE.HemisphereLight('#8ea6c8', '#2a2118', 0.85));

    const sun = new THREE.DirectionalLight('#ffb27a', 1.5);
    sun.position.set(-14, 16, -8);
    scene.add(sun);

    const rim = new THREE.DirectionalLight('#5b8ee0', 0.35);
    rim.position.set(10, 6, 12);
    scene.add(rim);
  }

  private loadTexture(file: string, repeatX: number, repeatY: number): THREE.Texture | null {
    try {
      const tex = new THREE.TextureLoader().load(
        file,
        undefined,
        undefined,
        () => {
          /* tekstur gagal dimuat → material warna tetap dipakai */
        },
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.anisotropy = 2;
      return tex;
    } catch {
      return null;
    }
  }

  private buildStreet() {
    const scene = this.scene!;

    const asphalt = this.loadTexture('textures/asphalt-street.jpg', 10, 10);
    const groundMat = new THREE.MeshStandardMaterial({
      color: asphalt ? '#ffffff' : '#2a2a2e',
      map: asphalt ?? undefined,
      roughness: 0.95,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Dinding beton di dua sisi jalan
    const concrete = this.loadTexture('textures/concrete-wall.jpg', 6, 2);
    const wallMat = new THREE.MeshStandardMaterial({
      color: concrete ? '#ffffff' : '#6b6b6b',
      map: concrete ?? undefined,
      roughness: 0.9,
      metalness: 0.02,
    });

    const wallGeo = new THREE.BoxGeometry(1.2, 5, 44);
    for (const x of [-11, 11]) {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, 2.5, 0);
      scene.add(wall);
    }

    // Blok bangunan di belakang dinding, variasi warna senja
    const tones = ['#1e222a', '#262b35', '#2c333f'];
    for (let i = 0; i < 8; i++) {
      const h = 4 + ((i * 7) % 9);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(7, h, 7),
        new THREE.MeshStandardMaterial({
          color: tones[i % tones.length],
          roughness: 0.95,
        }),
      );
      mesh.position.set(i % 2 === 0 ? -19 : 19, h / 2, -20 + i * 6);
      scene.add(mesh);
    }

    // Tiang lampu jalan sebagai penanda ruang
    const poleMat = new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 0.7, metalness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({
      color: '#ffd7a3',
      emissive: '#ffb166',
      emissiveIntensity: 1.4,
      roughness: 0.4,
    });
    for (let i = -1; i <= 1; i++) {
      for (const x of [-8.5, 8.5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5.2, 8), poleMat);
        pole.position.set(x, 2.6, i * 13);
        scene.add(pole);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lampMat);
        lamp.position.set(x, 5.2, i * 13);
        scene.add(lamp);
      }
    }

    // Garis jalan putus-putus
    const lineMat = new THREE.MeshStandardMaterial({ color: '#5c5a52', roughness: 1 });
    for (let i = -4; i <= 4; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 2.2), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.012, i * 5);
      scene.add(line);
    }
  }

  private buildPlayer() {
    if (!this.scene) return;
    if (this.player) {
      this.scene.remove(this.player);
      this.player = null;
    }

    const cfg = this.config;
    const group = new THREE.Group();

    const jacket = new THREE.MeshStandardMaterial({ color: cfg.jacketColor, roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({
      color: cfg.pants === 'jeans_sobek' ? '#2b3444' : cfg.pants === 'hitam_bahan' ? '#1b1b1f' : '#7d7f84',
      roughness: 0.9,
    });
    const skin = new THREE.MeshStandardMaterial({ color: cfg.skinTone, roughness: 0.75 });
    const shoe = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.85 });

    // Badan
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), jacket);
    torso.position.y = 1.28;
    group.add(torso);

    // Kepala
    if (cfg.headgear === 'helm_proyek') {
      const helm = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#d6a12a', roughness: 0.6 }),
      );
      helm.position.y = 1.84;
      group.add(helm);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), skin);
    head.position.y = 1.78;
    group.add(head);

    if (cfg.headgear === 'topi_sekolah') {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.07, 14),
        new THREE.MeshStandardMaterial({ color: '#3b4a6b', roughness: 0.7 }),
      );
      cap.position.y = 1.92;
      group.add(cap);
    }
    if (cfg.headgear === 'slayer_wajah') {
      const slayer = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.2, 0.1),
        new THREE.MeshStandardMaterial({ color: cfg.slayerColor, roughness: 0.85 }),
      );
      slayer.position.set(0, 1.72, 0.16);
      group.add(slayer);
    }

    // Lengan (kanan memegang senjata)
    const armGeo = new THREE.BoxGeometry(0.15, 0.62, 0.16);
    const armL = new THREE.Mesh(armGeo, jacket);
    armL.position.set(-0.39, 1.42, 0);
    group.add(armL);

    const armPivot = new THREE.Group();
    armPivot.position.set(0.39, 1.6, 0);
    const armR = new THREE.Mesh(armGeo, jacket);
    armR.position.y = -0.28;
    armPivot.add(armR);
    group.add(armPivot);

    // Senjata di tangan kanan
    const weapon = this.buildWeapon(cfg.primaryWeapon);
    weapon.position.set(0, -0.5, 0.12);
    armPivot.add(weapon);
    this.weaponMesh = weapon;

    // Kaki
    const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
    const legL = new THREE.Mesh(legGeo, pants);
    legL.position.set(-0.16, 0.53, 0);
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, pants);
    legR.position.set(0.16, 0.53, 0);
    group.add(legR);

    const shoeGeo = new THREE.BoxGeometry(0.22, 0.1, 0.32);
    const shoeL = new THREE.Mesh(shoeGeo, shoe);
    shoeL.position.set(-0.16, 0.06, 0.04);
    group.add(shoeL);
    const shoeR = new THREE.Mesh(shoeGeo, shoe);
    shoeR.position.set(0.16, 0.06, 0.04);
    group.add(shoeR);

    this.limbs = { legL, legR, armR: armPivot };
    group.position.set(0, 0, 3);
    this.player = group;
    this.scene.add(group);
  }

  private buildWeapon(weapon: WeaponId): THREE.Object3D {
    const spec = WEAPON_SPECS[weapon];
    const metal = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.35, metalness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: '#26282e', roughness: 0.7 });

    if (weapon === 'gir_sabuk') {
      const length = clampGirLength(this.config.girLengthMeters);
      const group = new THREE.Group();
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, length), dark);
      belt.position.z = length / 2;
      group.add(belt);
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 12), metal);
      gear.rotation.x = Math.PI / 2;
      gear.position.z = length;
      group.add(gear);
      return group;
    }

    if (weapon === 'kayu_paku') {
      const group = new THREE.Group();
      const wood = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.09, Math.max(1.2, spec.reach * 0.5)),
        new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.95 }),
      );
      wood.position.z = spec.reach * 0.25;
      group.add(wood);
      for (let i = 0; i < 3; i++) {
        const nail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), metal);
        nail.rotation.x = Math.PI / 2;
        nail.position.set(0, 0.09, 0.35 + i * 0.28);
        group.add(nail);
      }
      return group;
    }

    if (weapon === 'penggaris_baja') {
      const group = new THREE.Group();
      const ruler = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.09, Math.max(0.9, spec.reach * 0.45)),
        metal,
      );
      ruler.position.z = spec.reach * 0.22;
      group.add(ruler);
      return group;
    }

    // sabit_modif
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.7), dark);
    handle.position.z = 0.35;
    group.add(handle);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 4), metal);
    blade.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    blade.position.set(0.06, 0.04, 0.74);
    group.add(blade);
    return group;
  }

  /** Label kecil supaya jelas ini pratinjau, bukan game final. */
  private buildBadge() {
    const el = document.createElement('div');
    el.textContent = 'PRATINJAU — engine asli belum diunggah (gerak dasar saja)';
    el.style.cssText = [
      'position:absolute',
      'left:12px',
      'bottom:10px',
      'z-index:1',
      'font:600 10px/1.4 ui-monospace,monospace',
      'letter-spacing:.06em',
      'color:#a1a1aa',
      'background:rgba(9,9,11,.72)',
      'border:1px solid rgba(63,63,70,.9)',
      'border-radius:6px',
      'padding:4px 8px',
      'pointer-events:none',
      'max-width:78%',
    ].join(';');
    this.container.appendChild(el);
    this.hudLabel = el;
  }

  // ============================================================
  // INPUT
  // ============================================================

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    this.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') this.triggerAttack();
    if (e.code === 'ShiftLeft' || e.code === 'KeyK') this.triggerDodge();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.touchMove.x = 0;
    this.touchMove.y = 0;
  };

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // ============================================================
  // LOOP
  // ============================================================

  private loop = () => {
    if (this.disposed || this.failed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.render();
  };

  private update(dt: number) {
    if (!this.player) return;

    if (this.hud.state === 'intro') {
      this.introTimer += dt;
      if (this.introTimer >= INTRO_BEAT_SEC) {
        this.introTimer = 0;
        this.advanceIntroBeat();
      }
    }

    const playing = this.hud.state === 'playing';
    if (!playing) {
      this.velocity.multiplyScalar(Math.max(0, 1 - dt * 8));
    } else {
      let x = this.touchMove.x;
      let z = this.touchMove.y;

      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;

      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }

      const speed = this.keys.has('ShiftLeft') || this.blocking ? WALK_SPEED : RUN_SPEED;
      const target = new THREE.Vector3(x * speed, 0, z * speed * 1.15);
      this.velocity.lerp(target, Math.min(1, dt * 10));

      if (Math.hypot(x, z) > 0.02) {
        this.facing = Math.atan2(x, z) + Math.PI;
      }
    }

    const player = this.player;
    player.position.addScaledVector(this.velocity, dt);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_LIMIT, WORLD_LIMIT);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_LIMIT, WORLD_LIMIT);

    // Rotasi halus ke arah gerak
    let delta = this.facing - player.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    player.rotation.y += delta * Math.min(1, dt * 12);

    // Animasi jalan
    const speedNow = this.velocity.length();
    this.walkPhase += dt * (speedNow > 0.2 ? speedNow * 2.4 : 0);
    const swing = Math.sin(this.walkPhase) * Math.min(0.7, speedNow * 0.14);
    if (this.limbs.legL) this.limbs.legL.rotation.x = swing;
    if (this.limbs.legR) this.limbs.legR.rotation.x = -swing;
    player.position.y = speedNow > 0.2 ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.045 : 0;

    // Animasi ayunan senjata
    if (this.swingT > 0) {
      this.swingT = Math.max(0, this.swingT - dt);
      const t = 1 - this.swingT / 0.42;
      const angle = Math.sin(Math.min(1, t) * Math.PI) * -2.1;
      if (this.limbs.armR) this.limbs.armR.rotation.x = angle;
    } else if (this.limbs.armR) {
      this.limbs.armR.rotation.x += (0 - this.limbs.armR.rotation.x) * Math.min(1, dt * 10);
    }

    // Animasi mengelak (dorongan singkat ke belakang)
    if (this.dodgeT > 0) {
      this.dodgeT = Math.max(0, this.dodgeT - dt);
      player.position.addScaledVector(this.velocity.clone().normalize(), -dt * 6);
    }

    this.updateCamera(dt);
    this.emitHud(false);
  }

  private updateCamera(dt: number) {
    if (!this.camera || !this.player) return;
    const p = this.player.position;
    const desired = new THREE.Vector3(p.x * 0.55, 4.6, p.z + 7.4);
    this.camera.position.lerp(desired, Math.min(1, dt * 3));
    this.camera.lookAt(p.x * 0.6, 1.35, p.z);
  }

  private render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  // ============================================================
  // HUD
  // ============================================================

  private createInitialHud(): HudSnapshot {
    const cfg = this.config ?? DEFAULT_CHARACTER;
    return {
      state: 'title',
      introBeat: 0,
      introTotalBeats: INTRO_BEATS,
      hp: 100,
      maxHp: 100,
      ghostHp: 100,
      stamina: 100,
      maxStamina: 100,
      ammoPetasan: 5,
      maxPetasan: 5,
      petasanCooldown: 0,
      activeWeapon: cfg.primaryWeapon,
      activeThrowable: cfg.throwable,
      girLengthMeters: clampGirLength(cfg.girLengthMeters),
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
    };
  }

  private setState(state: GameState) {
    this.hud = { ...this.hud, state };
    this.introTimer = 0;
    this.emitHud(true);
  }

  private emitHud(force: boolean) {
    if (this.disposed) return;
    const now = performance.now();
    if (!force && now - this.lastHudAt < HUD_INTERVAL_MS) return;
    this.lastHudAt = now;
    try {
      this.onHud({ ...this.hud });
    } catch {
      /* abaikan error render React */
    }
  }

  // ============================================================
  // API PUBLIK (dipakai App.tsx)
  // ============================================================

  startIntro() {
    this.hud = { ...this.hud, introBeat: 0, introTotalBeats: INTRO_BEATS };
    this.setState('intro');
  }

  advanceIntroBeat() {
    const next = this.hud.introBeat + 1;
    if (next >= INTRO_BEATS) {
      this.startGame();
      return;
    }
    this.hud = { ...this.hud, introBeat: next };
    this.emitHud(true);
  }

  skipIntro() {
    this.startGame();
  }

  startGame() {
    this.touchMove = { x: 0, y: 0 };
    this.hud = {
      ...this.hud,
      state: 'playing',
      wave: 1,
      waveBannerText: '',
      score: 0,
      combo: 0,
      defeatedCount: 0,
      damageTaken: 0,
      isVictory: false,
    };
    this.emitHud(true);
  }

  pauseGame() {
    if (this.hud.state !== 'playing') return;
    this.setState('paused');
  }

  resumeGame() {
    if (this.hud.state !== 'paused') return;
    this.setState('playing');
  }

  returnToTitle() {
    this.keys.clear();
    this.touchMove = { x: 0, y: 0 };
    this.velocity.set(0, 0, 0);
    if (this.player) this.player.position.set(0, 0, 3);
    this.setState('title');
  }

  updateCharacterConfig(config: CharacterConfig) {
    this.config = { ...this.config, ...config };
    this.hud = {
      ...this.hud,
      activeWeapon: this.config.primaryWeapon,
      activeThrowable: this.config.throwable,
      girLengthMeters: clampGirLength(this.config.girLengthMeters),
    };
    this.buildPlayer();
    this.emitHud(true);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  switchWeapon(weapon: WeaponId) {
    this.config = { ...this.config, primaryWeapon: weapon };
    this.hud = { ...this.hud, activeWeapon: weapon };
    this.buildPlayer();
    this.emitHud(true);
  }

  setGirLength(meters: number) {
    const length = clampGirLength(meters);
    this.config = { ...this.config, girLengthMeters: length };
    this.hud = { ...this.hud, girLengthMeters: length };
    if (this.config.primaryWeapon === 'gir_sabuk') this.buildPlayer();
    this.emitHud(true);
  }

  triggerAttack() {
    if (this.hud.state !== 'playing') return;
    const spec = getEffectiveWeaponSpec(this.config.primaryWeapon, this.config.girLengthMeters);
    this.swingT = Math.max(0.42, spec.windupSec + spec.activeSec + spec.recoverySec);
  }

  triggerDodge() {
    if (this.hud.state !== 'playing') return;
    this.dodgeT = 0.16;
  }

  triggerThrowPetasan() {
    if (this.hud.state !== 'playing') return;
    if (this.hud.ammoPetasan <= 0 || this.hud.petasanCooldown > 0) return;
    this.hud = {
      ...this.hud,
      ammoPetasan: this.hud.ammoPetasan - 1,
      petasanCooldown: 0.8,
      activeThrowable: this.config.throwable as ThrowableId,
    };
    this.emitHud(true);
  }

  setTouchMove(dx: number, dy: number) {
    this.touchMove = {
      x: THREE.MathUtils.clamp(dx, -1, 1),
      y: THREE.MathUtils.clamp(dy, -1, 1),
    };
  }

  setTouchBlock(active: boolean) {
    this.blocking = active;
    this.hud = { ...this.hud, isBlocking: active };
    this.emitHud(true);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);

    try {
      if (this.renderer) {
        this.renderer.dispose();
        if (this.renderer.domElement.parentElement) {
          this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
      }
    } catch {
      /* abaikan */
    }

    if (this.hudLabel?.parentElement) {
      this.hudLabel.parentElement.removeChild(this.hudLabel);
    }

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.player = null;
  }
}

// Dipakai untuk tipe callback di App.tsx (tidak wajib, hanya kenyamanan).
export type { TouchMoveHandler };
