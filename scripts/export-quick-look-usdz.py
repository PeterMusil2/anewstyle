"""Convert one panel GLB to a self-contained Apple Quick Look USDZ.

Run through Blender:
  blender --background --python scripts/export-quick-look-usdz.py -- input.glb output.usdz
"""

import sys
from pathlib import Path

import bpy


def arguments():
    separator = sys.argv.index("--") if "--" in sys.argv else -1
    values = sys.argv[separator + 1 :]
    if len(values) != 2:
        raise SystemExit("Expected input GLB and output USDZ paths")
    return Path(values[0]).resolve(), Path(values[1]).resolve()


def quick_look_material(material):
    if material.node_tree is None:
        return

    image = next(
        (node.image for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image),
        None,
    )
    emission = next(
        (node for node in material.node_tree.nodes if node.type == "EMISSION"),
        None,
    )
    color = emission.inputs["Color"].default_value[:] if emission else (0.8, 0.8, 0.8, 1.0)

    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = 0.82
    principled.inputs["Metallic"].default_value = 0.0

    if image:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        material.node_tree.links.new(texture.outputs["Color"], principled.inputs["Base Color"])
        if "Emission Color" in principled.inputs:
            material.node_tree.links.new(texture.outputs["Color"], principled.inputs["Emission Color"])
            principled.inputs["Emission Strength"].default_value = 0.35

    material.node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    material.blend_method = "OPAQUE"


source, destination = arguments()
destination.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))

for panel_material in bpy.data.materials:
    quick_look_material(panel_material)

bpy.ops.wm.usd_export(
    filepath=str(destination),
    export_animation=False,
    export_materials=True,
    export_textures=True,
    overwrite_textures=True,
    relative_paths=True,
    generate_preview_surface=True,
)

print(f"Exported {source.name} -> {destination}")
