#!/usr/bin/env python3
"""Build the 1.20.4 orange brush-font pack from the bundled licensed font.

Requires Pillow. Font data is local; generation never downloads code or assets.
"""

from __future__ import annotations

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path
import zipfile

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CHARACTERS = "0123456789.-MIS"
CELL_WIDTH = 128
CELL_HEIGHT = 112
FONT_HEIGHT = 16
ASCENT = 13
SOURCE_FONT_SIZE = 96
OUTLINE_WIDTH = 6
FONT_FILE = ROOT / "tools/font/PermanentMarker-Regular.ttf"
FONT_SHA256 = "28f82c8a7943cb8e9d599f8554da1d4fc75dbcf69b9885ad6c0611d20c6946c5"


def source_font() -> ImageFont.FreeTypeFont:
    if hashlib.sha256(FONT_FILE.read_bytes()).hexdigest() != FONT_SHA256:
        raise ValueError("Bundled font checksum mismatch; restore the documented font file")
    return ImageFont.truetype(str(FONT_FILE), SOURCE_FONT_SIZE)


def png_bytes(image: Image.Image) -> bytes:
    destination = BytesIO()
    image.save(destination, format="PNG", optimize=False, compress_level=9)
    return destination.getvalue()


def glyph_image(character: str) -> Image.Image:
    font = source_font()
    # Put every glyph on the same baseline. Negative-bearing I and dot are
    # compensated horizontally, without moving their vertical alignment.
    left = font.getbbox(character)[0]
    origin = (10 - min(0, left), -15)
    fill_mask = Image.new("L", (CELL_WIDTH, CELL_HEIGHT))
    ImageDraw.Draw(fill_mask).text(origin, character, font=font, fill=255)
    silhouette = Image.new("L", fill_mask.size)
    ImageDraw.Draw(silhouette).text(
        origin, character, font=font, fill=255,
        stroke_width=OUTLINE_WIDTH, stroke_fill=255,
    )
    bounds = silhouette.getbbox()
    if bounds is None or bounds[2] + 4 > CELL_WIDTH - 1 or bounds[3] + 5 > CELL_HEIGHT - 1:
        raise ValueError(f"Glyph or shadow would be clipped for {character!r}: {bounds}")
    image = Image.new("RGBA", fill_mask.size)
    # Solid lower-right shadow with a heavy black edge mirrors brush lettering
    # rather than Minecraft's native duplicate text shadow.
    shadow = Image.new("L", fill_mask.size)
    shadow.paste(silhouette, (4, 5))
    image.paste((8, 8, 11, 255), (0, 0), shadow)
    image.paste((17, 13, 15, 255), (0, 0), silhouette)

    # Permanent Marker supplies the hand-painted outline. Sparse cuts in the
    # orange fill add marker wear without erasing the shape or its black edge.
    if character not in ".-":
        cuts = Image.new("L", fill_mask.size)
        draw = ImageDraw.Draw(cuts)
        x0, y0, x1, y1 = fill_mask.getbbox()
        width, height = x1 - x0, y1 - y0
        seed = CHARACTERS.index(character)
        for fraction, start_fraction in ((0.29, 0.12), (0.72, 0.58)):
            y = y0 + round(height * fraction) + seed % 3
            x = x0 + round(width * start_fraction)
            draw.line((x, y, x + max(5, round(width * 0.23)), y - 2), fill=210, width=1)
        fill_mask = ImageChops.subtract(fill_mask, ImageChops.multiply(fill_mask, cuts))

    gradient = Image.new("RGBA", image.size)
    # Yellow high lights -> vivid orange -> burnt orange, at a common baseline
    # so adjacent digits form a consistent word rather than independent fills.
    stops = ((14, (255, 240, 93)), (54, (255, 166, 25)), (99, (238, 91, 17)))
    draw = ImageDraw.Draw(gradient)
    for y in range(CELL_HEIGHT):
        first, second = (stops[0], stops[1]) if y < stops[1][0] else (stops[1], stops[2])
        t = max(0.0, min(1.0, (y - first[0]) / (second[0] - first[0])))
        color = tuple(round(a * (1 - t) + b * t) for a, b in zip(first[1], second[1]))
        draw.line((0, y, CELL_WIDTH - 1, y), fill=color + (255,))
    image.paste(gradient, (0, 0), fill_mask)
    return image


def atlas_image() -> Image.Image:
    atlas = Image.new("RGBA", (CELL_WIDTH * len(CHARACTERS), CELL_HEIGHT))
    for index, character in enumerate(CHARACTERS):
        atlas.paste(glyph_image(character), (index * CELL_WIDTH, 0))
    return atlas


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def pack_files() -> dict[str, bytes]:
    return {
        "pack.mcmeta": json_bytes({
            "pack": {
                "pack_format": 22,
                "description": "Orange Damage Numbers | brush font | Minecraft 1.20.3-1.20.4",
            }
        }),
        "assets/orange_damage/font/numbers.json": json_bytes({
            "providers": [{
                "type": "bitmap",
                "file": "orange_damage:font/numbers.png",
                "ascent": ASCENT,
                "height": FONT_HEIGHT,
                "chars": [CHARACTERS],
            }]
        }),
        "assets/orange_damage/textures/font/numbers.png": png_bytes(atlas_image()),
        "LICENSE-PermanentMarker.txt": (ROOT / "tools/font/LICENSE.txt").read_bytes(),
        "FONT-NOTICE.txt": (
            "Permanent Marker by Font Diner, Copyright (c) 2010 by Font Diner, Inc.\n"
            "Licensed under the Apache License, Version 2.0; see LICENSE-PermanentMarker.txt.\n"
            "Source: https://github.com/google/fonts/tree/main/apache/permanentmarker\n"
            "Modified for this pack: rendered as bitmap glyphs, orange gradient,\n"
            "black outline, lower-right shadow, and sparse brush-wear cuts.\n"
        ).encode("utf-8"),
    }


def build_preview() -> bytes:
    samples = ("0123456789", "12.5", "MISS")
    width, height = 1150, 370
    image = Image.new("RGBA", (width, height), (28, 31, 35, 255))
    for row, sample in enumerate(samples):
        pen_x = 20
        for character in sample:
            glyph = glyph_image(character)
            bounds = glyph.getbbox()
            image.alpha_composite(glyph, (pen_x, row * 115 + 5))
            pen_x += bounds[2] + 3
    return png_bytes(image)


def deterministic_zip(files: dict[str, bytes]) -> bytes:
    destination = BytesIO()
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in sorted(files.items()):
            entry = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, content)
    return destination.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Project root for resource-pack/ and dist/")
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    files = pack_files()
    for name, content in files.items():
        path = root / "resource-pack" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    destination = root / "dist"
    destination.mkdir(parents=True, exist_ok=True)
    archive = deterministic_zip(files)
    path = destination / "OrangeDamageNumbers-resource-pack.zip"
    path.write_bytes(archive)
    checksum = hashlib.sha1(archive).hexdigest()
    (destination / "OrangeDamageNumbers-resource-pack.sha1").write_text(checksum + "\n", encoding="ascii")
    (destination / "font-preview.png").write_bytes(build_preview())
    print(f"Built {path}")
    print(f"SHA-1: {checksum}")
    print(f"Font orange_damage:numbers: {CELL_WIDTH}x{CELL_HEIGHT} cells, height {FONT_HEIGHT}, ascent {ASCENT}")


if __name__ == "__main__":
    main()
