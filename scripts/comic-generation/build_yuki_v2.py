# -*- coding: utf-8 -*-
"""Build yuki-v2-pages.mjs from _yuki_data.json (UTF-8)."""
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parent
BUILDER = ROOT / "_build_yuki_mjs.py"

if __name__ == "__main__":
    runpy.run_path(str(BUILDER), run_name="__main__")