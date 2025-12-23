from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGES_DIR = ROOT / "images"
MAX_WIDTH = 640
MAX_HEIGHT = 360
JPEG_QUALITY = 75
SUPPORTED_EXTS: Iterable[str] = (".jpg", ".jpeg", ".png", ".webp")


def should_process(src: Path, dst: Path) -> bool:
    if not dst.exists():
        return True
    return src.stat().st_mtime > dst.stat().st_mtime


def resize_image(src: Path, dst: Path) -> None:
    with Image.open(src) as im:
        im = im.convert("RGB")
        width, height = im.size
        scale = min(MAX_WIDTH / width, MAX_HEIGHT / height, 1.0)
        if scale < 1.0:
            new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
            resized = im.resize(new_size, Image.LANCZOS)
        else:
            resized = im
        dst.parent.mkdir(parents=True, exist_ok=True)
        resized.save(dst, format="JPEG", optimize=True, quality=JPEG_QUALITY)


def process_directory(src_dir: Path) -> tuple[int, int]:
    dst_dir = src_dir / "thumbs"
    processed = 0
    skipped = 0

    if not src_dir.exists():
        return 0, 0

    for src in sorted(src_dir.iterdir()):
        if src.is_dir() or src.suffix.lower() not in SUPPORTED_EXTS:
            continue
        dst = dst_dir / (src.stem + ".jpg")
        if not should_process(src, dst):
            skipped += 1
            continue
        resize_image(src, dst)
        processed += 1
        print(f"Created thumbnail: {dst.relative_to(ROOT)}")

    return processed, skipped


def main() -> int:
    if not IMAGES_DIR.exists():
        print(f"Images directory not found: {IMAGES_DIR}", file=sys.stderr)
        return 1

    total_processed = 0
    total_skipped = 0

    # Process all subdirectories in images/, excluding specific ones
    excluded_dirs = {"minimap", "thumbs"}

    for img_dir in sorted(IMAGES_DIR.iterdir()):
        if not img_dir.is_dir():
            continue

        if img_dir.name in excluded_dirs or img_dir.name.startswith('.'):
            continue
            
        print(f"Processing directory: {img_dir.relative_to(ROOT)}")
        p, s = process_directory(img_dir)
        total_processed += p
        total_skipped += s

    print(f"Total: Processed {total_processed} file(s), skipped {total_skipped}")
    return 0 if total_processed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
