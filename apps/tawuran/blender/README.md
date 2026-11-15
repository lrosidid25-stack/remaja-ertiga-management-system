# Karakter modular (Blender → GLB → three.js)

Game bisa memakai dua jenis model pemain, dipilih di **Kustomisasi → Model Karakter 3D**:

| Mode | Sumber | Catatan |
| --- | --- | --- |
| **Prosedural (bawaan)** | `src/game/models.ts` (`buildFighterRig`) | Selalu tersedia, tidak butuh file aset |
| **GLB Modular** | `public/characters/base_humanoid.glb` | Skeleton + socket aksesori, hasil pipeline di folder ini |

Kalau file GLB hilang/rusak, game **otomatis** kembali ke model prosedural
(tidak pernah blank atau crash).

## 1. Aset yang sudah ada di repo

`public/characters/base_humanoid.glb` dibuat oleh skrip Node tanpa dependensi:

```bash
npm run build:glb      # dipanggil otomatis oleh `npm run build`
```

Isinya: 21 tulang humanoid, 6 socket aksesori, 1 skinned mesh 408 vertex
(kubus low-poly berwarna lewat vertex color), 32 KB. Skrip: `scripts/build-base-glb.mjs`.

## 2. Bikin model sendiri di Blender

```bash
blender --background --python blender/modular_character.py -- --export
# atau dengan path lain:
blender --background --python blender/modular_character.py -- --export --out public/characters/base_humanoid.glb
```

Di Blender bisa juga: **Scripting → Open → `blender/modular_character.py` → Run Script**.

Yang dibuat skrip:

- koleksi `Character_Export_Root` → `01_Rig`, `02_Base_Body`, `03_Base_Clothing`, `04_Modular_Accessories`
- armature `Armature_Humanoid` (22 tulang) dengan nama yang dicari game
- socket kosong: `SOCKET_Hair`, `SOCKET_Hat`, `SOCKET_Glasses`, `SOCKET_FaceMask`, `SOCKET_Backpack`, `SOCKET_Jacket`
- blokout badan (kubus) yang sudah di-bind kaku ke tulangnya (vertex group + modifier Armature)
- modul aksesori terpisah (`MOD_Hair_Cards`, `MOD_BaseballCap`, `MOD_Glasses`, `MOD_FaceMask`, `MOD_Backpack`, `MOD_Jacket`) menempel di socket-nya

### Aturan yang wajib diikuti

1. **Jangan ganti nama tulang** yang dipakai game (`src/game/glbCharacter.ts`):
   `pelvis`, `spine_02`, `head`, `upperarm_l/r`, `lowerarm_l/r`, `thigh_l/r`, `calf_l/r`, `hand_r`.
2. **Jangan ganti nama socket** `SOCKET_*` (dipakai untuk memasang modul).
3. Satuan **meter**, tinggi ±1,8 m, telapak kaki di `Z = 0`, skala objek **1** (Apply Scale).
4. Karakter menghadap **-Y di Blender** — eksportir mengubahnya jadi **+Z** di glTF,
   sesuai arah hadap game.
5. Bobot vertex: boleh kaku (1 tulang) atau smooth; engine hanya memutar tulang,
   tidak butuh animation clip dari Blender.

### Cara game memetakan tulang

| Field `FighterRig` | Tulang GLB | Fungsi |
| --- | --- | --- |
| `hips` | `pelvis` | goyang badan |
| `torso` | `spine_02` | membungkuk / ayun |
| `head` | `head` | anggukan |
| `leftShoulder` / `rightShoulder` | `upperarm_l` / `upperarm_r` | ayun lengan |
| `leftElbow` / `rightElbow` | `lowerarm_l` / `lowerarm_r` | tekuk siku |
| `leftHip` / `rightHip` | `thigh_l` / `thigh_r` | langkah kaki |
| `leftKnee` / `rightKnee` | `calf_l` / `calf_r` | tekuk lutut |
| `weaponMount` | grup di `hand_r` | tempat senjata |
| `girAnchor` | `gir_anchor` di mesh senjata | pangkal sabuk gir |

Setiap sendi dibungkus **pivot** (nama `<tulang>_pivot`) yang rotasinya nol, jadi
pose istirahat dari Blender (mis. lengan A-pose 45°) tidak hilang ketika engine
memutar sendi.

## 3. Menambah aksesori modular

1. Buat objek baru di koleksi `04_Modular_Accessories`.
2. Parent ke socket yang sesuai (`SOCKET_Hair`, `SOCKET_Hat`, …) dengan
   *Parent Type: Object* dan posisi lokal `(0,0,0)`.
3. Ekspor ulang GLB, lalu di game aksesori otomatis ikut kepala/badan.
4. Untuk tombol on/off di UI nanti, daftarkan nama socket di
   `CHARACTER_SOCKETS` (`src/game/glbCharacter.ts`) dan sembunyikan objek lewat
   `root.getObjectByName('MOD_…')`.

## 4. Tes otomatis

`src/game/glbCharacter.test.ts` memeriksa aset GLB di repo:

- header GLB valid + semua tulang & socket wajib ada
- `GLTFLoader` benar-benar bisa memuatnya (skinned mesh, 21 tulang, vertex color)
- pemetaan ke `FighterRig` + pivot, senjata menempel di `hand_r`
- kloning tidak berbagi material (kilatan kena pukul tidak menular)
- scene tanpa tulang ditolak → engine fallback ke prosedural

```bash
npm run test
```
