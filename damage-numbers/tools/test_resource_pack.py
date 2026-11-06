#!/usr/bin/env python3
"""Focused checks for the custom Minecraft brush font and pack archive."""

from io import BytesIO
import json
import unittest
import zipfile

from PIL import Image

import build_resource_pack as font


class ResourcePackTest(unittest.TestCase):
    def test_metadata_resolves_texture_and_miss_characters(self):
        files = font.pack_files()
        self.assertEqual(22, json.loads(files["pack.mcmeta"])["pack"]["pack_format"])
        provider = json.loads(files["assets/orange_damage/font/numbers.json"])["providers"][0]
        namespace, relative = provider["file"].split(":", 1)
        with Image.open(BytesIO(files[f"assets/{namespace}/textures/{relative}"])) as texture:
            self.assertEqual((len(provider["chars"][0]) * font.CELL_WIDTH, font.CELL_HEIGHT), texture.size)
            texture.verify()
        self.assertEqual(16, provider["height"])
        self.assertEqual(13, provider["ascent"])
        self.assertEqual("0123456789.-MIS", provider["chars"][0])

    def test_every_glyph_has_orange_fill_black_outline_and_no_clipping(self):
        for character in font.CHARACTERS:
            with self.subTest(character=character):
                image = font.glyph_image(character)
                pixels = image.get_flattened_data()
                self.assertTrue(any(p[0] > 200 and 50 < p[1] < 245 and p[2] < 100 and p[3] for p in pixels))
                self.assertTrue(any(max(p[:3]) < 30 and p[3] == 255 for p in pixels))
                bounds = image.getbbox()
                self.assertGreaterEqual(bounds[0], 1)
                self.assertGreaterEqual(bounds[1], 1)
                self.assertLess(bounds[2], font.CELL_WIDTH)
                self.assertLess(bounds[3], font.CELL_HEIGHT)

    def test_bundled_font_and_attribution_are_present(self):
        font.source_font()  # Verifies the source artifact's recorded SHA-256.
        files = font.pack_files()
        self.assertIn(b"Apache License", files["LICENSE-PermanentMarker.txt"])
        self.assertIn(b"Modified", files["FONT-NOTICE.txt"])

    def test_zip_is_reproducible_and_contains_root_metadata(self):
        first = font.deterministic_zip(font.pack_files())
        self.assertEqual(first, font.deterministic_zip(font.pack_files()))
        with zipfile.ZipFile(BytesIO(first)) as archive:
            self.assertIsNone(archive.testzip())
            self.assertIn("pack.mcmeta", archive.namelist())
            self.assertEqual(set(font.pack_files()), set(archive.namelist()))


if __name__ == "__main__":
    unittest.main()
