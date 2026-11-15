import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import { buildStreetEnvironment } from './environment';
import {
  MAX_LEVEL,
  clampLevelId,
  getLevel,
  loadUnlockedLevel,
  saveUnlockedLevel,
  unlockNextLevel,
  buildWaveConfig,
  type LevelConfig,
} from './maps';
import { FlexibleGirVisual } from './flexibleGir';
import { buildFighterRig, buildPetasanMesh, buildWeaponMesh, type FighterRig } from './models';
import { buildGlbFighterRig, loadBaseCharacterScene } from './glbCharacter';
import {
  ALLY_SQUAD_SPECS,
  ARENA_BOUNDS,
  THROWABLE_SPECS,
  WEAPON_ORDER,
  WEAPON_SPECS,
  clampGirLength,
  computeExplosionDamage,
  computeMeleeHit,
  computeWaveConfig,
  evaluateAttackTokenPool,
  getEffectiveWeaponSpec,
  normalizeAngleDiff,
  resolveActorPosition,
} from './rules';
import {
  MABAR_STATE_INTERVAL,
  isPlausiblePosition,
  jacketColorForHue,
  lerpAngle,
  type MabarMessage,
  type MabarProfile,
} from '../net/mabar-protocol';
import type {
  CharacterConfig,
  EnemyArchetype,
  GameState,
  HudSnapshot,
  ThrowableId,
  WeaponId,
} from './types';

// Zero-GC module-level scratch math
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _whiteEmissive = new THREE.Color(0xffffff);
const _zeroColor = new THREE.Color(0x000000);

function createScorchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(12, 10, 9, 0.88)');
  grad.addColorStop(0.45, 'rgba(24, 24, 27, 0.52)');
  grad.addColorStop(0.8, 'rgba(39, 39, 42, 0.18)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface EnemyActor {
  id: string;
  archetype: EnemyArchetype;
  weapon: WeaponId;
  rig: FighterRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  alive: boolean;
  koTimer: number;
  walkPhase: number;
  staggerTimer: number;
  hitFlashTimer: number;
  throwAnimTimer: number;
  aiState: 'approach' | 'orbit' | 'kite' | 'windup' | 'active' | 'recover';
  aiTimer: number;
  hasAttackHit: boolean;
  orbitDir: number;
  petasanCooldown: number;
  girVisual: FlexibleGirVisual | null;
}

interface AllyActor {
  id: string;
  name: string;
  weapon: WeaponId;
  rig: FighterRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  alive: boolean;
  koTimer: number;
  walkPhase: number;
  staggerTimer: number;
  hitFlashTimer: number;
  aiState: 'follow' | 'engage' | 'windup' | 'active' | 'recover';
  aiTimer: number;
  hasAttackHit: boolean;
  flankOffsetX: number;
  orbitDir: number;
  targetEnemyId: string | null;
}

interface ActivePetasan {
  mesh: THREE.Group;
  ring: THREE.Mesh;
  throwableId: ThrowableId;
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  targetX: number;
  targetZ: number;
  age: number;
  maxFuse: number;
  fuseTimer: number;
  burstsLeft: number;
  burstDelay: number;
  hasBounced: boolean;
  spinX: number;
  spinZ: number;
}

interface BlastVisual {
  group: THREE.Group;
  fireball: THREE.Mesh;
  shockwave: THREE.Mesh;
  smokePuffs: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; maxScale: number }>;
  scorch: THREE.Mesh | null;
  age: number;
  duration: number;
  blastRadius: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravity: number;
}

const MAX_PARTICLES = 180;
const BEST_SCORE_STORAGE_KEY = 'tawuran_best_score_v1';

