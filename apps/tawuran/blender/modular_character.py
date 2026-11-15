"""
Template karakter modular Tawuran (Blender 4.x)

Jalankan di Blender:
    blender --background --python blender/modular_character.py -- --export

Atau buka Blender → Scripting → buka file ini → Run Script (klik "Jalankan").

Hasilnya:
    * koleksi 01_Rig / 02_Base_Body / 03_Base_Clothing / 04_Modular_Accessories
    * armature "Armature_Humanoid" dengan nama tulang yang sama seperti yang
      dicari game (`src/game/glbCharacter.ts` → REQUIRED_BONES)
    * socket kosong: SOCKET_Hair, SOCKET_Hat, SOCKET_Glasses, SOCKET_FaceMask,
      SOCKET_Backpack, SOCKET_Jacket
    * tiap potongan badan punya vertex group kaku (1 tulang) + modifier Armature
    * modul aksesori terpisah (tidak menyatu) dan sudah menempel di socket

Ekspor GLB untuk game (opsional, lewat argumen --export):
    apps/tawuran/public/characters/base_humanoid.glb

PENTING (biar cocok dengan game):
    * satuan meter, tinggi ±1.8 m, telapak kaki di Z = 0
    * karakter menghadap -Y di Blender (Blender mengekspor -Y → +Z di glTF)
    * JANGAN ganti nama tulang / socket yang sudah ada
    * skala objek harus 1 (pakai Apply Scale sebelum ekspor)
"""

import math
import os
import sys

import bpy
import mathutils

# --------------------------------------------------------------------------- #
# Konfigurasi
# --------------------------------------------------------------------------- #

RIG_NAME = "Armature_Humanoid"
DATA_NAME = "Humanoid_Rig"
DEFAULT_EXPORT = os.path.join("apps", "tawuran", "public", "characters", "base_humanoid.glb")

# (nama, induk, kepala, ekor) — posisi dalam meter, karakter menghadap -Y
BONES = {
    "root": (None, (0, 0, 0), (0, 0, 0.1)),
    "pelvis": ("root", (0, 0, 0.95), (0, 0, 1.05)),
    "spine_01": ("pelvis", (0, 0, 1.05), (0, 0, 1.2)),
    "spine_02": ("spine_01", (0, 0, 1.2), (0, 0, 1.35)),
    "spine_03": ("spine_02", (0, 0, 1.35), (0, 0, 1.5)),
    "neck_01": ("spine_03", (0, 0, 1.5), (0, 0, 1.58)),
    "head": ("neck_01", (0, 0, 1.58), (0, 0, 1.8)),
    "jaw": ("head", (0, -0.02, 1.62), (0, -0.08, 1.58)),
    # Lengan A-pose 45°
    "clavicle_l": ("spine_03", (0.03, 0, 1.47), (0.15, 0, 1.47)),
    "upperarm_l": ("clavicle_l", (0.15, 0, 1.47), (0.35, 0, 1.27)),
    "lowerarm_l": ("upperarm_l", (0.35, 0, 1.27), (0.55, 0, 1.07)),
    "hand_l": ("lowerarm_l", (0.55, 0, 1.07), (0.62, 0, 1.0)),
    "clavicle_r": ("spine_03", (-0.03, 0, 1.47), (-0.15, 0, 1.47)),
    "upperarm_r": ("clavicle_r", (-0.15, 0, 1.47), (-0.35, 0, 1.27)),
    "lowerarm_r": ("upperarm_r", (-0.35, 0, 1.27), (-0.55, 0, 1.07)),
    "hand_r": ("lowerarm_r", (-0.55, 0, 1.07), (-0.62, 0, 1.0)),
    # Kaki
    "thigh_l": ("pelvis", (0.1, 0, 0.95), (0.1, 0, 0.5)),
    "calf_l": ("thigh_l", (0.1, 0, 0.5), (0.1, 0, 0.08)),
    "foot_l": ("calf_l", (0.1, 0, 0.08), (0.1, -0.15, 0.0)),
    "thigh_r": ("pelvis", (-0.1, 0, 0.95), (-0.1, 0, 0.5)),
    "calf_r": ("thigh_r", (-0.1, 0, 0.5), (-0.1, 0, 0.08)),
    "foot_r": ("calf_r", (-0.1, 0, 0.08), (-0.1, -0.15, 0.0)),
}

SOCKETS = {
    "SOCKET_Hair": ("head", (0, 0.0, 1.75)),
    "SOCKET_Hat": ("head", (0, 0.0, 1.73)),
    "SOCKET_Glasses": ("head", (0, -0.09, 1.66)),
    "SOCKET_FaceMask": ("head", (0, -0.10, 1.60)),
    "SOCKET_Backpack": ("spine_03", (0, 0.12, 1.35)),
    "SOCKET_Jacket": ("spine_03", (0, 0.0, 1.35)),
}

