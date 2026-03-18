"""
ヒーロー画像 (image/main*.jpg) と ギャラリー画像 (image/model*.png) を
WebP に変換し、元画像は保持する。
LCP 改善のため、main1 は幅 1920px・品質 80 に最適化。
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "image"

# 対象パターン
PATTERNS = ["main*.jpg", "model*.png"]
MAX_WIDTH = 1920
QUALITY = 80


def optimize(src: Path):
    dst = src.with_suffix(".webp")
    try:
        img = Image.open(src)
    except Exception as e:
        print(f"  SKIP {src.name}: {e}")
        return

    w, h = img.size
    if w > MAX_WIDTH:
        ratio = MAX_WIDTH / w
        new_size = (MAX_WIDTH, int(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)
        print(f"  Resized {src.name}: {w}x{h} -> {new_size[0]}x{new_size[1]}")

    img.save(dst, "WEBP", quality=QUALITY, method=6)
    old_kb = src.stat().st_size / 1024
    new_kb = dst.stat().st_size / 1024
    print(f"  {src.name} -> {dst.name}  ({old_kb:.0f} KB -> {new_kb:.0f} KB)")


def main():
    if not IMAGE_DIR.exists():
        print(f"Error: {IMAGE_DIR} not found")
        return 1

    count = 0
    for pattern in PATTERNS:
        for path in sorted(IMAGE_DIR.glob(pattern)):
            optimize(path)
            count += 1

    print(f"\nDone. Processed {count} images.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