export class BrawlEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private sound = new SoundEngine();

  private frameId = 0;
  private lastTime = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  private levelId = 1;
  private level: LevelConfig = getLevel(1);
  private unlockedLevel = loadUnlockedLevel();
  private envGroup: THREE.Group | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;

  private onHudUpdate: (snap: HudSnapshot) => void;
  private hudSyncTimer = 0;

  // Game state
  private gameState: GameState = 'title';
  private charConfig: CharacterConfig;
  private playerRig: FighterRig;
  private playerX = 0;
  private playerZ = 6;
  private playerVx = 0;
  private playerVz = 0;
  private playerYaw = Math.PI; // Facing -Z down the street
  private playerWalkPhase = 0;
  private playerHp = 100;
  private playerMaxHp = 100;
  private playerGhostHp = 100;
  private playerStamina = 100;
  private playerMaxStamina = 100;
  private playerHitFlash = 0;
  private playerStagger = 0;
  private playerScaleX = 1;
  private playerScaleY = 1;

  // Combat & Action state
  private activeWeapon: WeaponId = 'sabit_modif';
  private activeThrowable: ThrowableId = 'petasan_banting';
  private attackPhase: 'idle' | 'windup' | 'active' | 'recovery' = 'idle';
  private attackTimer = 0;
  private hitTargetsThisSwing = new Set<string>();
  private attackBuffered = false;
  private attackBufferTimer = 0;

  private isBlocking = false;
  private parryWindowTimer = 0;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private dodgeDirX = 0;
  private dodgeDirZ = -1;

  private ammoPetasan = 5;
  private maxPetasan = 5;
  private petasanCooldown = 0;
  private petasanRechargeTimer = 0;
  private playerThrowTimer = 0;
  private playerThrowPending = false;
  private playerThrowTargetX = 0;
  private playerThrowTargetZ = 0;
  private heldPetasanMesh: THREE.Group;
  private playerGirVisual: FlexibleGirVisual;
  private simTime = 0;

  // Wave & Score
  private wave = 1;
  private maxWaves = 3;
  private score = 0;
  private bestScore = 0;
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private defeatedCount = 0;
  private damageTaken = 0;
  private isVictory = false;
  private enemiesTotalInWave = 0;
  private hitFeedbackLabel = '';
  private hitFeedbackTimer = 0;
  private waveBannerText = '';
  private waveBannerTimer = 0;
  private waveTransitionTimer = 0;
  private gameOverDelayTimer = 0;

  // Juice
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private titleTurntableAngle = 0.25;
  private camPos = new THREE.Vector3(0, 5.2, 13.5);
  private camLook = new THREE.Vector3(0, 1.2, 2);

  // Opening story cutscene state
  private introTimer = 0;
  private introBeat = 0;
  private introStartedAt = 0;
  private introPetasanThrown = false;
  private introActors: FighterRig[] = [];
  private introActorMeta: Array<{ x: number; z: number; yaw: number; phase: number }> = [];
  private introAllies: FighterRig[] = [];
  private introAllyMeta: Array<{ x: number; z: number; flankOffsetX: number; phase: number }> = [];

  // Actors & Projectiles & Blasts
  private allies: AllyActor[] = [];
  private enemies: EnemyActor[] = [];
  private petasans: ActivePetasan[] = [];
  private blasts: BlastVisual[] = [];
  private blastSphereGeo = new THREE.SphereGeometry(1, 14, 10);
  private blastRingGeo = new THREE.RingGeometry(0.68, 1.0, 32);
  private scorchGeo = new THREE.CircleGeometry(1, 24);
  private scorchTex = createScorchTexture();
  private activeBlastLight: THREE.PointLight;
  private blastLightTimer = 0;

  // Pooled particles
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private particleCursor = 0;

  // Input state
  private keysHeld = new Set<string>();
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchBlocking = false;

  // Environment disposables
  private envDisposables: Array<{ dispose: () => void }> = [];

  // --- MABAR ONLINE (duel 1 lawan 1) ---
  /** Model pemain: rig prosedural bawaan atau karakter GLB modular. */
  private characterModel: 'prosedural' | 'glb' = 'prosedural';
  private glbScene: THREE.Object3D | null = null;

  private netMode = false;
  private netRole: 'host' | 'guest' = 'host';
  private netPeerName = '';
  private remoteRig: FighterRig | null = null;
  private remoteGirVisual: FlexibleGirVisual | null = null;
  private remoteWeapon: WeaponId = 'sabit_modif';
  private remoteGirLength = 3.5;
  private remoteX = 0;
  private remoteZ = -3;
  private remoteYaw = 0;
  private remoteTargetX = 0;
  private remoteTargetZ = -3;
  private remoteTargetYaw = 0;
  private remoteSpeed = 0;
  private remoteWalkPhase = 0;
  private remoteMaxHp = 100;
  private remoteHp = 100;
  private remoteAttackPhase: 'idle' | 'windup' | 'active' | 'recovery' = 'idle';
  private remoteAttackTimer = 0;
  private remoteBlocking = false;
  private remoteHitFlash = 0;
  private lastRemoteStateAt = 0;
  private netSendTimer = 0;
  private netKoAnnounced = false;
  private netSelfKoAnnounced = false;
  /** Pengirim pesan ke lawan; di-set oleh App saat sesi mabar aktif. */
  public onNetSend: ((msg: MabarMessage) => void) | null = null;

  constructor(
    container: HTMLElement,
    initialConfig: CharacterConfig,
    onHudUpdate: (snap: HudSnapshot) => void,
    autostart = false,
  ) {
    this.container = container;
    this.charConfig = { ...initialConfig };
    this.activeWeapon = initialConfig.primaryWeapon;
    this.activeThrowable = initialConfig.throwable;
    this.onHudUpdate = onHudUpdate;

    try {
      const saved = localStorage.getItem(BEST_SCORE_STORAGE_KEY);
      if (saved) this.bestScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      // Ignore storage errors
    }

    // 1. Software WebGL detection
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'brawl-canvas');
    container.appendChild(this.renderer.domElement);

    // 3. Scene, Sunset Dusk Sky & Horizon Fog
    this.scene = new THREE.Scene();
    const skyHorizonColor = new THREE.Color(0x281c24);
    this.scene.background = skyHorizonColor;
    this.scene.fog = new THREE.FogExp2(0x281c24, 0.019);

    // Studio RoomEnvironment for crisp PBR metallic reflections on blades & gears
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Camera
    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.2, 160);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // 5. Warm Sunset Key Light + Cool Dusk Hemisphere Fill
    const hemi = new THREE.HemisphereLight(0x8fa8d6, 0x3b2c22, 0.85);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const sunKey = new THREE.DirectionalLight(0xffb36b, 2.2);
    sunKey.position.set(-18, 22, 14);
    sunKey.castShadow = !this.isSoftwareGl;
    sunKey.shadow.mapSize.set(1024, 1024);
    sunKey.shadow.camera.near = 2;
    sunKey.shadow.camera.far = 65;
    sunKey.shadow.camera.left = -18;
    sunKey.shadow.camera.right = 18;
    sunKey.shadow.camera.top = 24;
    sunKey.shadow.camera.bottom = -24;
    sunKey.shadow.bias = -0.0005;
    sunKey.shadow.normalBias = 0.02;
    this.scene.add(sunKey);
    this.sunLight = sunKey;

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rimLight.position.set(14, 10, -20);
    this.scene.add(rimLight);
    this.rimLight = rimLight;

    this.activeBlastLight = new THREE.PointLight(0xff7b29, 0, 14, 1.5);
    this.scene.add(this.activeBlastLight);

    // 6. Street Environment (mengikuti map/level terpilih)
    this.buildEnvironmentForLevel();

    // 7. Pooled Particle InstancedMesh
    const pGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xffffff),
        gravity: 10,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _whiteEmissive);
    }

    // 8. Build Player Rig + Left-hand throwable petasan prop
    this.playerRig = buildFighterRig(this.charConfig, false);
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.playerRig.root);

    this.heldPetasanMesh = buildPetasanMesh(this.activeThrowable === 'petasan_roman');
    this.heldPetasanMesh.position.set(0, -0.26, 0.03);
    this.heldPetasanMesh.visible = false;
    this.playerRig.leftElbow.add(this.heldPetasanMesh);

    this.charConfig.girLengthMeters = clampGirLength(this.charConfig.girLengthMeters);
    this.playerGirVisual = new FlexibleGirVisual(this.scene);
    this.playerRig.root.updateMatrixWorld(true);
    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerRig.girAnchor.getWorldPosition(_v3);
      this.playerGirVisual.snapToAnchor(
        _v3,
        this.playerYaw,
        this.charConfig.girLengthMeters,
        this.gameState === 'title',
      );
    } else {
      this.playerGirVisual.setVisible(false);
    }

    // Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();

    if (autostart) {
      this.startGame();
    } else {
      this.setBodyState('title');
      this.emitHud();
    }

    this.lastTime = performance.now();
    this.scheduleNextFrame();
  }

  private setBodyState(state: GameState): void {
    this.gameState = state;
    document.body.dataset.state = state;
  }

  public updateCharacterConfig(next: CharacterConfig): void {
    const weaponChanged = next.primaryWeapon !== this.charConfig.primaryWeapon;
    this.charConfig = {
      ...next,
      girLengthMeters: clampGirLength(next.girLengthMeters),
    };
    if (weaponChanged) {
      this.activeWeapon = next.primaryWeapon;
    }
    this.activeThrowable = next.throwable;

    // Rebuild player rig live so customization previews immediately in 3D
    this.replacePlayerRig();
    this.emitHud();
  }

  /** Buat rig pemain sesuai model terpilih (GLB kalau tersedia, kalau tidak prosedural). */
  private createPlayerRig(): FighterRig {
    if (this.characterModel === 'glb' && this.glbScene) {
      const glbRig = buildGlbFighterRig(this.glbScene, this.activeWeapon, {
        castShadow: !this.isSoftwareGl,
      });
      if (glbRig) return glbRig;
      // Aset GLB rusak/tidak lengkap → jangan biarkan game tanpa karakter.
      this.characterModel = 'prosedural';
    }
    return buildFighterRig({ ...this.charConfig, primaryWeapon: this.activeWeapon }, false);
  }

  /** Ganti rig pemain di tempat (dipakai kustomisasi & ganti model). */
  private replacePlayerRig(): void {
    this.scene.remove(this.playerRig.root);
    this.playerRig = this.createPlayerRig();
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.playerRig.root);

    this.heldPetasanMesh = buildPetasanMesh(this.activeThrowable === 'petasan_roman');
    this.heldPetasanMesh.position.set(0, -0.26, 0.03);
    this.heldPetasanMesh.visible = false;
    this.playerRig.leftElbow.add(this.heldPetasanMesh);

    this.resetRigPose(this.playerRig);
    this.playerRig.root.updateMatrixWorld(true);
    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerGirVisual.setVisible(true);
      this.playerRig.girAnchor.getWorldPosition(_v3);
      this.playerGirVisual.snapToAnchor(
        _v3,
        this.playerYaw,
        this.charConfig.girLengthMeters,
        this.gameState === 'title',
      );
    } else {
      this.playerGirVisual.setVisible(false);
    }
  }

  /**
   * Pilih model karakter: 'prosedural' (bawaan) atau 'glb' (karakter modular).
   * Mengembalikan false kalau GLB gagal dimuat (game tetap pakai prosedural).
   */
  public async setCharacterModel(mode: 'prosedural' | 'glb'): Promise<boolean> {
    if (mode === 'glb') {
      if (!this.glbScene) this.glbScene = await loadBaseCharacterScene();
      if (this.disposed) return false;
      if (!this.glbScene) {
        this.characterModel = 'prosedural';
        this.replacePlayerRig();
        return false;
      }
      this.characterModel = 'glb';
    } else {
      this.characterModel = 'prosedural';
    }
    this.replacePlayerRig();
    return true;
  }

  public getCharacterModel(): 'prosedural' | 'glb' {
    return this.characterModel;
  }

  public setGirLength(meters: number): void {
    this.charConfig.girLengthMeters = clampGirLength(meters);
    this.emitHud();
  }

  public switchWeapon(weaponId: WeaponId): void {
    if (this.activeWeapon === weaponId) return;
    this.activeWeapon = weaponId;
    this.charConfig.primaryWeapon = weaponId;
    if (this.playerRig.weaponMount) {
      while (this.playerRig.weaponMount.children.length > 0) {
        this.playerRig.weaponMount.remove(this.playerRig.weaponMount.children[0]);
      }
      const nextMesh = buildWeaponMesh(weaponId);
      this.playerRig.weaponGroup = nextMesh;
      this.playerRig.girAnchor = nextMesh.getObjectByName('gir_anchor') ?? null;
      this.playerRig.weaponMount.add(nextMesh);
    }
    this.playerRig.root.updateMatrixWorld(true);
    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerGirVisual.setVisible(true);
      this.playerRig.girAnchor.getWorldPosition(_v3);
      this.playerGirVisual.snapToAnchor(
        _v3,
        this.playerYaw,
        this.charConfig.girLengthMeters,
        this.gameState === 'title',
      );
    } else {
      this.playerGirVisual.setVisible(false);
    }
    this.emitHud();
  }

  private resetRigPose(rig: FighterRig): void {
    rig.root.rotation.set(0, 0, 0);
    rig.root.scale.set(1, 1, 1);
    rig.hips.rotation.set(0, 0, 0);
    rig.torso.rotation.set(0, 0, 0);
    rig.head.rotation.set(0, 0, 0);
    rig.leftShoulder.rotation.set(0, 0, 0);
    rig.leftElbow.rotation.set(0, 0, 0);
    rig.rightShoulder.rotation.set(0, 0, 0);
    rig.rightElbow.rotation.set(0, 0, 0);
    rig.leftHip.rotation.set(0, 0, 0);
    rig.leftKnee.rotation.set(0, 0, 0);
    rig.rightHip.rotation.set(0, 0, 0);
    rig.rightKnee.rotation.set(0, 0, 0);
  }

  public startIntro(): void {
    this.sound.unlock();
    this.keysHeld.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchBlocking = false;

    this.clearEnemies();
    this.clearAllies();
    this.clearPetasans();
    this.clearIntroActors();

    this.introTimer = 0;
    this.introBeat = 0;
    this.introStartedAt = performance.now();
    this.introPetasanThrown = false;
    this.cameraTrauma = 0;
    this.hitstopTimer = 0;

    // Place customized hero near sidewalk warung casually
    this.playerX = -4.6;
    this.playerZ = 12.6;
    this.playerYaw = 0.72;
    this.playerWalkPhase = 0;
    this.playerScaleX = 1;
    this.playerScaleY = 1;
    this.resetRigPose(this.playerRig);
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.set(0, this.playerYaw, 0);
    this.playerRig.root.updateMatrixWorld(true);

    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerGirVisual.setVisible(true);
      this.playerRig.girAnchor.getWorldPosition(_v3);
      this.playerGirVisual.snapToAnchor(_v3, this.playerYaw, this.charConfig.girLengthMeters, false);
    } else {
      this.playerGirVisual.setVisible(false);
    }

    // Spawn 2 schoolmate allies flanking the hero in matching school colors
    for (let i = 0; i < ALLY_SQUAD_SPECS.length; i++) {
      const spec = ALLY_SQUAD_SPECS[i];
      const rig = buildFighterRig(
        {
          ...this.charConfig,
          outfit: spec.outfit,
          headgear: spec.headgear,
          primaryWeapon: spec.weapon,
        },
        false,
        undefined,
        true,
      );
      if (rig.hpBarGroup) rig.hpBarGroup.visible = false;
      const ax = this.playerX + spec.flankOffsetX * 0.72;
      const az = this.playerZ + 0.85 + i * 0.3;
      rig.root.position.set(ax, 0, az);
      rig.root.rotation.set(0, this.playerYaw, 0);
      this.scene.add(rig.root);
      this.introAllies.push(rig);
      this.introAllyMeta.push({
        x: ax,
        z: az,
        flankOffsetX: spec.flankOffsetX,
        phase: i * 1.4,
      });
    }

    // Spawn 3 rival school students blocking the street ahead
    const lineup: Array<{ arch: EnemyArchetype; w: WeaponId; x: number; z: number }> = [
      { arch: 'pentolan', w: 'kayu_paku', x: 0.2, z: 3.4 },
      { arch: 'rusher', w: 'sabit_modif', x: -1.7, z: 2.6 },
      { arch: 'petasan_kiter', w: 'penggaris_baja', x: 2.0, z: 2.9 },
    ];
    for (let i = 0; i < lineup.length; i++) {
      const item = lineup[i];
      const rig = buildFighterRig(
        { ...this.charConfig, primaryWeapon: item.w },
        true,
        item.arch,
      );
      if (rig.hpBarGroup) rig.hpBarGroup.visible = false;
      rig.root.position.set(item.x, 0, item.z);
      rig.root.rotation.set(0, 0, 0);
      this.scene.add(rig.root);
      this.introActors.push(rig);
      this.introActorMeta.push({ x: item.x, z: item.z, yaw: 0, phase: i * 1.3 });
    }

    this.camPos.set(-6.8, 2.2, 15.2);
    this.camLook.set(-3.4, 1.25, 11.4);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.setBodyState('intro');
    this.sound.playIntroBeat(0);
    this.emitHud();
  }

  public advanceIntroBeat(): void {
    if (this.gameState !== 'intro') return;
    this.sound.unlock();
    if (this.introBeat === 0) {
      this.introTimer = 3.85;
      this.introBeat = 1;
      this.sound.playIntroBeat(1);
      this.emitHud();
    } else if (this.introBeat === 1) {
      this.introTimer = 7.65;
      this.introBeat = 2;
      this.introPetasanThrown = false;
      this.emitHud();
    } else if (this.introBeat === 2) {
      this.introTimer = 11.25;
      this.introBeat = 3;
      this.sound.playIntroBeat(3);
      this.emitHud();
    } else {
      this.skipIntro();
    }
  }

  public skipIntro(): void {
    if (this.gameState !== 'intro') return;
    this.clearIntroActors();
    this.startGame();
  }

  private clearIntroActors(): void {
    for (const rig of this.introActors) {
      this.scene.remove(rig.root);
    }
    this.introActors = [];
    this.introActorMeta = [];

    for (const rig of this.introAllies) {
      this.scene.remove(rig.root);
    }
    this.introAllies = [];
    this.introAllyMeta = [];
  }

  public startGame(): void {
    this.beginMatchState(false, 8);
    this.spawnAllies();
    this.spawnWave(1);
    this.emitHud();
  }

  /** Mulai duel online 1v1 (tanpa gelombang musuh, tanpa teman geng). */
  public startDuel(opts: {
    role: 'host' | 'guest';
    peerName: string;
    peerProfile?: MabarProfile;
    levelId?: number;
  }): void {
    if (typeof opts.levelId === 'number') {
      this.levelId = clampLevelId(opts.levelId);
      this.level = getLevel(this.levelId);
      this.maxWaves = this.level.waveCount;
      this.buildEnvironmentForLevel();
    }
    this.netRole = opts.role;
    this.netPeerName = (opts.peerName || 'Lawan').slice(0, 18);
    this.beginMatchState(true, 7);
    this.setupRemoteFighter(opts.peerProfile);
    this.wave = 1;
    this.maxWaves = 1;
    this.waveBannerText = `MABAR ONLINE · ${this.netPeerName.toUpperCase()}`;
    this.waveBannerTimer = 3.2;
    this.sound.playWaveCue(false);
    this.emitHud();
  }

  private beginMatchState(net: boolean, spawnZ: number): void {
    if (this.netMode !== net) this.clearRemoteFighter();
    this.netMode = net;
    this.netKoAnnounced = false;
    this.netSelfKoAnnounced = false;
    this.netSendTimer = 0;

    this.sound.unlock();
    this.keysHeld.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchBlocking = false;

    this.clearEnemies();
    this.clearAllies();
    this.clearPetasans();
    this.clearIntroActors();

    this.playerX = 0;
    this.playerZ = spawnZ;
    this.playerVx = 0;
    this.playerVz = 0;
    this.playerYaw = Math.PI; // Looking up the avenue (-Z) toward incoming wave
    this.playerHp = this.playerMaxHp;
    this.playerGhostHp = this.playerMaxHp;
    this.playerStamina = this.playerMaxStamina;
    this.playerHitFlash = 0;
    this.playerStagger = 0;
    this.playerScaleX = 1;
    this.playerScaleY = 1;
    this.attackPhase = 'idle';
    this.attackTimer = 0;
    this.attackBuffered = false;
    this.isBlocking = false;
    this.parryWindowTimer = 0;
    this.dodgeTimer = 0;
    this.ammoPetasan = this.maxPetasan;
    this.petasanCooldown = 0;
    this.playerThrowTimer = 0;
    this.playerThrowPending = false;
    this.heldPetasanMesh.visible = false;

    this.resetRigPose(this.playerRig);
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.set(0, this.playerYaw, 0);
    this.playerRig.root.updateMatrixWorld(true);
    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerGirVisual.setVisible(true);
      this.playerRig.girAnchor.getWorldPosition(_v3);
      this.playerGirVisual.snapToAnchor(_v3, this.playerYaw, this.charConfig.girLengthMeters);
    } else {
      this.playerGirVisual.setVisible(false);
    }

    this.wave = 1;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.defeatedCount = 0;
    this.damageTaken = 0;
    this.isVictory = false;
    this.hitFeedbackLabel = '';
    this.hitFeedbackTimer = 0;
    this.gameOverDelayTimer = 0;
    this.waveTransitionTimer = 0;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;

    this.setBodyState('playing');
  }

  public pauseGame(): void {
    if (this.gameState !== 'playing') return;
    this.keysHeld.clear();
    this.setBodyState('paused');
    this.emitHud();
  }

  public resumeGame(): void {
    if (this.gameState !== 'paused') return;
    this.keysHeld.clear();
    this.lastTime = performance.now();
    this.setBodyState('playing');
    this.emitHud();
  }

  public returnToTitle(): void {
    this.keysHeld.clear();
    this.clearEnemies();
    this.clearAllies();
    this.clearPetasans();
    this.clearIntroActors();
    this.netMode = false;
    this.netKoAnnounced = false;
    this.netSelfKoAnnounced = false;
    this.clearRemoteFighter();
    this.playerX = 0;
    this.playerZ = 6;
    this.playerYaw = 0.2;
    this.playerScaleX = 1;
    this.playerScaleY = 1;
    this.resetRigPose(this.playerRig);
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.set(0, this.playerYaw, 0);
    this.playerRig.root.updateMatrixWorld(true);
    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerGirVisual.setVisible(true);
      this.playerRig.girAnchor.getWorldPosition(_v3);
      this.playerGirVisual.snapToAnchor(_v3, this.playerYaw, this.charConfig.girLengthMeters, true);
    } else {
      this.playerGirVisual.setVisible(false);
    }
    this.setBodyState('title');
    this.emitHud();
  }

  public setMuted(muted: boolean): void {
    this.sound.setMuted(muted);
  }

  // Touch / Button Bridges
  public setTouchMove(dx: number, dy: number): void {
    this.touchMoveX = dx;
    this.touchMoveY = dy;
  }

  public setTouchBlock(active: boolean): void {
    if (active && !this.touchBlocking && this.gameState === 'playing') {
      this.parryWindowTimer = 0.22;
    }
    this.touchBlocking = active;
  }

  public triggerAttack(): void {
    if (this.gameState !== 'playing') return;
    this.sound.unlock();
    if (this.playerStagger > 0 || this.dodgeTimer > 0) return;

    if (this.attackPhase === 'idle') {
      this.beginPlayerAttack();
    } else {
      // Input buffer for responsive combo chains
      this.attackBuffered = true;
      this.attackBufferTimer = 0.14;
    }
  }

  public triggerThrowPetasan(): void {
    if (this.gameState !== 'playing') return;
    if (this.netMode) {
      this.setFeedback('PETASAN DIMATIKAN DI MABAR');
      return;
    }
    this.sound.unlock();
    if (
      this.ammoPetasan <= 0 ||
      this.petasanCooldown > 0 ||
      this.playerStagger > 0 ||
      this.playerThrowTimer > 0
    ) {
      return;
    }
    const spec = THROWABLE_SPECS[this.activeThrowable];
    this.ammoPetasan -= 1;
    this.petasanCooldown = spec.cooldownSec;
    this.isBlocking = false;
    this.sound.playThrowFuse();

    // Aim cleanly toward nearest rival within 13m or 7.2m down the avenue
    const nearest = this.findNearestEnemy(this.playerX, this.playerZ, 13.0);
    if (nearest) {
      this.playerThrowTargetX = nearest.x;
      this.playerThrowTargetZ = nearest.z;
      this.playerYaw = Math.atan2(nearest.x - this.playerX, nearest.z - this.playerZ);
    } else {
      const dirX = Math.sin(this.playerYaw);
      const dirZ = Math.cos(this.playerYaw);
      const clamped = resolveActorPosition(
        this.playerX + dirX * 7.2,
        this.playerZ + dirZ * 7.2,
      );
      this.playerThrowTargetX = clamped.x;
      this.playerThrowTargetZ = clamped.z;
    }

    this.playerThrowTimer = 0.38;
    this.playerThrowPending = true;
    this.heldPetasanMesh.visible = true;
    this.emitHud();
  }

  public triggerDodge(): void {
    if (this.gameState !== 'playing') return;
    this.sound.unlock();
    if (this.dodgeTimer > 0 || this.dodgeCooldown > 0 || this.playerStamina < 18) {
      return;
    }
    this.playerStamina = Math.max(0, this.playerStamina - 18);
    this.dodgeTimer = 0.24;
    this.dodgeCooldown = 0.45;
    this.attackPhase = 'idle';

    const move = this.getMoveVector();
    if (Math.hypot(move.x, move.z) > 0.1) {
      this.dodgeDirX = move.x;
      this.dodgeDirZ = move.z;
    } else {
      this.dodgeDirX = -Math.sin(this.playerYaw);
      this.dodgeDirZ = -Math.cos(this.playerYaw);
    }
    this.playerScaleX = 1.18;
    this.playerScaleY = 0.82;
    this.sound.playSwing('penggaris_baja');
  }

  private beginPlayerAttack(): void {
    const spec = getEffectiveWeaponSpec(this.activeWeapon, this.charConfig.girLengthMeters);
    if (this.playerStamina < spec.staminaCost * 0.5) {
      this.setFeedback('STAMINA HABIS!');
      return;
    }
    this.playerStamina = Math.max(0, this.playerStamina - spec.staminaCost);
    this.attackPhase = 'windup';
    this.attackTimer = spec.windupSec;
    this.hitTargetsThisSwing.clear();
    this.isBlocking = false;
    this.sound.playSwing(this.activeWeapon, this.charConfig.girLengthMeters);

    // Slight forward lunge toward nearest enemy in front
    const nearest = this.findNearestEnemy(this.playerX, this.playerZ, 4.2);
    if (nearest) {
      const dx = nearest.x - this.playerX;
      const dz = nearest.z - this.playerZ;
      this.playerYaw = Math.atan2(dx, dz);
      this.playerVx += Math.sin(this.playerYaw) * 3.5;
      this.playerVz += Math.cos(this.playerYaw) * 3.5;
    }
  }

  private findNearestEnemy(x: number, z: number, maxRange: number): EnemyActor | null {
    let best: EnemyActor | null = null;
    let bestD2 = maxRange * maxRange;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  private spawnWave(waveNum: number): void {
    const cfg = buildWaveConfig(this.level, waveNum);
    this.maxWaves = cfg.maxWaves;
    this.enemiesTotalInWave = cfg.enemies.length;
    this.waveBannerText =
      waveNum === cfg.maxWaves
        ? `GELOMBANG ${waveNum} · PENTOLAN TIBA`
        : `GELOMBANG ${waveNum} / ${cfg.maxWaves}`;
    this.waveBannerTimer = 2.4;
    this.sound.playWaveCue(false);

    cfg.enemies.forEach((entry, idx) => {
      const rig = buildFighterRig(
        { ...this.charConfig, primaryWeapon: entry.weapon },
        true,
        entry.archetype,
      );
      rig.root.position.set(entry.spawnX, 0, entry.spawnZ);
      this.scene.add(rig.root);
      rig.root.updateMatrixWorld(true);

      let girVisual: FlexibleGirVisual | null = null;
      if (entry.weapon === 'gir_sabuk' && rig.girAnchor) {
        girVisual = new FlexibleGirVisual(this.scene);
        rig.girAnchor.getWorldPosition(_v3);
        girVisual.snapToAnchor(_v3, 0, 2.8);
      }

      this.enemies.push({
        id: `w${waveNum}_e${idx}`,
        archetype: entry.archetype,
        weapon: entry.weapon,
        rig,
        x: entry.spawnX,
        z: entry.spawnZ,
        vx: 0,
        vz: 0,
        yaw: 0,
        hp: entry.hp,
        maxHp: entry.hp,
        speed: entry.speed * cfg.speedMultiplier,
        alive: true,
        koTimer: 0.45,
        walkPhase: idx * 1.1,
        staggerTimer: 0,
        hitFlashTimer: 0,
        throwAnimTimer: 0,
        aiState: 'approach',
        aiTimer: 0.4 + idx * 0.25,
        hasAttackHit: false,
        orbitDir: idx % 2 === 0 ? 1 : -1,
        petasanCooldown: 2.2 + idx * 0.7,
        girVisual,
      });
    });
  }

  private spawnAllies(): void {
    this.clearAllies();
    const allyLimit = Math.max(0, Math.min(ALLY_SQUAD_SPECS.length, this.level.allyCount));
    for (let i = 0; i < allyLimit; i++) {
      const spec = ALLY_SQUAD_SPECS[i];
      const rig = buildFighterRig(
        {
          ...this.charConfig,
          outfit: spec.outfit,
          headgear: spec.headgear,
          primaryWeapon: spec.weapon,
        },
        false,
        undefined,
        true,
      );
      const pos = resolveActorPosition(this.playerX + spec.flankOffsetX, this.playerZ + 0.8);
      rig.root.position.set(pos.x, 0, pos.z);
      rig.root.rotation.set(0, Math.PI, 0);
      if (rig.hpBarGroup) rig.hpBarGroup.visible = true;
      this.scene.add(rig.root);

      this.allies.push({
        id: spec.id,
        name: spec.name,
        weapon: spec.weapon,
        rig,
        x: pos.x,
        z: pos.z,
        vx: 0,
        vz: 0,
        yaw: Math.PI,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        speed: spec.speed,
        alive: true,
        koTimer: 0.48,
        walkPhase: i * 1.4,
        staggerTimer: 0,
        hitFlashTimer: 0,
        aiState: 'follow',
        aiTimer: 0,
        hasAttackHit: false,
        flankOffsetX: spec.flankOffsetX,
        orbitDir: i % 2 === 0 ? -1 : 1,
        targetEnemyId: null,
      });
    }
  }

  private clearAllies(): void {
    for (const a of this.allies) {
      this.scene.remove(a.rig.root);
    }
    this.allies = [];
  }

  private clearEnemies(): void {
    for (const e of this.enemies) {
      this.scene.remove(e.rig.root);
      e.girVisual?.dispose(this.scene);
      e.girVisual = null;
    }
    this.enemies = [];
  }

  private clearPetasans(): void {
    for (const p of this.petasans) {
      this.scene.remove(p.mesh);
      this.scene.remove(p.ring);
    }
    this.petasans = [];
    for (const b of this.blasts) {
      this.disposeBlastVisual(b);
    }
    this.blasts = [];
  }

  private disposeBlastVisual(b: BlastVisual): void {
    this.scene.remove(b.group);
    (b.fireball.material as THREE.Material).dispose();
    (b.shockwave.material as THREE.Material).dispose();
    for (const sp of b.smokePuffs) {
      (sp.mesh.material as THREE.Material).dispose();
    }
    if (b.scorch) {
      this.scene.remove(b.scorch);
      (b.scorch.material as THREE.Material).dispose();
    }
  }

  private spawnPetasanBallistic(
    throwableId: ThrowableId,
    fromPlayer: boolean,
    startX: number,
    startY: number,
    startZ: number,
    targetX: number,
    targetZ: number,
  ): void {
    const spec = THROWABLE_SPECS[throwableId];
    const dist = Math.hypot(targetX - startX, targetZ - startZ);
    const flightTime =
      throwableId === 'petasan_banting'
        ? THREE.MathUtils.clamp(0.38 + dist * 0.032, 0.36, 0.68)
        : THREE.MathUtils.clamp(0.42 + dist * 0.028, 0.4, 0.62);
    const g = 15.5;
    const vx = (targetX - startX) / flightTime;
    const vz = (targetZ - startZ) / flightTime;
    const vy = (0.12 - startY + 0.5 * g * flightTime * flightTime) / flightTime;

    const mesh = buildPetasanMesh(throwableId === 'petasan_roman');
    mesh.position.set(startX, startY, startZ);
    this.scene.add(mesh);

    const ringInner = fromPlayer ? 0.28 : spec.blastRadius * 0.86;
    const ringOuter = fromPlayer ? 0.44 : spec.blastRadius;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringInner, ringOuter, 28),
      new THREE.MeshBasicMaterial({
        color: fromPlayer ? 0xfbbf24 : 0xef4444,
        transparent: true,
        opacity: fromPlayer ? 0.32 : 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(targetX, 0.03, targetZ);
    this.scene.add(ring);

    const fuse = throwableId === 'petasan_banting' ? flightTime + 0.1 : flightTime + 0.04;
    this.petasans.push({
      mesh,
      ring,
      throwableId,
      fromPlayer,
      x: startX,
      y: startY,
      z: startZ,
      vx,
      vy,
      vz,
      targetX,
      targetZ,
      age: 0,
      maxFuse: fuse,
      fuseTimer: fuse,
      burstsLeft: spec.burstCount,
      burstDelay: 0.22,
      hasBounced: false,
      spinX: 11 + Math.random() * 5,
      spinZ: 7 + Math.random() * 5,
    });
  }

  private spawnBurstParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 5,
    size = 1.0,
    gravity = 12,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(angle) * spd;
      p.vy = (0.3 + Math.random() * 0.9) * speed * 0.8;
      p.vz = Math.sin(angle) * spd;
      p.maxLife = 0.25 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.color.setHex(colorHex);
      p.gravity = gravity;
    }
  }

  private setFeedback(text: string): void {
    this.hitFeedbackLabel = text;
    this.hitFeedbackTimer = 1.1;
  }

  private getMoveVector(): { x: number; z: number } {
    let mx = this.touchMoveX;
    let mz = this.touchMoveY;

    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) mx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) mx += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) mz -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) mz += 1;

    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    return { x: mx, z: mz };
  }

  private update(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    this.simTime += dt;

    // Update particles, blast visuals & camera trauma even during hitstop
    this.updateParticles(dt);
    this.updateBlasts(dt);
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    if (this.blastLightTimer > 0) {
      this.blastLightTimer -= dt;
      this.activeBlastLight.intensity = Math.max(0, this.blastLightTimer * 125);
    }

    if (this.hitFeedbackTimer > 0) this.hitFeedbackTimer -= dt;
    if (this.waveBannerTimer > 0) this.waveBannerTimer -= dt;

    // Title mode: smooth turntable preview of customized 3D fighter
    if (this.gameState === 'title') {
      this.titleTurntableAngle += dt * 0.45;
      const previewYaw = Math.sin(this.titleTurntableAngle) * 0.55 + 0.15;
      this.playerRig.root.position.set(0.8, 0, 6);
      this.playerRig.root.rotation.set(0, previewYaw, 0);
      this.playerRig.root.scale.set(1, 1, 1);
      this.animateIdlePose(this.playerRig, performance.now() * 0.002);

      if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
        this.playerRig.root.updateMatrixWorld(true);
        this.playerRig.girAnchor.getWorldPosition(_v3);
        const effSpec = getEffectiveWeaponSpec('gir_sabuk', this.charConfig.girLengthMeters);
        this.playerGirVisual.update({
          dt,
          anchorPos: _v3,
          fighterX: 0.8,
          fighterZ: 6,
          fighterYaw: previewYaw,
          lengthMeters: this.charConfig.girLengthMeters,
          attackPhase: 'idle',
          attackTimer: 0,
          windupSec: effSpec.windupSec,
          activeSec: effSpec.activeSec,
          recoverySec: effSpec.recoverySec,
          isTitlePreview: true,
          simTime: this.simTime,
        });
      }

      // Frame hero on right-center so left calm negative space holds Title & Customizer
      const lenExtra =
        this.activeWeapon === 'gir_sabuk'
          ? ((this.charConfig.girLengthMeters - 2) / 4) * 1.2
          : 0;
      _v1.set(0.1, 2.25 + lenExtra * 0.4, 11.4 + lenExtra);
      _v2.set(-0.3, 1.15, 6);
      const dampK = 1 - Math.exp(-5 * dt);
      this.camPos.lerp(_v1, dampK);
      this.camLook.lerp(_v2, dampK);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    if (this.gameState === 'intro') {
      this.updatePetasans(dt);
      this.updateIntro(dt);
      return;
    }

    if (this.gameState === 'paused' || this.gameState === 'gameover') {
      return;
    }

    // Defeat beat delay before showing Game Over modal
    if (this.gameOverDelayTimer > 0) {
      this.gameOverDelayTimer -= dt;
      this.playerRig.root.rotation.x = THREE.MathUtils.damp(
        this.playerRig.root.rotation.x,
        -Math.PI * 0.48,
        10,
        dt,
      );
      if (this.gameOverDelayTimer <= 0) {
        this.finishRun(false);
      }
      return;
    }

    // Pengaman pose: selama pemain masih hidup dan tidak sedang jatuh karena
    // kalah, rig harus kembali berdiri. Tanpa ini rig bisa tertinggal miring
    // (mis. setelah sempat tergeletak lalu dapat heal +25 antar-gelombang).
    // (state 'paused'/'gameover' sudah di-return di atas)
    if (this.playerHp > 0) {
      if (Math.abs(this.playerRig.root.rotation.x) > 0.002) {
        this.playerRig.root.rotation.x = THREE.MathUtils.damp(
          this.playerRig.root.rotation.x,
          0,
          12,
          dt,
        );
      }
    }

    // Hitstop freeze frames on heavy strikes / explosions
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateHitFlashes(dt);
      this.updateCamera(dt);
      return;
    }

    // --- ACTIVE GAMEPLAY SIMULATION ---
    this.updateHitFlashes(dt);
    this.updatePlayer(dt);

    // MABAR ONLINE: hanya pemain lokal + lawan dari jaringan, tanpa gelombang.
    if (this.netMode) {
      this.updateRemoteFighter(dt);
      this.updatePetasans(dt);
      this.updateCamera(dt);
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.08) {
        this.hudSyncTimer = 0;
        this.emitHud();
      }
      return;
    }

    this.updateAllies(dt);
    this.updateEnemies(dt);
    this.updatePetasans(dt);

    // Delayed ghost HP bar drain
    if (this.playerGhostHp > this.playerHp) {
      this.playerGhostHp = THREE.MathUtils.damp(
        this.playerGhostHp,
        this.playerHp,
        4.5,
        dt,
      );
    } else {
      this.playerGhostHp = this.playerHp;
    }

    // Combo decay
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // Check wave completion
    const aliveCount = this.enemies.filter((e) => e.alive).length;
    if (aliveCount === 0 && this.enemies.length > 0 && this.waveTransitionTimer <= 0) {
      // Wait for KO animations to finish before next wave
      if (this.enemies.every((e) => !e.alive && e.koTimer <= 0)) {
        if (this.wave < this.maxWaves) {
          this.waveTransitionTimer = 1.3;
          this.setFeedback('GELOMBANG BERSIH!');
        } else {
          this.finishRun(true);
          return;
        }
      }
    }

    if (this.waveTransitionTimer > 0) {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0) {
        this.clearEnemies();
        this.wave += 1;
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 25);
        this.ammoPetasan = Math.min(this.maxPetasan, this.ammoPetasan + 2);
        // Rally & revive squad allies between waves
        for (const ally of this.allies) {
          const wasDown = !ally.alive;
          ally.alive = true;
          ally.koTimer = 0.48;
          ally.staggerTimer = 0;
          ally.hitFlashTimer = 0;
          for (const m of ally.rig.hitFlashMaterials) {
            m.emissive.copy(_zeroColor);
            m.emissiveIntensity = 0;
          }
          ally.aiState = 'follow';
          ally.aiTimer = 0;
          ally.vx = 0;
          ally.vz = 0;
          ally.targetEnemyId = null;
          ally.hp = wasDown
            ? Math.round(ally.maxHp * 0.7)
            : Math.min(ally.maxHp, ally.hp + 30);
          ally.rig.root.visible = true;
          this.resetRigPose(ally.rig);
          if (wasDown) {
            const pos = resolveActorPosition(
              this.playerX + ally.flankOffsetX,
              this.playerZ + 1.1,
            );
            ally.x = pos.x;
            ally.z = pos.z;
          }
          ally.rig.root.position.set(ally.x, 0, ally.z);
          ally.rig.root.rotation.set(0, ally.yaw, 0);
          if (ally.rig.hpBarGroup && ally.rig.hpBarFill) {
            ally.rig.hpBarGroup.visible = true;
            const hpRatio = Math.max(0.001, ally.hp / ally.maxHp);
            ally.rig.hpBarFill.scale.x = hpRatio;
            ally.rig.hpBarFill.position.x = -(1 - hpRatio) * 0.35;
          }
        }
        this.spawnWave(this.wave);
      }
    }

    this.updateCamera(dt);

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private updateIntro(dt: number): void {
    this.introTimer += dt;
    const t = this.introTimer;

    const nextBeat = t < 3.8 ? 0 : t < 7.6 ? 1 : t < 11.2 ? 2 : 3;
    if (nextBeat !== this.introBeat) {
      this.introBeat = nextBeat;
      if (nextBeat === 1 || nextBeat === 3) {
        this.sound.playIntroBeat(nextBeat);
      }
      this.emitHud();
    }

    if (t >= 14.8) {
      this.skipIntro();
      return;
    }

    let desiredHeroX = -1.8;
    let desiredHeroZ = 9.6;
    let desiredHeroYaw = Math.PI;
    let heroSpeed = 0;
    let heroStagger = false;
    let heroAttackPhase: 'idle' | 'windup' | 'active' | 'recovery' = 'idle';

    if (nextBeat === 0) {
      // Beat 0: Casual walk from warung toward road
      const p = Math.min(1, t / 3.4);
      desiredHeroX = THREE.MathUtils.lerp(-4.6, -1.8, p);
      desiredHeroZ = THREE.MathUtils.lerp(12.6, 9.6, p);
      desiredHeroYaw = 2.25;
      heroSpeed = p < 0.96 ? 2.4 : 0;
      _v1.set(
        THREE.MathUtils.lerp(-6.8, -4.4, p),
        THREE.MathUtils.lerp(2.2, 2.35, p),
        THREE.MathUtils.lerp(15.2, 12.6, p),
      );
      _v2.set(
        THREE.MathUtils.lerp(-3.4, -1.2, p),
        1.25,
        THREE.MathUtils.lerp(11.4, 8.2, p),
      );
    } else if (nextBeat === 1) {
      // Beat 1: Confrontation & rival taunt blocking the street
      const p = Math.min(1, (t - 3.8) / 3.6);
      desiredHeroX = -1.6;
      desiredHeroZ = 9.5;
      desiredHeroYaw = Math.atan2(0.2 - desiredHeroX, 4.4 - desiredHeroZ);
      _v1.set(
        THREE.MathUtils.lerp(-4.2, -2.9, p),
        2.3,
        THREE.MathUtils.lerp(12.2, 11.2, p),
      );
      _v2.set(0.1, 1.32, THREE.MathUtils.lerp(6.8, 4.3, p));
    } else if (nextBeat === 2) {
      // Beat 2: Rival throws warning petasan onto asphalt -> explosion & recoil
      const p = Math.min(1, (t - 7.6) / 3.6);
      if (!this.introPetasanThrown && t >= 7.72) {
        this.introPetasanThrown = true;
        this.sound.playThrowFuse();
        this.spawnPetasanBallistic('petasan_banting', false, 2.0, 1.55, 4.5, -0.5, 7.6);
      }
      const postBlast = t >= 8.42;
      heroStagger = t >= 8.42 && t < 9.15;
      desiredHeroX = THREE.MathUtils.lerp(-1.6, -0.4, postBlast ? Math.min(1, (t - 8.42) / 1.4) : 0);
      desiredHeroZ = t < 8.42 ? 9.5 : t < 9.2 ? 10.1 : THREE.MathUtils.lerp(10.1, 8.8, (t - 9.2) / 1.8);
      desiredHeroYaw = Math.atan2(0.1 - desiredHeroX, 4.0 - desiredHeroZ);
      heroSpeed = t >= 9.2 && t < 11.0 ? 2.2 : 0;
      _v1.set(-4.6, 2.85, 12.6);
      _v2.set(-0.3, 1.15, THREE.MathUtils.lerp(6.4, 7.2, p));
    } else {
      // Beat 3: Hero steps onto center road in ready stance, camera sweeps seamlessly into gameplay position
      const p = Math.min(1, (t - 11.2) / 3.4);
      const sp = p * p * (3 - 2 * p);
      desiredHeroX = THREE.MathUtils.lerp(-0.4, 0, sp);
      desiredHeroZ = THREE.MathUtils.lerp(8.8, 8.0, sp);
      desiredHeroYaw = Math.PI;
      heroSpeed = p < 0.35 ? 2.0 : 0;
      if (p > 0.55 && p < 0.78) heroAttackPhase = 'windup';
      _v1.set(
        THREE.MathUtils.lerp(-2.5, 0, sp),
        THREE.MathUtils.lerp(2.2, 4.9, sp),
        THREE.MathUtils.lerp(11.3, 16.2, sp),
      );
      _v2.set(0, 1.15, THREE.MathUtils.lerp(6.4, 5.8, sp));
    }

    const posBlend = 1 - Math.exp(-7 * dt);
    this.playerX += (desiredHeroX - this.playerX) * posBlend;
    this.playerZ += (desiredHeroZ - this.playerZ) * posBlend;
    this.playerYaw += normalizeAngleDiff(desiredHeroYaw, this.playerYaw) * (1 - Math.exp(-10 * dt));
    this.playerWalkPhase += heroSpeed * dt * 2.4;

    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.set(0, this.playerYaw, 0);
    this.animateFighterPose(
      this.playerRig,
      this.playerWalkPhase,
      heroSpeed,
      heroAttackPhase,
      0.1,
      0.2,
      0.25,
      0.3,
      this.activeWeapon,
      false,
      heroStagger,
      false,
      0,
    );

    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerRig.root.updateMatrixWorld(true);
      this.playerRig.girAnchor.getWorldPosition(_v3);
      const spec = getEffectiveWeaponSpec('gir_sabuk', this.charConfig.girLengthMeters);
      this.playerGirVisual.update({
        dt,
        anchorPos: _v3,
        fighterX: this.playerX,
        fighterZ: this.playerZ,
        fighterYaw: this.playerYaw,
        lengthMeters: this.charConfig.girLengthMeters,
        attackPhase: heroAttackPhase,
        attackTimer: 0.1,
        windupSec: spec.windupSec,
        activeSec: spec.activeSec,
        recoverySec: spec.recoverySec,
        isTitlePreview: false,
        simTime: this.simTime,
      });
    }

    // Animate the 2 flanking schoolmate allies beside the hero
    for (let i = 0; i < this.introAllies.length; i++) {
      const rig = this.introAllies[i];
      const meta = this.introAllyMeta[i];
      const spec = ALLY_SQUAD_SPECS[i];
      let targetX = desiredHeroX + meta.flankOffsetX * 0.78;
      let targetZ = desiredHeroZ + 0.85;
      let targetYaw = this.playerYaw;
      let allyAttackPhase: 'idle' | 'windup' | 'active' | 'recovery' = 'idle';

      if (nextBeat === 1) {
        targetX = desiredHeroX + meta.flankOffsetX * 0.92;
        targetZ = desiredHeroZ + 0.45;
        targetYaw = Math.atan2(0.2 - meta.x, 4.4 - meta.z);
      } else if (nextBeat === 2) {
        targetX = desiredHeroX + meta.flankOffsetX;
        targetZ = t >= 8.42 && t < 9.15 ? desiredHeroZ + 1.05 : desiredHeroZ + 0.7;
        targetYaw = Math.atan2(0.1 - meta.x, 4.0 - meta.z);
      } else if (nextBeat === 3) {
        targetX = meta.flankOffsetX;
        targetZ = 8.8;
        targetYaw = Math.PI;
        const p3 = Math.min(1, (t - 11.2) / 3.4);
        if (p3 > 0.58 && p3 < 0.82) allyAttackPhase = 'windup';
      }

      const prevX = meta.x;
      const prevZ = meta.z;
      const allyBlend = 1 - Math.exp(-6.5 * dt);
      meta.x += (targetX - meta.x) * allyBlend;
      meta.z += (targetZ - meta.z) * allyBlend;
      const allySpd = Math.min(3.5, Math.hypot(meta.x - prevX, meta.z - prevZ) / Math.max(0.001, dt));
      meta.phase += allySpd * dt * 2.4;

      rig.root.position.set(meta.x, 0, meta.z);
      rig.root.rotation.set(0, targetYaw, 0);
      this.animateFighterPose(
        rig,
        meta.phase,
        allySpd,
        allyAttackPhase,
        0.1,
        0.2,
        0.25,
        0.3,
        spec.weapon,
        false,
        nextBeat === 2 && heroStagger,
        false,
        0,
      );
    }

    // Animate the 3 blocking rival students
    for (let i = 0; i < this.introActors.length; i++) {
      const rig = this.introActors[i];
      const meta = this.introActorMeta[i];
      const baseZ = i === 0 ? 3.4 : i === 1 ? 2.6 : 2.9;
      const targetZ =
        nextBeat === 0
          ? baseZ
          : nextBeat === 1 || nextBeat === 2
            ? baseZ + 1.5
            : baseZ - 1.2;
      const actorSpd = Math.abs(targetZ - meta.z) > 0.15 ? 2.2 : 0;
      meta.z += (targetZ - meta.z) * (1 - Math.exp(-4.5 * dt));
      meta.phase += actorSpd * dt * 2.4;
      rig.root.position.set(meta.x, 0, meta.z);
      rig.root.rotation.set(0, Math.atan2(this.playerX - meta.x, this.playerZ - meta.z), 0);

      const throwAnim = nextBeat === 2 && i === 2 && t >= 7.68 && t < 8.1 ? 8.1 - t : 0;
      this.animateFighterPose(
        rig,
        meta.phase,
        actorSpd,
        'idle',
        0,
        0.2,
        0.2,
        0.3,
        'kayu_paku',
        false,
        false,
        false,
        throwAnim,
      );
      if (nextBeat === 1 && i === 0) {
        // Pentolan taunts & points aggressively at player
        rig.rightShoulder.rotation.set(-1.35 + Math.sin(t * 7.5) * 0.25, 0.2, 0.35);
        rig.rightElbow.rotation.x = -0.35;
      }
    }

    const camBlend = 1 - Math.exp(-5.5 * dt);
    this.camPos.lerp(_v1, camBlend);
    this.camLook.lerp(_v2, camBlend);
    const shake = this.cameraTrauma * this.cameraTrauma;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * 0.65 * shake,
      this.camPos.y + (Math.random() - 0.5) * 0.55 * shake,
      this.camPos.z,
    );
    this.camera.lookAt(this.camLook);
  }

  private updateHitFlashes(dt: number): void {
    if (this.playerHitFlash > 0) {
      this.playerHitFlash -= dt;
      const emissive = this.playerHitFlash > 0 ? _whiteEmissive : _zeroColor;
      const intensity = this.playerHitFlash > 0 ? 0.85 : 0;
      for (const m of this.playerRig.hitFlashMaterials) {
        m.emissive.copy(emissive);
        m.emissiveIntensity = intensity;
      }
    }
    for (const a of this.allies) {
      if (a.hitFlashTimer > 0) {
        a.hitFlashTimer -= dt;
        const active = a.hitFlashTimer > 0;
        for (const m of a.rig.hitFlashMaterials) {
          m.emissive.copy(active ? _whiteEmissive : _zeroColor);
          m.emissiveIntensity = active ? 0.9 : 0;
        }
      }
    }
    for (const e of this.enemies) {
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        const active = e.hitFlashTimer > 0;
        for (const m of e.rig.hitFlashMaterials) {
          m.emissive.copy(active ? _whiteEmissive : _zeroColor);
          m.emissiveIntensity = active ? 0.9 : 0;
        }
      }
    }
  }

  private updatePlayer(dt: number): void {
    if (this.petasanCooldown > 0) this.petasanCooldown = Math.max(0, this.petasanCooldown - dt);
    if (this.ammoPetasan < this.maxPetasan) {
      this.petasanRechargeTimer += dt;
      if (this.petasanRechargeTimer >= 7.5) {
        this.petasanRechargeTimer = 0;
        this.ammoPetasan += 1;
      }
    }

    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;
    if (this.parryWindowTimer > 0) this.parryWindowTimer -= dt;
    if (this.playerStagger > 0) this.playerStagger -= dt;

    if (this.playerThrowTimer > 0) {
      this.playerThrowTimer = Math.max(0, this.playerThrowTimer - dt);
      this.playerRig.leftElbow.getWorldPosition(_v3);
      if (this.playerThrowPending) {
        // Windup fuse sparks in hand
        if (Math.random() < 0.75) {
          this.spawnBurstParticles(_v3.x, _v3.y - 0.14, _v3.z, 1, 0xffd166, 2.0, 0.6, 4);
        }
        if (this.playerThrowTimer <= 0.24) {
          this.playerThrowPending = false;
          this.heldPetasanMesh.visible = false;
          const dirX = Math.sin(this.playerYaw);
          const dirZ = Math.cos(this.playerYaw);
          this.spawnPetasanBallistic(
            this.activeThrowable,
            true,
            _v3.x + dirX * 0.16,
            Math.max(1.05, _v3.y - 0.12),
            _v3.z + dirZ * 0.16,
            this.playerThrowTargetX,
            this.playerThrowTargetZ,
          );
        }
      }
    }

    if (this.attackBufferTimer > 0) {
      this.attackBufferTimer -= dt;
      if (this.attackBufferTimer <= 0) this.attackBuffered = false;
    }

    const wantBlock =
      this.keysHeld.has('KeyK') ||
      this.keysHeld.has('ShiftLeft') ||
      this.touchBlocking;
    this.isBlocking =
      wantBlock &&
      this.attackPhase === 'idle' &&
      this.dodgeTimer <= 0 &&
      this.playerStagger <= 0 &&
      this.playerStamina > 4;

    if (this.isBlocking) {
      this.playerStamina = Math.max(0, this.playerStamina - 6 * dt);
    } else if (this.attackPhase === 'idle') {
      this.playerStamina = Math.min(
        this.playerMaxStamina,
        this.playerStamina + 24 * dt,
      );
    }

    // Movement
    const move = this.getMoveVector();
    let speed = 6.2;
    if (this.isBlocking) speed = 2.8;
    else if (this.attackPhase !== 'idle') speed = 2.0;

    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      this.playerVx = this.dodgeDirX * 12.5;
      this.playerVz = this.dodgeDirZ * 12.5;
    } else if (this.playerStagger > 0) {
      this.playerVx *= Math.exp(-8 * dt);
      this.playerVz *= Math.exp(-8 * dt);
    } else {
      const targetVx = move.x * speed;
      const targetVz = move.z * speed;
      const accel = 1 - Math.exp(-16 * dt);
      this.playerVx += (targetVx - this.playerVx) * accel;
      this.playerVz += (targetVz - this.playerVz) * accel;

      if (Math.hypot(move.x, move.z) > 0.12 && this.attackPhase === 'idle') {
        const targetYaw = Math.atan2(move.x, move.z);
        const diff = normalizeAngleDiff(targetYaw, this.playerYaw);
        this.playerYaw += diff * (1 - Math.exp(-14 * dt));
      }
    }

    const nextPos = resolveActorPosition(
      this.playerX + this.playerVx * dt,
      this.playerZ + this.playerVz * dt,
    );
    this.playerX = nextPos.x;
    this.playerZ = nextPos.z;

    const actualSpeed = Math.hypot(this.playerVx, this.playerVz);
    this.playerWalkPhase += actualSpeed * dt * 2.4;

    // Attack state machine (uses length-scaled spec for gir_sabuk)
    const spec = getEffectiveWeaponSpec(this.activeWeapon, this.charConfig.girLengthMeters);
    if (this.attackPhase !== 'idle') {
      this.attackTimer -= dt;
      if (this.attackPhase === 'windup' && this.attackTimer <= 0) {
        this.attackPhase = 'active';
        this.attackTimer = spec.activeSec;
        this.playerScaleX = 1.12;
        this.playerScaleY = 0.9;
        if (this.netMode) this.sendNetAttack();
      } else if (this.attackPhase === 'active') {
        this.evaluatePlayerMeleeHits(spec);
        if (this.attackTimer <= 0) {
          this.attackPhase = 'recovery';
          this.attackTimer = spec.recoverySec;
        }
      } else if (this.attackPhase === 'recovery' && this.attackTimer <= 0) {
        this.attackPhase = 'idle';
        if (this.attackBuffered) {
          this.attackBuffered = false;
          this.beginPlayerAttack();
        }
      }
    }

    // Damped squash-and-stretch recovery
    this.playerScaleX = THREE.MathUtils.damp(this.playerScaleX, 1, 14, dt);
    this.playerScaleY = THREE.MathUtils.damp(this.playerScaleY, 1, 14, dt);

    // Apply transforms & articulated pose
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.set(0, this.playerYaw, 0);
    this.playerRig.root.scale.set(this.playerScaleX, this.playerScaleY, this.playerScaleX);

    this.animateFighterPose(
      this.playerRig,
      this.playerWalkPhase,
      actualSpeed,
      this.attackPhase,
      this.attackTimer,
      spec.activeSec,
      spec.windupSec,
      spec.recoverySec,
      this.activeWeapon,
      this.isBlocking,
      this.playerStagger > 0,
      this.dodgeTimer > 0,
      this.playerThrowTimer,
    );

    if (this.activeWeapon === 'gir_sabuk' && this.playerRig.girAnchor) {
      this.playerRig.root.updateMatrixWorld(true);
      this.playerRig.girAnchor.getWorldPosition(_v3);
      this.playerGirVisual.update({
        dt,
        anchorPos: _v3,
        fighterX: this.playerX,
        fighterZ: this.playerZ,
        fighterYaw: this.playerYaw,
        lengthMeters: this.charConfig.girLengthMeters,
        attackPhase: this.attackPhase,
        attackTimer: this.attackTimer,
        windupSec: spec.windupSec,
        activeSec: spec.activeSec,
        recoverySec: spec.recoverySec,
        isTitlePreview: false,
        simTime: this.simTime,
        onAsphaltSpark: (sx, sy, sz) => {
          this.spawnBurstParticles(sx, sy, sz, 2, 0xfbbf24, 3.8, 0.7, 12);
        },
      });
    }
  }

  private evaluatePlayerMeleeHits(spec: (typeof WEAPON_SPECS)[WeaponId]): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive || this.hitTargetsThisSwing.has(enemy.id)) continue;

      const hitRes = computeMeleeHit({
        attackerX: this.playerX,
        attackerZ: this.playerZ,
        attackerYaw: this.playerYaw,
        targetX: enemy.x,
        targetZ: enemy.z,
        weapon: spec,
        targetBlocking: false,
        targetParryTimer: 0,
        comboCount: this.combo,
      });

      if (hitRes.hit) {
        this.hitTargetsThisSwing.add(enemy.id);
        enemy.hp = Math.max(0, enemy.hp - hitRes.damage);
        enemy.vx += hitRes.knockbackX;
        enemy.vz += hitRes.knockbackZ;
        enemy.staggerTimer = Math.max(enemy.staggerTimer, hitRes.staggerSec);
        enemy.hitFlashTimer = 0.07;
        enemy.aiState = 'approach';
        (enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;

        this.combo = hitRes.nextCombo;
        this.comboTimer = 2.6;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += hitRes.damage * 10 + this.combo * 15;

        const isHeavy = spec.damage >= 28 || this.combo >= 3;
        this.sound.playHit(isHeavy);
        this.hitstopTimer = Math.max(this.hitstopTimer, spec.hitstopSec);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + (isHeavy ? 0.36 : 0.2));

        this.spawnBurstParticles(
          enemy.x,
          1.2,
          enemy.z,
          isHeavy ? 18 : 10,
          spec.id === 'sabit_modif' ||
            spec.id === 'penggaris_baja' ||
            spec.id === 'gir_sabuk'
            ? 0xfbbf24
            : 0xe5e7eb,
          6.5,
          1.0,
          14,
        );

        if (enemy.hp <= 0) {
          this.handleEnemyKO(enemy);
        } else {
          this.setFeedback(`${spec.shortName.toUpperCase()} -${hitRes.damage}`);
        }
        this.emitHud();
      }
    }
  }

  private handleEnemyKO(enemy: EnemyActor): void {
    enemy.alive = false;
    enemy.koTimer = 0.48;
    enemy.girVisual?.setVisible(false);
    (enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
    if (enemy.rig.hpBarGroup) enemy.rig.hpBarGroup.visible = false;
    this.defeatedCount += 1;
    this.score += enemy.archetype === 'pentolan' ? 500 : 150;
    this.hitstopTimer = Math.max(this.hitstopTimer, 0.065);
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
    this.setFeedback(enemy.archetype === 'pentolan' ? 'PENTOLAN TUMBANG!' : 'LAWAN TUMBANG!');
    this.spawnBurstParticles(enemy.x, 1.0, enemy.z, 22, 0xf97316, 7, 1.3, 10);
  }

  private applyDamageToAlly(
    ally: AllyActor,
    dmg: number,
    kbX: number,
    kbZ: number,
  ): void {
    if (!ally.alive) return;
    ally.hp = Math.max(0, ally.hp - dmg);
    ally.vx += kbX;
    ally.vz += kbZ;
    ally.staggerTimer = Math.max(ally.staggerTimer, 0.25);
    ally.hitFlashTimer = 0.08;
    this.spawnBurstParticles(ally.x, 1.15, ally.z, 8, 0xf87171, 4.5, 0.85, 12);

    if (ally.hp <= 0) {
      ally.alive = false;
      ally.koTimer = 0.48;
      ally.targetEnemyId = null;
      if (ally.rig.hpBarGroup) ally.rig.hpBarGroup.visible = false;
      this.setFeedback(`${ally.name.toUpperCase()} TUMBANG!`);
      this.emitHud();
    }
  }

  private updateAllies(dt: number): void {
    for (const ally of this.allies) {
      if (!ally.alive) {
        if (ally.koTimer > 0) {
          ally.koTimer -= dt;
          ally.x += ally.vx * dt;
          ally.z += ally.vz * dt;
          ally.vx *= Math.exp(-6 * dt);
          ally.vz *= Math.exp(-6 * dt);
          const pos = resolveActorPosition(ally.x, ally.z);
          ally.x = pos.x;
          ally.z = pos.z;
          ally.rig.root.position.set(ally.x, 0, ally.z);
          ally.rig.root.rotation.x = THREE.MathUtils.damp(
            ally.rig.root.rotation.x,
            -Math.PI * 0.48,
            9,
            dt,
          );
          if (ally.koTimer <= 0) {
            ally.rig.root.visible = false;
          }
        }
        continue;
      }

      // Select nearest living enemy within 14m, with mild flank spread so allies don't overlap on one rival
      let targetEnemy: EnemyActor | null = null;
      let bestScore = 14 * 14;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d2 = (e.x - ally.x) ** 2 + (e.z - ally.z) ** 2;
        const takenByOtherAlly = this.allies.some(
          (other) => other !== ally && other.alive && other.targetEnemyId === e.id,
        );
        const weighted = d2 + (takenByOtherAlly ? 9.0 : 0);
        if (d2 <= 14 * 14 && weighted < bestScore) {
          bestScore = weighted;
          targetEnemy = e;
        }
      }
      ally.targetEnemyId = targetEnemy ? targetEnemy.id : null;

      const spec = getEffectiveWeaponSpec(ally.weapon, 2.8);

      if (ally.staggerTimer > 0) {
        ally.staggerTimer -= dt;
        ally.vx *= Math.exp(-7 * dt);
        ally.vz *= Math.exp(-7 * dt);
      } else if (ally.aiState === 'windup') {
        ally.aiTimer -= dt;
        if (targetEnemy) {
          const desiredYaw = Math.atan2(targetEnemy.x - ally.x, targetEnemy.z - ally.z);
          ally.yaw += normalizeAngleDiff(desiredYaw, ally.yaw) * (1 - Math.exp(-12 * dt));
        }
        ally.vx *= Math.exp(-10 * dt);
        ally.vz *= Math.exp(-10 * dt);
        if (ally.aiTimer <= 0) {
          ally.aiState = 'active';
          ally.aiTimer = spec.activeSec;
          ally.hasAttackHit = false;
          this.sound.playSwing(ally.weapon);
          ally.vx += Math.sin(ally.yaw) * 3.2;
          ally.vz += Math.cos(ally.yaw) * 3.2;
        }
      } else if (ally.aiState === 'active') {
        ally.aiTimer -= dt;
        if (!ally.hasAttackHit) {
          for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            const hit = computeMeleeHit({
              attackerX: ally.x,
              attackerZ: ally.z,
              attackerYaw: ally.yaw,
              targetX: enemy.x,
              targetZ: enemy.z,
              weapon: spec,
              targetBlocking: false,
              targetParryTimer: 0,
              comboCount: 0,
            });
            if (hit.hit) {
              ally.hasAttackHit = true;
              const dmg = Math.round(hit.damage * 0.62);
              enemy.hp = Math.max(0, enemy.hp - dmg);
              enemy.vx += hit.knockbackX * 0.75;
              enemy.vz += hit.knockbackZ * 0.75;
              enemy.staggerTimer = Math.max(enemy.staggerTimer, hit.staggerSec * 0.8);
              enemy.hitFlashTimer = 0.07;
              enemy.aiState = 'approach';
              (enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;

              this.sound.playHit(false);
              this.score += dmg * 6;
              this.spawnBurstParticles(enemy.x, 1.15, enemy.z, 9, 0xfbbf24, 5.2, 0.9, 13);

              if (enemy.hp <= 0) {
                this.handleEnemyKO(enemy);
              }
              this.emitHud();
              break;
            }
          }
        }
        if (ally.aiTimer <= 0) {
          ally.aiState = 'recover';
          ally.aiTimer = 0.48;
        }
      } else if (ally.aiState === 'recover') {
        ally.aiTimer -= dt;
        ally.vx *= Math.exp(-10 * dt);
        ally.vz *= Math.exp(-10 * dt);
        if (ally.aiTimer <= 0) {
          ally.aiState = 'follow';
        }
      } else {
        let desiredVx = 0;
        let desiredVz = 0;
        let targetYaw = ally.yaw;

        if (targetEnemy) {
          ally.aiState = 'engage';
          const dx = targetEnemy.x - ally.x;
          const dz = targetEnemy.z - ally.z;
          const dist = Math.hypot(dx, dz) || 0.001;
          targetYaw = Math.atan2(dx, dz);

          if (dist > spec.reach * 0.88) {
            desiredVx = (dx / dist) * ally.speed;
            desiredVz = (dz / dist) * ally.speed;
          } else {
            ally.aiState = 'windup';
            ally.aiTimer = 0.32;
          }
        } else {
          ally.aiState = 'follow';
          const formPos = resolveActorPosition(
            this.playerX + ally.flankOffsetX,
            this.playerZ + 1.2,
          );
          const fdx = formPos.x - ally.x;
          const fdz = formPos.z - ally.z;
          const fdist = Math.hypot(fdx, fdz);
          if (fdist > 0.65) {
            desiredVx = (fdx / fdist) * ally.speed;
            desiredVz = (fdz / fdist) * ally.speed;
            targetYaw = Math.atan2(fdx, fdz);
          } else {
            targetYaw = this.playerYaw;
          }
        }

        // Separation from player and other living allies so squad doesn't stack
        const pdx = ally.x - this.playerX;
        const pdz = ally.z - this.playerZ;
        const pd2 = pdx * pdx + pdz * pdz;
        if (pd2 < 1.5 && pd2 > 0.001) {
          const pd = Math.sqrt(pd2);
          desiredVx += (pdx / pd) * 2.8;
          desiredVz += (pdz / pd) * 2.8;
        }
        for (const other of this.allies) {
          if (other === ally || !other.alive) continue;
          const adx = ally.x - other.x;
          const adz = ally.z - other.z;
          const ad2 = adx * adx + adz * adz;
          if (ad2 < 1.6 && ad2 > 0.001) {
            const ad = Math.sqrt(ad2);
            desiredVx += (adx / ad) * 2.8;
            desiredVz += (adz / ad) * 2.8;
          }
        }

        const accel = 1 - Math.exp(-10 * dt);
        ally.vx += (desiredVx - ally.vx) * accel;
        ally.vz += (desiredVz - ally.vz) * accel;
        ally.yaw += normalizeAngleDiff(targetYaw, ally.yaw) * (1 - Math.exp(-10 * dt));
      }

      const nextPos = resolveActorPosition(ally.x + ally.vx * dt, ally.z + ally.vz * dt);
      ally.x = nextPos.x;
      ally.z = nextPos.z;
      const spd = Math.hypot(ally.vx, ally.vz);
      ally.walkPhase += spd * dt * 2.4;

      ally.rig.root.position.set(ally.x, 0, ally.z);
      ally.rig.root.rotation.set(0, ally.yaw, 0);

      const animPhase =
        ally.aiState === 'windup'
          ? 'windup'
          : ally.aiState === 'active'
            ? 'active'
            : ally.aiState === 'recover'
              ? 'recovery'
              : 'idle';
      this.animateFighterPose(
        ally.rig,
        ally.walkPhase,
        spd,
        animPhase,
        ally.aiTimer,
        spec.activeSec,
        0.32,
        0.48,
        ally.weapon,
        false,
        ally.staggerTimer > 0,
        false,
        0,
      );

      if (ally.rig.hpBarGroup && ally.rig.hpBarFill) {
        const hpRatio = Math.max(0.001, ally.hp / ally.maxHp);
        ally.rig.hpBarFill.scale.x = hpRatio;
        ally.rig.hpBarFill.position.x = -(1 - hpRatio) * 0.35;
        ally.rig.hpBarGroup.lookAt(this.camera.position);
      }
    }
  }

  private getEnemyTarget(enemy: EnemyActor): {
    type: 'player' | 'ally';
    ally: AllyActor | null;
    x: number;
    z: number;
    distSq: number;
  } {
    let bestType: 'player' | 'ally' = 'player';
    let bestAlly: AllyActor | null = null;
    let bestX = this.playerX;
    let bestZ = this.playerZ;
    let bestD2 = (this.playerX - enemy.x) ** 2 + (this.playerZ - enemy.z) ** 2;

    for (const ally of this.allies) {
      if (!ally.alive) continue;
      const d2 = (ally.x - enemy.x) ** 2 + (ally.z - enemy.z) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestType = 'ally';
        bestAlly = ally;
        bestX = ally.x;
        bestZ = ally.z;
      }
    }

    return {
      type: bestType,
      ally: bestAlly,
      x: bestX,
      z: bestZ,
      distSq: bestD2,
    };
  }

  private updateEnemies(dt: number): void {
    const waveCfg = buildWaveConfig(this.level, this.wave);

    const enemyTargets = new Map<
      string,
      { type: 'player' | 'ally'; ally: AllyActor | null; x: number; z: number; distSq: number }
    >();
    for (const e of this.enemies) {
      enemyTargets.set(e.id, this.getEnemyTarget(e));
    }

    // Evaluate Attack Token Pool so only 2-4 enemies swing simultaneously
    const tokenCandidates = this.enemies.map((e) => ({
      id: e.id,
      distSq: enemyTargets.get(e.id)?.distSq ?? 999,
      hasToken: e.aiState === 'windup' || e.aiState === 'active',
      alive: e.alive,
    }));
    const allowedTokens = evaluateAttackTokenPool(
      tokenCandidates,
      waveCfg.maxConcurrentAttackers,
    );

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        if (enemy.koTimer > 0) {
          enemy.koTimer -= dt;
          enemy.x += enemy.vx * dt;
          enemy.z += enemy.vz * dt;
          enemy.vx *= Math.exp(-6 * dt);
          enemy.vz *= Math.exp(-6 * dt);
          const pos = resolveActorPosition(enemy.x, enemy.z);
          enemy.x = pos.x;
          enemy.z = pos.z;
          enemy.rig.root.position.set(enemy.x, 0, enemy.z);
          enemy.rig.root.rotation.x = THREE.MathUtils.damp(
            enemy.rig.root.rotation.x,
            -Math.PI * 0.48,
            9,
            dt,
          );
          if (enemy.koTimer <= 0) {
            enemy.rig.root.visible = false;
          }
        }
        continue;
      }

      const tgt = enemyTargets.get(enemy.id)!;
      const dx = tgt.x - enemy.x;
      const dz = tgt.z - enemy.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const targetYaw = Math.atan2(dx, dz);

      if (enemy.petasanCooldown > 0) enemy.petasanCooldown -= dt;
      if (enemy.throwAnimTimer > 0) enemy.throwAnimTimer = Math.max(0, enemy.throwAnimTimer - dt);

      if (enemy.staggerTimer > 0) {
        enemy.staggerTimer -= dt;
        enemy.vx *= Math.exp(-7 * dt);
        enemy.vz *= Math.exp(-7 * dt);
        (enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
      } else {
        const spec = getEffectiveWeaponSpec(enemy.weapon, 2.8);
        const hasToken = allowedTokens.has(enemy.id);

        if (enemy.aiState === 'windup') {
          enemy.aiTimer -= dt;
          enemy.yaw += normalizeAngleDiff(targetYaw, enemy.yaw) * (1 - Math.exp(-10 * dt));
          enemy.vx *= Math.exp(-10 * dt);
          enemy.vz *= Math.exp(-10 * dt);
          const mat = enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.65 + Math.sin(performance.now() * 0.025) * 0.25;
          mat.color.setHex(enemy.archetype === 'pentolan' ? 0xef4444 : 0xf59e0b);

          if (enemy.aiTimer <= 0) {
            enemy.aiState = 'active';
            enemy.aiTimer = spec.activeSec;
            enemy.hasAttackHit = false;
            mat.opacity = 0;
            this.sound.playSwing(enemy.weapon);
            enemy.vx += Math.sin(enemy.yaw) * 4.2;
            enemy.vz += Math.cos(enemy.yaw) * 4.2;
          }
        } else if (enemy.aiState === 'active') {
          enemy.aiTimer -= dt;
          if (!enemy.hasAttackHit) {
            if (tgt.type === 'ally' && tgt.ally && tgt.ally.alive) {
              const hit = computeMeleeHit({
                attackerX: enemy.x,
                attackerZ: enemy.z,
                attackerYaw: enemy.yaw,
                targetX: tgt.ally.x,
                targetZ: tgt.ally.z,
                weapon: spec,
                targetBlocking: false,
                targetParryTimer: 0,
                comboCount: 0,
              });
              if (hit.hit) {
                enemy.hasAttackHit = true;
                this.sound.playHit(false);
                this.applyDamageToAlly(
                  tgt.ally,
                  Math.round(hit.damage * 0.55),
                  hit.knockbackX,
                  hit.knockbackZ,
                );
              }
            } else {
              const hit = computeMeleeHit({
                attackerX: enemy.x,
                attackerZ: enemy.z,
                attackerYaw: enemy.yaw,
                targetX: this.playerX,
                targetZ: this.playerZ,
                weapon: spec,
                targetBlocking: this.isBlocking,
                targetParryTimer: this.parryWindowTimer,
                comboCount: 0,
              });
              if (hit.hit && this.dodgeTimer <= 0) {
                enemy.hasAttackHit = true;
                if (hit.parried) {
                  this.sound.playBlock(true);
                  this.hitstopTimer = 0.065;
                  this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
                  enemy.staggerTimer = 0.85;
                  enemy.vx += hit.knockbackX * 1.4;
                  enemy.vz += hit.knockbackZ * 1.4;
                  this.score += 120;
                  this.setFeedback('TANGKISAN SEMPURNA!');
                  this.spawnBurstParticles(this.playerX, 1.25, this.playerZ, 16, 0x38bdf8, 6, 1.0, 8);
                } else {
                  const dmg = Math.round(hit.damage * 0.65);
                  this.applyDamageToPlayer(dmg, hit.knockbackX, hit.knockbackZ, hit.blocked);
                }
              }
            }
          }
          if (enemy.aiTimer <= 0) {
            enemy.aiState = 'recover';
            enemy.aiTimer = 0.55;
          }
        } else if (enemy.aiState === 'recover') {
          enemy.aiTimer -= dt;
          enemy.vx *= Math.exp(-10 * dt);
          enemy.vz *= Math.exp(-10 * dt);
          if (enemy.aiTimer <= 0) {
            enemy.aiState = enemy.archetype === 'petasan_kiter' ? 'kite' : 'approach';
          }
        } else {
          // 4 distinct movement policies by archetype
          let desiredVx = 0;
          let desiredVz = 0;

          if (enemy.archetype === 'petasan_kiter') {
            // Keeps 6-10m distance and throws petasan with warning ring!
            if (dist < 5.5) {
              desiredVx = -dirX * enemy.speed;
              desiredVz = -dirZ * enemy.speed;
            } else if (dist > 10.5) {
              desiredVx = dirX * enemy.speed;
              desiredVz = dirZ * enemy.speed;
            } else {
              desiredVx = -dirZ * enemy.orbitDir * enemy.speed * 0.7;
              desiredVz = dirX * enemy.orbitDir * enemy.speed * 0.7;
              if (enemy.petasanCooldown <= 0 && hasToken) {
                enemy.petasanCooldown = 4.2;
                enemy.throwAnimTimer = 0.38;
                this.sound.playThrowFuse();
                this.spawnPetasanBallistic(
                  'petasan_banting',
                  false,
                  enemy.x,
                  1.62,
                  enemy.z,
                  tgt.x,
                  tgt.z,
                );
              }
            }
          } else if (enemy.archetype === 'gir_spinner') {
            // Circles target before rushing in with wide gir_sabuk spin
            if (dist > 4.0) {
              desiredVx = (dirX * 0.75 - dirZ * enemy.orbitDir * 0.6) * enemy.speed;
              desiredVz = (dirZ * 0.75 + dirX * enemy.orbitDir * 0.6) * enemy.speed;
            } else if (hasToken && dist <= spec.reach * 0.95) {
              enemy.aiState = 'windup';
              enemy.aiTimer = 0.62;
              this.sound.playTelegraph();
            } else {
              desiredVx = -dirZ * enemy.orbitDir * enemy.speed * 0.85;
              desiredVz = dirX * enemy.orbitDir * enemy.speed * 0.85;
            }
          } else {
            // 'rusher' & 'pentolan': Aggressive direct pursuit + windup
            if (dist > spec.reach * 0.82) {
              desiredVx = dirX * enemy.speed;
              desiredVz = dirZ * enemy.speed;
            } else if (hasToken) {
              enemy.aiState = 'windup';
              enemy.aiTimer = enemy.archetype === 'pentolan' ? 0.52 : 0.46;
              this.sound.playTelegraph();
            } else {
              // Strafe waiting for attack token
              desiredVx = -dirZ * enemy.orbitDir * enemy.speed * 0.55;
              desiredVz = dirX * enemy.orbitDir * enemy.speed * 0.55;
            }
          }

          // Subtle separation force between enemies so crowds don't stack
          for (const other of this.enemies) {
            if (other === enemy || !other.alive) continue;
            const sdx = enemy.x - other.x;
            const sdz = enemy.z - other.z;
            const sd2 = sdx * sdx + sdz * sdz;
            if (sd2 < 1.3 && sd2 > 0.001) {
              const sd = Math.sqrt(sd2);
              desiredVx += (sdx / sd) * 2.5;
              desiredVz += (sdz / sd) * 2.5;
            }
          }

          const accel = 1 - Math.exp(-10 * dt);
          enemy.vx += (desiredVx - enemy.vx) * accel;
          enemy.vz += (desiredVz - enemy.vz) * accel;
          enemy.yaw += normalizeAngleDiff(targetYaw, enemy.yaw) * (1 - Math.exp(-10 * dt));
        }
      }

      const nextPos = resolveActorPosition(
        enemy.x + enemy.vx * dt,
        enemy.z + enemy.vz * dt,
      );
      enemy.x = nextPos.x;
      enemy.z = nextPos.z;
      const spd = Math.hypot(enemy.vx, enemy.vz);
      enemy.walkPhase += spd * dt * 2.4;

      enemy.rig.root.position.set(enemy.x, 0, enemy.z);
      enemy.rig.root.rotation.set(0, enemy.yaw, 0);

      const enemySpec = getEffectiveWeaponSpec(enemy.weapon, 2.8);
      const animPhase =
        enemy.aiState === 'windup'
          ? 'windup'
          : enemy.aiState === 'active'
            ? 'active'
            : enemy.aiState === 'recover'
              ? 'recovery'
              : 'idle';
      this.animateFighterPose(
        enemy.rig,
        enemy.walkPhase,
        spd,
        animPhase,
        enemy.aiTimer,
        enemySpec.activeSec,
        enemySpec.windupSec,
        0.55,
        enemy.weapon,
        false,
        enemy.staggerTimer > 0,
        false,
        enemy.throwAnimTimer,
      );

      if (enemy.girVisual && enemy.rig.girAnchor) {
        enemy.rig.root.updateMatrixWorld(true);
        enemy.rig.girAnchor.getWorldPosition(_v3);
        enemy.girVisual.update({
          dt,
          anchorPos: _v3,
          fighterX: enemy.x,
          fighterZ: enemy.z,
          fighterYaw: enemy.yaw,
          lengthMeters: 2.8,
          attackPhase: animPhase,
          attackTimer: enemy.aiTimer,
          windupSec: enemySpec.windupSec,
          activeSec: enemySpec.activeSec,
          recoverySec: 0.55,
          isTitlePreview: false,
          simTime: this.simTime,
        });
      }

      if (enemy.rig.hpBarGroup && enemy.rig.hpBarFill) {
        const hpRatio = Math.max(0.001, enemy.hp / enemy.maxHp);
        enemy.rig.hpBarFill.scale.x = hpRatio;
        enemy.rig.hpBarFill.position.x = -(1 - hpRatio) * 0.4;
        enemy.rig.hpBarGroup.lookAt(this.camera.position);
      }
    }
  }

  private applyDamageToPlayer(
    dmg: number,
    kbX: number,
    kbZ: number,
    blocked: boolean,
  ): void {
    this.playerHp = Math.max(0, this.playerHp - dmg);
    this.damageTaken += dmg;
    this.playerVx += kbX;
    this.playerVz += kbZ;

    if (blocked) {
      this.sound.playBlock(false);
      this.playerStamina = Math.max(0, this.playerStamina - 12);
      this.setFeedback(`BLOK -${dmg}`);
      this.spawnBurstParticles(this.playerX, 1.2, this.playerZ, 8, 0x94a3b8, 4.5, 0.8, 10);
    } else {
      this.sound.playHit(true);
      this.playerHitFlash = 0.08;
      this.playerStagger = 0.24;
      this.combo = 0;
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.045);
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.48);
      this.setFeedback(`TERKENA -${dmg}`);
      this.spawnBurstParticles(this.playerX, 1.15, this.playerZ, 12, 0xef4444, 5, 1.0, 14);
    }

    if (this.playerHp <= 0 && this.gameOverDelayTimer <= 0) {
      this.gameOverDelayTimer = 0.65;
      this.sound.playDefeat();
    }
    if (this.netMode && this.playerHp <= 0 && !this.netSelfKoAnnounced) {
      this.netSelfKoAnnounced = true;
      this.onNetSend?.({ t: 'ko' });
    }
    this.emitHud();
  }

  private spawnBlastVisual(
    x: number,
    z: number,
    blastRadius: number,
    isBig: boolean,
    isRoman: boolean,
    leaveScorch: boolean,
  ): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    this.scene.add(group);

    // 1. Bright core fireball sphere
    const fireball = new THREE.Mesh(
      this.blastSphereGeo,
      new THREE.MeshBasicMaterial({
        color: isRoman ? 0xfef08a : 0xffedd5,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    fireball.position.y = 0.28;
    fireball.scale.setScalar(0.18);
    group.add(fireball);

    // 2. Ground radial shockwave ring
    const shockwave = new THREE.Mesh(
      this.blastRingGeo,
      new THREE.MeshBasicMaterial({
        color: isRoman ? 0xfbbf24 : 0xf97316,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    shockwave.rotation.x = -Math.PI * 0.5;
    shockwave.position.y = 0.04;
    shockwave.scale.setScalar(0.25);
    group.add(shockwave);

    // 3. Billowing gunpowder smoke puffs
    const puffCount = isBig ? 6 : 4;
    const smokePuffs: BlastVisual['smokePuffs'] = [];
    for (let i = 0; i < puffCount; i++) {
      const a = (i / puffCount) * Math.PI * 2 + Math.random() * 0.5;
      const puffMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x52525b : 0x71717a,
        roughness: 0.95,
        metalness: 0.0,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(this.blastSphereGeo, puffMat);
      puff.position.set(Math.cos(a) * 0.22, 0.2 + Math.random() * 0.18, Math.sin(a) * 0.22);
      puff.scale.setScalar(0.24);
      group.add(puff);
      smokePuffs.push({
        mesh: puff,
        vx: Math.cos(a) * (1.2 + Math.random() * 1.4),
        vy: 1.5 + Math.random() * 1.6,
        vz: Math.sin(a) * (1.2 + Math.random() * 1.4),
        maxScale: (isBig ? 0.92 : 0.65) + Math.random() * 0.35,
      });
    }

    // 4. Lingering asphalt soot scorch decal
    let scorch: THREE.Mesh | null = null;
    if (leaveScorch) {
      scorch = new THREE.Mesh(
        this.scorchGeo,
        new THREE.MeshBasicMaterial({
          map: this.scorchTex,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      );
      scorch.rotation.x = -Math.PI * 0.5;
      scorch.position.set(x, 0.02, z);
      scorch.scale.setScalar(blastRadius * 0.42);
      this.scene.add(scorch);
    }

    this.blasts.push({
      group,
      fireball,
      shockwave,
      smokePuffs,
      scorch,
      age: 0,
      duration: leaveScorch ? 4.0 : 1.05,
      blastRadius,
    });
  }

  private updateBlasts(dt: number): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.age += dt;
      if (b.age >= b.duration) {
        this.disposeBlastVisual(b);
        this.blasts.splice(i, 1);
        continue;
      }

      // Fireball expands fast then dissipates over 0.24s
      const fireT = Math.min(1, b.age / 0.24);
      if (fireT < 1) {
        const easeOut = 1 - (1 - fireT) * (1 - fireT);
        b.fireball.scale.setScalar(0.18 + easeOut * b.blastRadius * 0.38);
        const fMat = b.fireball.material as THREE.MeshBasicMaterial;
        fMat.opacity = (1 - fireT) * 0.92;
        if (fireT > 0.35) fMat.color.setHex(0xff6b00);
      } else {
        b.fireball.visible = false;
      }

      // Shockwave ring expands across blast radius over 0.32s
      const ringT = Math.min(1, b.age / 0.32);
      if (ringT < 1) {
        const ringEase = 1 - (1 - ringT) * (1 - ringT);
        b.shockwave.scale.setScalar(0.25 + ringEase * b.blastRadius * 1.08);
        (b.shockwave.material as THREE.MeshBasicMaterial).opacity = (1 - ringT) * 0.8;
      } else {
        b.shockwave.visible = false;
      }

      // Smoke plumes rise, billow and fade over 0.95s
      const smokeT = Math.min(1, b.age / 0.95);
      for (const sp of b.smokePuffs) {
        if (smokeT < 1) {
          sp.mesh.position.x += sp.vx * dt * (1 - smokeT * 0.7);
          sp.mesh.position.y += sp.vy * dt * (1 - smokeT * 0.45);
          sp.mesh.position.z += sp.vz * dt * (1 - smokeT * 0.7);
          const s = THREE.MathUtils.lerp(0.24, sp.maxScale, Math.sqrt(smokeT));
          sp.mesh.scale.setScalar(s);
          (sp.mesh.material as THREE.MeshStandardMaterial).opacity = (1 - smokeT) * 0.62;
        } else {
          sp.mesh.visible = false;
        }
      }

      // Scorch mark fades gently during the final 1.2s
      if (b.scorch) {
        const rem = b.duration - b.age;
        const scMat = b.scorch.material as THREE.MeshBasicMaterial;
        scMat.opacity = rem < 1.2 ? (rem / 1.2) * 0.75 : 0.75;
      }
    }
  }

  private updatePetasans(dt: number): void {
    for (let i = this.petasans.length - 1; i >= 0; i--) {
      const p = this.petasans[i];
      p.age += dt;
      p.vy -= 15.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      if (p.y <= 0.11) {
        p.y = 0.11;
        if (p.throwableId === 'petasan_banting' && p.age >= 0.16) {
          // Petasan banting detonates crisply on ground impact
          p.fuseTimer = 0;
        } else {
          if (!p.hasBounced) {
            p.hasBounced = true;
            this.spawnBurstParticles(p.x, 0.14, p.z, 5, 0xfbbf24, 3.6, 0.7, 10);
          }
          p.vy = Math.abs(p.vy) * 0.36;
          p.vx *= 0.58;
          p.vz *= 0.58;
        }
      }

      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.x += dt * p.spinX;
      p.mesh.rotation.z += dt * p.spinZ;

      // Keep target marker anchored cleanly & pulse subtly
      p.ring.position.set(p.hasBounced ? p.x : p.targetX, 0.03, p.hasBounced ? p.z : p.targetZ);
      const fusePct = 1 - Math.max(0, Math.min(1, p.fuseTimer / Math.max(0.1, p.maxFuse)));
      const pulse = p.fromPlayer
        ? 0.9 + Math.sin(p.age * 16) * 0.1
        : 0.92 + Math.sin(p.age * (14 + fusePct * 24)) * 0.08;
      p.ring.scale.setScalar(pulse);
      (p.ring.material as THREE.MeshBasicMaterial).opacity = p.fromPlayer
        ? 0.2 + fusePct * 0.22
        : 0.28 + fusePct * 0.45;

      // Burning fuse spark & wispy smoke trail from projectile tip
      _v1.set(0, 0.16, 0).applyEuler(p.mesh.rotation).add(p.mesh.position);
      this.spawnBurstParticles(_v1.x, _v1.y, _v1.z, 2, 0xffd166, 3.0, 0.72, 6);
      if (Math.random() < 0.85) {
        this.spawnBurstParticles(_v1.x, _v1.y, _v1.z, 1, 0xd4d4d8, 1.0, 0.95, -2.5);
      }

      p.fuseTimer -= dt;
      if (p.fuseTimer <= 0) {
        const isFirstBurst = p.burstsLeft === THROWABLE_SPECS[p.throwableId].burstCount;
        this.detonatePetasan(p, isFirstBurst);
        p.burstsLeft -= 1;
        if (p.burstsLeft > 0) {
          p.fuseTimer = p.burstDelay;
          p.vx = (Math.random() - 0.5) * 2.4;
          p.vz = (Math.random() - 0.5) * 2.4;
          p.vy = 3.8;
          p.hasBounced = true;
        } else {
          this.scene.remove(p.mesh);
          this.scene.remove(p.ring);
          this.petasans.splice(i, 1);
        }
      }
    }
  }

  private detonatePetasan(p: ActivePetasan, isFirstBurst: boolean): void {
    const spec = THROWABLE_SPECS[p.throwableId];
    const isBig = p.throwableId === 'petasan_banting';
    const isRoman = p.throwableId === 'petasan_roman';
    this.sound.playPetasanBoom(isBig);

    this.activeBlastLight.position.set(p.x, 1.35, p.z);
    this.blastLightTimer = isBig ? 0.28 : 0.18;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + (isBig ? 0.6 : 0.32));
    this.hitstopTimer = Math.max(this.hitstopTimer, isBig ? 0.05 : 0.02);

    this.spawnBlastVisual(p.x, p.z, spec.blastRadius, isBig, isRoman, isFirstBurst);

    // Hot flying embers
    this.spawnBurstParticles(p.x, 0.25, p.z, isBig ? 24 : 14, 0xff9f1c, 11, 1.35, 11);
    // Shredded red & gold firecracker paper scraps fluttering outward
    this.spawnBurstParticles(p.x, 0.3, p.z, isBig ? 12 : 6, 0xdc2626, 7.5, 1.15, 5.5);
    this.spawnBurstParticles(p.x, 0.3, p.z, isBig ? 8 : 5, 0xfacc15, 6.8, 0.95, 5.5);

    // Roman candle shoots bright colored vertical fountain sparks
    if (isRoman) {
      const colors = [0xff595e, 0xffca3a, 0x38bdf8];
      const c = colors[p.burstsLeft % colors.length];
      for (let k = 0; k < 14; k++) {
        const pt = this.particles[this.particleCursor];
        this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.random() * 2.4;
        pt.active = true;
        pt.x = p.x;
        pt.y = p.y + 0.12;
        pt.z = p.z;
        pt.vx = Math.cos(angle) * spread;
        pt.vy = 7.5 + Math.random() * 5.0;
        pt.vz = Math.sin(angle) * spread;
        pt.maxLife = 0.35 + Math.random() * 0.28;
        pt.life = pt.maxLife;
        pt.size = 1.15;
        pt.color.setHex(c);
        pt.gravity = 13;
      }
    }

    if (this.gameState !== 'playing') {
      this.emitHud();
      return;
    }

    if (p.fromPlayer) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const res = computeExplosionDamage(p.x, p.z, enemy.x, enemy.z, spec);
        if (res.hit) {
          enemy.hp = Math.max(0, enemy.hp - res.damage);
          enemy.vx += res.knockbackX;
          enemy.vz += res.knockbackZ;
          enemy.staggerTimer = Math.max(enemy.staggerTimer, res.staggerSec);
          enemy.hitFlashTimer = 0.09;
          enemy.aiState = 'approach';
          (enemy.rig.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;

          this.combo += 1;
          this.comboTimer = 2.8;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.score += res.damage * 12;

          if (enemy.hp <= 0) {
            this.handleEnemyKO(enemy);
          } else {
            this.setFeedback(`LEDAKAN PETASAN -${res.damage}`);
          }
        }
      }
    } else {
      if (this.dodgeTimer <= 0) {
        const res = computeExplosionDamage(p.x, p.z, this.playerX, this.playerZ, spec);
        if (res.hit) {
          const dmg = this.isBlocking ? Math.round(res.damage * 0.4) : Math.round(res.damage * 0.6);
          this.applyDamageToPlayer(dmg, res.knockbackX * 0.8, res.knockbackZ * 0.8, this.isBlocking);
        }
      }
      for (const ally of this.allies) {
        if (!ally.alive) continue;
        const aRes = computeExplosionDamage(p.x, p.z, ally.x, ally.z, spec);
        if (aRes.hit) {
          this.applyDamageToAlly(
            ally,
            Math.round(aRes.damage * 0.55),
            aRes.knockbackX * 0.75,
            aRes.knockbackZ * 0.75,
          );
          ally.staggerTimer = Math.max(ally.staggerTimer, aRes.staggerSec);
        }
      }
    }
    this.emitHud();
  }

  private animateIdlePose(rig: FighterRig, t: number): void {
    const breath = Math.sin(t) * 0.03;
    rig.torso.rotation.set(0.05 + breath, 0, 0);
    rig.leftShoulder.rotation.set(-0.35, 0, -0.18);
    rig.leftElbow.rotation.x = -0.85;
    rig.rightShoulder.rotation.set(0.25, 0, 0.2);
    rig.rightElbow.rotation.x = -0.6;
    rig.leftHip.rotation.x = -0.08;
    rig.rightHip.rotation.x = 0.08;
    rig.leftKnee.rotation.x = 0.12;
    rig.rightKnee.rotation.x = 0.06;
  }

  private animateFighterPose(
    rig: FighterRig,
    walkPhase: number,
    speed: number,
    attackPhase: 'idle' | 'windup' | 'active' | 'recovery',
    attackTimer: number,
    activeDuration: number,
    windupDuration: number,
    recoveryDuration: number,
    weapon: WeaponId,
    blocking: boolean,
    staggered: boolean,
    dodging: boolean,
    throwTimer = 0,
  ): void {
    const walkWeight = Math.min(1, speed / 4.2);
    const swing = Math.sin(walkPhase) * 0.65 * walkWeight;
    rig.leftHip.rotation.x = swing;
    rig.rightHip.rotation.x = -swing;
    rig.leftKnee.rotation.x = Math.max(0, -swing * 0.7) + 0.08;
    rig.rightKnee.rotation.x = Math.max(0, swing * 0.7) + 0.08;

    if (dodging) {
      rig.torso.rotation.set(0.55, 0, 0);
      rig.leftShoulder.rotation.set(-0.8, 0, -0.3);
      rig.rightShoulder.rotation.set(-0.8, 0, 0.3);
      return;
    }

    if (staggered) {
      rig.torso.rotation.set(-0.32, 0, 0);
      rig.leftShoulder.rotation.set(-0.3, 0, -0.5);
      rig.rightShoulder.rotation.set(-0.3, 0, 0.5);
      return;
    }

    if (throwTimer > 0) {
      const tp = 1 - Math.min(1, throwTimer / 0.38);
      if (tp < 0.26) {
        // Windup: raise left arm forward & overhead behind the shoulder
        const w = tp / 0.26;
        rig.torso.rotation.set(
          THREE.MathUtils.lerp(0.08, -0.2, w),
          THREE.MathUtils.lerp(0, 0.62, w),
          THREE.MathUtils.lerp(0, 0.1, w),
        );
        rig.leftShoulder.rotation.set(
          THREE.MathUtils.lerp(-0.35, -3.83, w),
          THREE.MathUtils.lerp(0, -0.18, w),
          THREE.MathUtils.lerp(-0.2, -0.38, w),
        );
        rig.leftElbow.rotation.x = THREE.MathUtils.lerp(-0.85, -0.95, w);
        rig.rightShoulder.rotation.set(THREE.MathUtils.lerp(0.15, -0.38, w), 0, 0.3);
        rig.rightElbow.rotation.x = -0.7;
      } else if (tp < 0.58) {
        // Whip overhead forward & release at peak forward swing
        const w = (tp - 0.26) / 0.32;
        rig.torso.rotation.set(
          THREE.MathUtils.lerp(-0.2, 0.36, w),
          THREE.MathUtils.lerp(0.62, -0.58, w),
          THREE.MathUtils.lerp(0.1, -0.1, w),
        );
        rig.leftShoulder.rotation.set(
          THREE.MathUtils.lerp(-3.83, -1.05, w),
          THREE.MathUtils.lerp(-0.18, 0.18, w),
          THREE.MathUtils.lerp(-0.38, -0.1, w),
        );
        rig.leftElbow.rotation.x = THREE.MathUtils.lerp(-0.95, -0.16, w);
        rig.rightShoulder.rotation.set(0.32, 0, 0.3);
        rig.rightElbow.rotation.x = -0.65;
      } else {
        // Follow-through recovery back to ready combat stance
        const w = (tp - 0.58) / 0.42;
        rig.torso.rotation.set(
          THREE.MathUtils.lerp(0.36, 0.08, w),
          THREE.MathUtils.lerp(-0.58, 0, w),
          THREE.MathUtils.lerp(-0.1, 0, w),
        );
        rig.leftShoulder.rotation.set(
          THREE.MathUtils.lerp(-1.05, -0.35, w),
          THREE.MathUtils.lerp(0.18, 0, w),
          THREE.MathUtils.lerp(-0.1, -0.2, w),
        );
        rig.leftElbow.rotation.x = THREE.MathUtils.lerp(-0.16, -0.85, w);
        rig.rightShoulder.rotation.set(0.2, 0, 0.22);
        rig.rightElbow.rotation.x = -0.65;
      }
      return;
    }

    if (blocking) {
      rig.torso.rotation.set(0.14, -0.25, 0);
      rig.leftShoulder.rotation.set(-1.1, 0.4, -0.15);
      rig.leftElbow.rotation.x = -1.2;
      rig.rightShoulder.rotation.set(-0.95, -0.4, 0.25);
      rig.rightElbow.rotation.x = -1.1;
      return;
    }

    if (attackPhase === 'windup') {
      if (weapon === 'gir_sabuk') {
        const rawW = 1 - Math.max(0, Math.min(1, attackTimer / Math.max(0.05, windupDuration)));
        const wp = rawW * rawW * (3 - 2 * rawW);
        // Smooth C0-continuous draw back from ready stance to cocked windup peak
        rig.torso.rotation.set(
          THREE.MathUtils.lerp(0.08, -0.14, wp),
          THREE.MathUtils.lerp(0, 0.72, wp),
          THREE.MathUtils.lerp(0, 0.08, wp),
        );
        rig.rightShoulder.rotation.set(
          THREE.MathUtils.lerp(0.15, -1.45, wp),
          THREE.MathUtils.lerp(0, -0.35, wp),
          THREE.MathUtils.lerp(0.22, 1.25, wp),
        );
        rig.rightElbow.rotation.x = THREE.MathUtils.lerp(-0.65, -0.45, wp);
        rig.leftShoulder.rotation.set(
          THREE.MathUtils.lerp(-0.35, -0.58, wp),
          THREE.MathUtils.lerp(0, 0.24, wp),
          THREE.MathUtils.lerp(-0.2, -0.36, wp),
        );
      } else {
        rig.torso.rotation.set(-0.14, 0.45, 0);
        rig.rightShoulder.rotation.set(-2.2, -0.25, 0.45);
        rig.rightElbow.rotation.x = -0.45;
        rig.leftShoulder.rotation.set(-0.6, 0.2, -0.3);
      }
      return;
    }

    if (attackPhase === 'active') {
      const sweepProgress = Math.max(
        0,
        Math.min(1, 1 - attackTimer / Math.max(0.05, activeDuration)),
      );
      if (weapon === 'gir_sabuk') {
        const sp = sweepProgress * sweepProgress * (3 - 2 * sweepProgress);
        // Continuous smooth rotational whip starting seamlessly from windup end
        rig.torso.rotation.set(
          THREE.MathUtils.lerp(-0.14, 0.2, sp),
          THREE.MathUtils.lerp(0.72, -1.15, sp),
          THREE.MathUtils.lerp(0.08, -0.1, sp),
        );
        rig.rightShoulder.rotation.set(
          THREE.MathUtils.lerp(-1.45, -1.15, sp),
          THREE.MathUtils.lerp(-0.35, 0.55, sp),
          THREE.MathUtils.lerp(1.25, -0.75, sp),
        );
        rig.rightElbow.rotation.x = THREE.MathUtils.lerp(-0.45, -0.18, sp);
        rig.leftShoulder.rotation.set(
          THREE.MathUtils.lerp(-0.58, -0.5, sp),
          THREE.MathUtils.lerp(0.24, -0.18, sp),
          THREE.MathUtils.lerp(-0.36, -0.42, sp),
        );
      } else {
        rig.torso.rotation.set(0.28, -0.65, 0);
        rig.rightShoulder.rotation.set(-0.2 + sweepProgress * 0.6, 0.5, 0.2);
        rig.rightElbow.rotation.x = -0.15;
      }
      return;
    }

    if (attackPhase === 'recovery') {
      if (weapon === 'gir_sabuk') {
        const rawR =
          1 - Math.max(0, Math.min(1, attackTimer / Math.max(0.05, recoveryDuration)));
        const rp = rawR * rawR * (3 - 2 * rawR);
        // Smooth follow-through easing cleanly back into ready combat stance
        rig.torso.rotation.set(
          THREE.MathUtils.lerp(0.2, 0.08, rp),
          THREE.MathUtils.lerp(-1.15, 0, rp),
          THREE.MathUtils.lerp(-0.1, 0, rp),
        );
        rig.rightShoulder.rotation.set(
          THREE.MathUtils.lerp(-1.15, 0.15, rp),
          THREE.MathUtils.lerp(0.55, 0, rp),
          THREE.MathUtils.lerp(-0.75, 0.22, rp),
        );
        rig.rightElbow.rotation.x = THREE.MathUtils.lerp(-0.18, -0.65, rp);
        rig.leftShoulder.rotation.set(
          THREE.MathUtils.lerp(-0.5, -0.35, rp),
          THREE.MathUtils.lerp(-0.18, 0, rp),
          THREE.MathUtils.lerp(-0.42, -0.2, rp),
        );
      } else {
        rig.torso.rotation.set(0.15, -0.2, 0);
        rig.rightShoulder.rotation.set(-0.35, 0, 0.2);
        rig.rightElbow.rotation.x = -0.55;
      }
      return;
    }

    // Default run / ready combat stance
    rig.torso.rotation.set(0.08 + walkWeight * 0.1, 0, 0);
    rig.leftShoulder.rotation.set(-swing * 0.7 - 0.35, 0, -0.2);
    rig.leftElbow.rotation.x = -0.85;
    rig.rightShoulder.rotation.set(swing * 0.5 + 0.15, 0, 0.22);
    rig.rightElbow.rotation.x = -0.65;
  }

  private updateParticles(dt: number): void {
    let anyUpdated = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyUpdated = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy = Math.abs(p.vy) * 0.35;
      }
      const scale = p.size * (p.life / p.maxLife);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(Math.max(0.01, scale));
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (anyUpdated) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private updateCamera(dt: number): void {
    const dampK = 1 - Math.exp(-7.5 * dt);

    if (this.netMode && this.remoteRig) {
      // Kamera duel: bingkai kedua petarung, mundur kalau mereka berjauhan.
      const midX = (this.playerX + this.remoteX) * 0.5;
      const midZ = (this.playerZ + this.remoteZ) * 0.5;
      const sep = Math.hypot(this.playerX - this.remoteX, this.playerZ - this.remoteZ);
      const back = Math.min(15, 7.6 + sep * 0.62);
      _v1.set(
        THREE.MathUtils.clamp(midX * 0.75, -6.5, 6.5),
        4.3 + sep * 0.1,
        Math.min(ARENA_BOUNDS.maxZ + 8.5, midZ + back),
      );
      _v2.set(midX * 0.85, 1.15, midZ - 0.8);
      this.camPos.lerp(_v1, dampK * 0.85);
      this.camLook.lerp(_v2, dampK);
    } else {
      const lenExtra =
        this.activeWeapon === 'gir_sabuk'
          ? ((clampGirLength(this.charConfig.girLengthMeters) - 2) / 4) * 1.8
          : 0;
      const desiredX = THREE.MathUtils.clamp(this.playerX * 0.7, -5.5, 5.5);
      const desiredY = 4.9 + lenExtra * 0.5;
      const desiredZ = Math.min(ARENA_BOUNDS.maxZ + 7.5, this.playerZ + 8.2 + lenExtra);

      _v1.set(desiredX, desiredY, desiredZ);
      _v2.set(this.playerX * 0.8, 1.15, this.playerZ - 2.2);

      this.camPos.lerp(_v1, dampK);
      this.camLook.lerp(_v2, dampK);
    }

    // Trauma^2 camera shake
    const shake = this.cameraTrauma * this.cameraTrauma;
    const shakeX = (Math.random() - 0.5) * 0.65 * shake;
    const shakeY = (Math.random() - 0.5) * 0.55 * shake;

    this.camera.position.set(
      this.camPos.x + shakeX,
      this.camPos.y + shakeY,
      this.camPos.z,
    );
    this.camera.lookAt(this.camLook);
  }

  private finishRun(victory: boolean): void {
    this.isVictory = victory;
    if (victory && !this.netMode) {
      // Selesaikan map ini → buka level berikutnya (disimpan di HP).
      this.unlockedLevel = Math.max(this.unlockedLevel, unlockNextLevel(this.level.id));
    }
    if (!this.netMode && this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(this.bestScore));
      } catch {
        // Ignore
      }
    }
    if (victory) this.sound.playWaveCue(true);
    this.setBodyState('gameover');
    this.emitHud();
  }

  private emitHud(): void {
    this.onHudUpdate({
      state: this.gameState,
      introBeat: this.introBeat,
      introTotalBeats: 4,
      hp: Math.round(this.playerHp),
      maxHp: this.playerMaxHp,
      ghostHp: Math.round(this.playerGhostHp),
      stamina: Math.round(this.playerStamina),
      maxStamina: this.playerMaxStamina,
      ammoPetasan: this.ammoPetasan,
      maxPetasan: this.maxPetasan,
      petasanCooldown: Number(this.petasanCooldown.toFixed(1)),
      activeWeapon: this.activeWeapon,
      activeThrowable: this.activeThrowable,
      girLengthMeters: clampGirLength(this.charConfig.girLengthMeters),
      wave: this.wave,
      maxWaves: this.maxWaves,
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      combo: this.combo,
      comboTimer: this.comboTimer,
      enemiesAlive: this.enemies.filter((e) => e.alive).length,
      enemiesTotalInWave: this.enemiesTotalInWave,
      alliesAlive: this.allies.filter((a) => a.alive).length,
      alliesTotal: this.allies.length,
      defeatedCount: this.defeatedCount,
      maxCombo: this.maxCombo,
      damageTaken: Math.round(this.damageTaken),
      isVictory: this.isVictory,
      hitFeedbackLabel: this.hitFeedbackTimer > 0 ? this.hitFeedbackLabel : '',
      isBlocking: this.isBlocking,
      parryFlashTimer: this.parryWindowTimer,
      waveBannerText: this.waveBannerTimer > 0 ? this.waveBannerText : '',
      net: this.netMode
        ? {
            role: this.netRole,
            peerName: this.netPeerName,
            peerHp: Math.round(this.remoteHp),
            peerMaxHp: this.remoteMaxHp,
          }
        : null,
      level: this.level.id,
      mapName: this.level.nama,
      maxLevel: MAX_LEVEL,
      unlockedLevel: this.unlockedLevel,
    });
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;

      this.update(rawDt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      return;
    }

    if (this.gameState === 'playing') {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        if (e.code === 'KeyJ') this.triggerAttack();
        else if (e.code === 'KeyL' || e.code === 'KeyE') this.triggerThrowPetasan();
        else if (e.code === 'Space') this.triggerDodge();
        else if (e.code === 'KeyK' || e.code === 'ShiftLeft') {
          this.parryWindowTimer = 0.22;
        } else if (e.code === 'Digit1') this.switchWeapon(WEAPON_ORDER[0]);
        else if (e.code === 'Digit2') this.switchWeapon(WEAPON_ORDER[1]);
        else if (e.code === 'Digit3') this.switchWeapon(WEAPON_ORDER[2]);
        else if (e.code === 'Digit4') this.switchWeapon(WEAPON_ORDER[3]);
        else if (e.code === 'Escape' || e.code === 'KeyP') this.pauseGame();
      }
      this.keysHeld.add(e.code);
    } else if (this.gameState === 'intro') {
      if (!e.repeat && performance.now() - this.introStartedAt > 180) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this.advanceIntroBeat();
        } else if (e.code === 'Escape') {
          e.preventDefault();
          this.skipIntro();
        }
      }
    } else if (this.gameState === 'paused') {
      if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
        this.resumeGame();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.gameState !== 'playing') return;
    if (e.target !== this.renderer.domElement) return;
    if (e.button === 0) {
      this.triggerAttack();
    } else if (e.button === 2) {
      this.parryWindowTimer = 0.22;
      this.touchBlocking = true;
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.button === 2) {
      this.touchBlocking = false;
    }
  };

  private handleContextMenu = (e: MouseEvent): void => {
    if (this.gameState === 'playing') {
      e.preventDefault();
    }
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchBlocking = false;
  };

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleBlur);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  // ============================================================
  // MAP / LEVEL
  // ============================================================

  /** Bangun ulang environment sesuai level aktif (dipakai saat ganti map). */
  private buildEnvironmentForLevel(): void {
    if (this.envGroup) {
      this.scene.remove(this.envGroup);
      this.envGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
          const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        }
      });
      this.envGroup = null;
    }
    this.envDisposables.forEach((d) => d.dispose());
    this.envDisposables = [];

    const env = buildStreetEnvironment(this.renderer, this.isSoftwareGl, this.level);
    this.scene.add(env.group);
    this.envGroup = env.group;
    this.envDisposables = env.disposables;

    this.applyLevelTheme();
  }

  /** Terapkan langit, kabut, dan pencahayaan khas map ini. */
  private applyLevelTheme(): void {
    const t = this.level.theme;

    this.scene.background = new THREE.Color(t.sky);

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(t.sky);
      this.scene.fog.density = t.fogDensity;
    } else {
      this.scene.fog = new THREE.FogExp2(t.sky, t.fogDensity);
    }

    if (this.hemiLight) {
      this.hemiLight.color.setHex(t.hemiSky);
      this.hemiLight.groundColor.setHex(t.hemiGround);
      this.hemiLight.intensity = t.hemiIntensity;
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(t.sunColor);
      this.sunLight.intensity = t.sunIntensity;
      this.sunLight.position.set(t.sunPosition[0], t.sunPosition[1], t.sunPosition[2]);
    }
    if (this.rimLight) {
      this.rimLight.color.setHex(t.rimColor);
      this.rimLight.intensity = t.rimIntensity;
    }
  }

  /** Level yang sedang dipilih (1–10). */
  public getSelectedLevel(): number {
    return this.levelId;
  }

  /** Level tertinggi yang sudah terbuka. */
  public getUnlockedLevel(): number {
    return this.unlockedLevel;
  }

  /**
   * Langsung mulai map tertentu (dipakai tombol "Lanjut ke Map N" setelah menang).
   * Level ini sekaligus dibuka & disimpan, jadi progres tidak bisa "nyangkut".
   */
  public startLevel(id: number): void {
    const target = clampLevelId(id);
    this.unlockedLevel = Math.max(this.unlockedLevel, target);
    saveUnlockedLevel(this.unlockedLevel);

    if (target !== this.levelId) {
      this.levelId = target;
      this.level = getLevel(target);
      this.maxWaves = this.level.waveCount;
      this.buildEnvironmentForLevel();
    }
    this.startGame();
  }

  /** Pilih level dari layar judul. Level yang masih terkunci akan diabaikan. */
  public setLevel(id: number): void {
    const clamped = Math.min(clampLevelId(id), this.unlockedLevel);
    if (clamped === this.levelId) {
      this.emitHud();
      return;
    }
    this.levelId = clamped;
    this.level = getLevel(clamped);
    this.maxWaves = this.level.waveCount;

    if (this.renderer && this.scene) {
      this.buildEnvironmentForLevel();
      if (this.playerRig) {
        this.playerRig.root.position.set(0, 0, 6);
        this.playerRig.root.rotation.set(0, 0.2, 0);
      }
    }
    this.emitHud();
  }

  // ============================================================
  // MABAR ONLINE (duel 1v1)
  // ============================================================

  private setupRemoteFighter(profile?: MabarProfile): void {
    this.clearRemoteFighter();
    this.remoteWeapon = profile?.weapon ?? this.activeWeapon;
    this.remoteGirLength = clampGirLength(profile?.girLength ?? this.charConfig.girLengthMeters);
    const remoteConfig: CharacterConfig = {
      ...this.charConfig,
      name: this.netPeerName || 'Lawan',
      primaryWeapon: this.remoteWeapon,
      girLengthMeters: this.remoteGirLength,
      jacketColor: profile ? jacketColorForHue(profile.hue) : '#3f3f46',
    };
    const rig = buildFighterRig(remoteConfig, false);
    rig.root.position.set(0, 0, -3);
    rig.root.rotation.set(0, 0, 0);
    this.scene.add(rig.root);
    if (rig.hpBarGroup) rig.hpBarGroup.visible = false;
    rig.telegraphRing.visible = false;
    this.remoteRig = rig;

    this.remoteX = 0;
    this.remoteZ = -3;
    this.remoteTargetX = 0;
    this.remoteTargetZ = -3;
    this.remoteYaw = 0;
    this.remoteTargetYaw = 0;
    this.remoteSpeed = 0;
    this.remoteWalkPhase = 0;
    this.remoteMaxHp = this.playerMaxHp;
    this.remoteHp = this.remoteMaxHp;
    this.remoteAttackPhase = 'idle';
    this.remoteAttackTimer = 0;
    this.remoteBlocking = false;
    this.remoteHitFlash = 0;
    this.lastRemoteStateAt = 0;
    this.animateIdlePose(rig, 0);

    // Sabuk gir lawan tetap terlihat panjang & lentur seperti aslinya.
    if (this.remoteWeapon === 'gir_sabuk' && rig.girAnchor) {
      this.remoteGirVisual = new FlexibleGirVisual(this.scene);
      rig.girAnchor.getWorldPosition(_v3);
      this.remoteGirVisual.snapToAnchor(_v3, this.remoteYaw, this.remoteGirLength, true);
    }
  }

  private clearRemoteFighter(): void {
    this.remoteGirVisual?.dispose(this.scene);
    this.remoteGirVisual = null;
    const rig = this.remoteRig;
    if (!rig) return;
    this.scene.remove(rig.root);
    this.remoteRig = null;
  }

  private updateRemoteFighter(dt: number): void {
    const rig = this.remoteRig;
    if (!rig) return;

    const k = 1 - Math.exp(-16 * dt);
    this.remoteX = THREE.MathUtils.lerp(this.remoteX, this.remoteTargetX, k);
    this.remoteZ = THREE.MathUtils.lerp(this.remoteZ, this.remoteTargetZ, k);
    this.remoteYaw = lerpAngle(this.remoteYaw, this.remoteTargetYaw, k);
    this.remoteWalkPhase += this.remoteSpeed * dt * 2.4;

    const spec = getEffectiveWeaponSpec(this.remoteWeapon, this.remoteGirLength);
    if (this.remoteAttackPhase !== 'idle') {
      this.remoteAttackTimer -= dt;
      if (this.remoteAttackTimer <= 0) {
        if (this.remoteAttackPhase === 'windup') {
          this.remoteAttackPhase = 'active';
          this.remoteAttackTimer = spec.activeSec;
          this.sound.playSwing(this.remoteWeapon, this.remoteGirLength);
        } else if (this.remoteAttackPhase === 'active') {
          this.remoteAttackPhase = 'recovery';
          this.remoteAttackTimer = spec.recoverySec;
        } else {
          this.remoteAttackPhase = 'idle';
          this.remoteAttackTimer = 0;
        }
      }
    }

    rig.root.position.set(this.remoteX, 0, this.remoteZ);
    rig.root.rotation.set(0, this.remoteYaw, 0);
    rig.root.scale.set(1, 1, 1);

    this.animateFighterPose(
      rig,
      this.remoteWalkPhase,
      this.remoteSpeed,
      this.remoteAttackPhase,
      Math.max(0, this.remoteAttackTimer),
      spec.activeSec,
      spec.windupSec,
      spec.recoverySec,
      this.remoteWeapon,
      this.remoteBlocking,
      false,
      false,
      0,
    );

    if (this.remoteGirVisual && rig.girAnchor) {
      rig.root.updateMatrixWorld(true);
      rig.girAnchor.getWorldPosition(_v3);
      this.remoteGirVisual.update({
        dt,
        anchorPos: _v3,
        fighterX: this.remoteX,
        fighterZ: this.remoteZ,
        fighterYaw: this.remoteYaw,
        lengthMeters: this.remoteGirLength,
        attackPhase: this.remoteAttackPhase,
        attackTimer: Math.max(0, this.remoteAttackTimer),
        windupSec: spec.windupSec,
        activeSec: spec.activeSec,
        recoverySec: spec.recoverySec,
        isTitlePreview: false,
        simTime: this.simTime,
      });
    }

    if (this.remoteHitFlash > 0) {
      this.remoteHitFlash = Math.max(0, this.remoteHitFlash - dt);
      const t = this.remoteHitFlash / 0.16;
      for (const m of rig.hitFlashMaterials) {
        m.emissive.setRGB(0.95 * t, 0.22 * t, 0.1 * t);
        m.emissiveIntensity = t;
      }
    }

    this.netSendTimer += dt;
    if (this.netSendTimer >= MABAR_STATE_INTERVAL) {
      this.netSendTimer = 0;
      this.onNetSend?.({
        t: 's',
        x: Math.round(this.playerX * 100) / 100,
        z: Math.round(this.playerZ * 100) / 100,
        y: Math.round(this.playerYaw * 1000) / 1000,
        hp: Math.round(this.playerHp),
        b: this.isBlocking ? 1 : 0,
        ph: this.attackPhase,
        sp: Math.round(Math.hypot(this.playerVx, this.playerVz) * 10) / 10,
      });
    }
  }

  private sendNetAttack(): void {
    if (!this.netMode) return;
    this.onNetSend?.({
      t: 'a',
      w: this.activeWeapon,
      g: this.charConfig.girLengthMeters,
      x: Math.round(this.playerX * 100) / 100,
      z: Math.round(this.playerZ * 100) / 100,
      y: Math.round(this.playerYaw * 1000) / 1000,
    });
  }

  /** Pesan masuk dari lawan (dipanggil App saat sesi mabar aktif). */
  public handleNetMessage(msg: MabarMessage): void {
    if (!this.netMode) return;
    if (msg.t === 's') {
      this.applyRemoteState(msg);
    } else if (msg.t === 'a') {
      this.receiveRemoteAttack(msg);
    } else if (msg.t === 'h') {
      this.applyRemoteHitFeedback(msg.d, msg.b === 1);
    } else if (msg.t === 'ko') {
      if (this.netKoAnnounced) return;
      this.netKoAnnounced = true;
      this.remoteHp = 0;
      this.setFeedback('LAWAN TUMBANG!');
      this.spawnBurstParticles(this.remoteX, 1.0, this.remoteZ, 22, 0xf97316, 7, 1.3, 10);
      this.finishRun(true);
    }
  }

  private applyRemoteState(msg: Extract<MabarMessage, { t: 's' }>): void {
    const now = performance.now();
    const dt =
      this.lastRemoteStateAt > 0
        ? Math.max(0.03, (now - this.lastRemoteStateAt) / 1000)
        : 0.1;
    this.lastRemoteStateAt = now;

    if (
      !isPlausiblePosition(
        { x: this.remoteTargetX, z: this.remoteTargetZ },
        { x: msg.x, z: msg.z },
        dt,
      )
    ) {
      return;
    }

    const moved = Math.hypot(msg.x - this.remoteTargetX, msg.z - this.remoteTargetZ);
    this.remoteSpeed = THREE.MathUtils.damp(this.remoteSpeed, Math.min(9, moved / dt), 9, dt);
    this.remoteTargetX = msg.x;
    this.remoteTargetZ = msg.z;
    this.remoteTargetYaw = msg.y;
    this.remoteBlocking = msg.b === 1;

    if (msg.ph !== this.remoteAttackPhase) {
      const spec = getEffectiveWeaponSpec(this.remoteWeapon, this.remoteGirLength);
      this.remoteAttackPhase = msg.ph;
      this.remoteAttackTimer =
        msg.ph === 'windup'
          ? spec.windupSec
          : msg.ph === 'active'
            ? spec.activeSec
            : msg.ph === 'recovery'
              ? spec.recoverySec
              : 0;
    }

    if (msg.hp < this.remoteHp) this.remoteHitFlash = 0.16;
    this.remoteHp = msg.hp;
  }

  private receiveRemoteAttack(msg: Extract<MabarMessage, { t: 'a' }>): void {
    if (this.gameState !== 'playing') return;
    const spec = getEffectiveWeaponSpec(msg.w, msg.g);
    const res = computeMeleeHit({
      attackerX: msg.x,
      attackerZ: msg.z,
      attackerYaw: msg.y,
      targetX: this.playerX,
      targetZ: this.playerZ,
      weapon: spec,
      targetBlocking: this.isBlocking,
      targetParryTimer: this.parryWindowTimer,
      comboCount: 0,
    });
    if (!res.hit) return;
    this.applyDamageToPlayer(res.damage, res.knockbackX, res.knockbackZ, res.blocked);
    this.onNetSend?.({ t: 'h', d: res.damage, b: res.blocked ? 1 : 0 });
  }

  private applyRemoteHitFeedback(dmg: number, blocked: boolean): void {
    if (!this.netMode) return;
    this.combo += 1;
    this.comboTimer = 2.6;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += dmg * 10 + this.combo * 15;
    this.remoteHitFlash = 0.16;
    if (blocked) {
      this.sound.playBlock(false);
      this.spawnBurstParticles(this.remoteX, 1.2, this.remoteZ, 8, 0x94a3b8, 4.5, 0.8, 10);
      this.setFeedback('DIBLOK');
    } else {
      this.sound.playHit(true);
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.05);
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.34);
      this.spawnBurstParticles(this.remoteX, 1.2, this.remoteZ, 14, 0xfbbf24, 6.5, 1.0, 14);
      this.setFeedback(`KENA -${dmg}`);
    }
    this.emitHud();
  }

  /** Keluar dari duel (teman putus / pemain keluar): bersihkan lawan. */
  public leaveDuel(): void {
    this.netMode = false;
    this.netKoAnnounced = false;
    this.netSelfKoAnnounced = false;
    this.clearRemoteFighter();
    this.returnToTitle();
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();

    this.clearEnemies();
    this.clearAllies();
    this.clearPetasans();
    this.clearIntroActors();
    this.playerGirVisual.dispose(this.scene);
    this.envDisposables.forEach((d) => d.dispose());
    this.blastSphereGeo.dispose();
    this.blastRingGeo.dispose();
    this.scorchGeo.dispose();
    this.scorchTex.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