# Warna material (linear-friendly hex)
COLORS = {
    "skin": "#c68b59",
    "shirt": "#2b3444",
    "pants": "#3f4654",
    "shoes": "#1f1f23",
    "hair": "#1b1a1e",
    "cap": "#b91c1c",
    "mask": "#e5e7eb",
    "glasses": "#111827",
    "jacket": "#27303f",
    "backpack": "#4b5563",
}

# Potongan badan: (nama objek, tulang, pusat, ukuran)
BODY_PARTS = [
    ("SKM_Pelvis", "pelvis", (0, 0, 1.0), (0.34, 0.22, 0.22), "pants"),
    ("SKM_Torso", "spine_02", (0, 0, 1.3), (0.42, 0.24, 0.36), "shirt"),
    ("SKM_Head", "head", (0, 0, 1.7), (0.24, 0.24, 0.26), "skin"),
    ("SKM_Shoulder_L", "clavicle_l", (0.09, 0, 1.47), (0.16, 0.16, 0.12), "shirt"),
    ("SKM_UpperArm_L", "upperarm_l", (0.25, 0, 1.37), (0.13, 0.13, 0.3), "shirt"),
    ("SKM_LowerArm_L", "lowerarm_l", (0.45, 0, 1.17), (0.11, 0.11, 0.28), "skin"),
    ("SKM_Hand_L", "hand_l", (0.58, 0, 1.03), (0.1, 0.1, 0.12), "skin"),
    ("SKM_Shoulder_R", "clavicle_r", (-0.09, 0, 1.47), (0.16, 0.16, 0.12), "shirt"),
    ("SKM_UpperArm_R", "upperarm_r", (-0.25, 0, 1.37), (0.13, 0.13, 0.3), "shirt"),
    ("SKM_LowerArm_R", "lowerarm_r", (-0.45, 0, 1.17), (0.11, 0.11, 0.28), "skin"),
    ("SKM_Hand_R", "hand_r", (-0.58, 0, 1.03), (0.1, 0.1, 0.12), "skin"),
    ("SKM_Thigh_L", "thigh_l", (0.1, 0, 0.73), (0.17, 0.17, 0.46), "pants"),
    ("SKM_Calf_L", "calf_l", (0.1, 0, 0.29), (0.15, 0.15, 0.44), "pants"),
    ("SKM_Foot_L", "foot_l", (0.1, -0.04, 0.05), (0.15, 0.26, 0.1), "shoes"),
    ("SKM_Thigh_R", "thigh_r", (-0.1, 0, 0.73), (0.17, 0.17, 0.46), "pants"),
    ("SKM_Calf_R", "calf_r", (-0.1, 0, 0.29), (0.15, 0.15, 0.44), "pants"),
    ("SKM_Foot_R", "foot_r", (-0.1, -0.04, 0.05), (0.15, 0.26, 0.1), "shoes"),
]

# Modul aksesori: (nama objek, socket, pusat lokal, ukuran, warna)
ACCESSORY_PARTS = [
    ("MOD_Hair_Cards", "SOCKET_Hair", (0, 0, 0.02), (0.26, 0.26, 0.1), "hair"),
    ("MOD_BaseballCap", "SOCKET_Hat", (0, 0, 0.04), (0.27, 0.29, 0.09), "cap"),
    ("MOD_Glasses", "SOCKET_Glasses", (0, 0, 0), (0.22, 0.04, 0.06), "glasses"),
    ("MOD_FaceMask", "SOCKET_FaceMask", (0, 0, 0), (0.2, 0.05, 0.12), "mask"),
    ("MOD_Backpack", "SOCKET_Backpack", (0, 0.06, 0), (0.3, 0.16, 0.36), "backpack"),
    ("MOD_Jacket", "SOCKET_Jacket", (0, 0, 0.02), (0.46, 0.28, 0.4), "jacket"),
]


# --------------------------------------------------------------------------- #
# Utilitas
# --------------------------------------------------------------------------- #

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_collection(name, parent):
    col = bpy.data.collections.new(name)
    parent.children.link(col)
    return col


def link_only(obj, collection):
    """Pindahkan objek ke satu koleksi saja."""
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(name, hex_color):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    node_tree = mat.node_tree
    bsdf = next(
        (n for n in node_tree.nodes if n.type == "BSDF_PRINCIPLED"),
        None,
    )
    color = hex_to_rgba(hex_color)
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.72
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.04
    mat.diffuse_color = color
    return mat


def hex_to_rgba(hex_color):
    value = hex_color.lstrip("#")
    r, g, b = (int(value[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (r, g, b, 1.0)


def make_box(name, center, size, material, collection):
    """Kubus blokout dengan vertex yang sudah dibagi 2 (skala di-apply)."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)

    hx, hy, hz = (s * 0.5 for s in size)
    verts = [
        (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
        (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz),
    ]
    faces = [
        (0, 1, 2, 3), (4, 5, 6, 7),
        (0, 1, 5, 4), (2, 3, 7, 6),
        (1, 2, 6, 5), (0, 3, 7, 4),
    ]
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(material)
    obj.location = mathutils.Vector(center)
    return obj


# --------------------------------------------------------------------------- #
# Builder
# --------------------------------------------------------------------------- #

def build_rig(rig_col):
    arm_data = bpy.data.armatures.new(DATA_NAME)
    arm_obj = bpy.data.objects.new(RIG_NAME, arm_data)
    rig_col.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = arm_data.edit_bones
    created = {}
    for name, (parent, head, tail) in BONES.items():
        bone = edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent and parent in created:
            bone.parent = created[parent]
            bone.use_connect = False
        created[name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")

    # Socket: empty yang menempel di tulang, posisi dunia eksplisit.
    bpy.context.view_layer.update()
    sockets = {}
    for name, (bone_name, world_pos) in SOCKETS.items():
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = "ARROWS"
        empty.empty_display_size = 0.08
        rig_col.objects.link(empty)
        empty.parent = arm_obj
        empty.parent_type = "BONE"
        empty.parent_bone = bone_name
        bpy.context.view_layer.update()
        empty.matrix_world = mathutils.Matrix.Translation(world_pos)
        empty.hide_viewport = False
        sockets[name] = empty

    return arm_obj, sockets


def bind_rigid(obj, arm_obj, bone_name):
    """Bobot kaku: semua vertex ikut satu tulang (blockout, belum smooth skin)."""
    group = obj.vertex_groups.new(name=bone_name)
    group.add([v.index for v in obj.data.vertices], 1.0, "REPLACE")

    modifier = obj.modifiers.new(name="Armature", type="ARMATURE")
    modifier.object = arm_obj
    obj.parent = arm_obj
    obj.matrix_parent_inverse = arm_obj.matrix_world.inverted()


def build_body(arm_obj, body_col):
    for name, bone, center, size, color_key in BODY_PARTS:
        mat = make_material(f"M_{name}", COLORS[color_key])
        obj = make_box(name, center, size, mat, body_col)
        bind_rigid(obj, arm_obj, bone)


def build_accessories(sockets, accessory_col):
    for name, socket_name, local_pos, size, color_key in ACCESSORY_PARTS:
        mat = make_material(f"M_{name}", COLORS[color_key])
        obj = make_box(name, (0, 0, 0), size, mat, accessory_col)
        socket = sockets[socket_name]
        obj.parent = socket
        obj.parent_type = "OBJECT"
        bpy.context.view_layer.update()
        obj.matrix_parent_inverse = socket.matrix_world.inverted()
        obj.location = mathutils.Vector(local_pos)


def report(arm_obj, sockets):
    bones = len(arm_obj.data.bones)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    print("─" * 62)
    print(f"Rig        : {arm_obj.name} ({bones} tulang)")
    print(f"Socket     : {', '.join(sorted(sockets))}")
    print(f"Mesh       : {len(meshes)} objek (badan + aksesori modular)")
    print("─" * 62)


def export_glb(target_path):
    target = os.path.abspath(target_path)
    os.makedirs(os.path.dirname(target), exist_ok=True)

    for obj in bpy.data.objects:
        obj.hide_viewport = False
        obj.hide_set(False)
        obj.select_set(obj.type in {"MESH", "ARMATURE", "EMPTY"})

    bpy.ops.export_scene.gltf(
        filepath=target,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_skins=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )
    print(f"✔ GLB diekspor ke {target}")


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    should_export = "--export" in argv
    export_path = DEFAULT_EXPORT
    if "--out" in argv:
        export_path = argv[argv.index("--out") + 1]

    reset_scene()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    root_col = make_collection("Character_Export_Root", scene.collection)
    rig_col = make_collection("01_Rig", root_col)
    body_col = make_collection("02_Base_Body", root_col)
    clothing_col = make_collection("03_Base_Clothing", root_col)
    accessory_col = make_collection("04_Modular_Accessories", root_col)

    arm_obj, sockets = build_rig(rig_col)
    build_body(arm_obj, body_col)
    build_accessories(sockets, accessory_col)

    # Koleksi pakaian disiapkan kosong: taruh SKM_Base_TShirt / SKM_Base_Pants
    # di sini kalau mau pakaian terpisah dari badan.
    clothing_col.hide_viewport = False

    report(arm_obj, sockets)

    if should_export:
        export_glb(export_path)
    else:
        print("Tips: jalankan dengan '-- --export' untuk langsung menulis GLB game.")


if __name__ == "__main__":
    main()
