import os
import sys
import cv2
import numpy as np
from pathlib import Path

# 設定
ROOT = Path(__file__).resolve().parents[1]
IMAGES_DIR = ROOT / "images"
SUPPORTED_EXTS = (".jpg", ".jpeg", ".png")
MAX_WIDTH = 4096  # 360度写真として十分な解像度 (4K)
QUALITY = 80       # WebPの品質

def imread_unicode(path):
    """日本語パス対応の画像読み込み"""
    try:
        with open(path, "rb") as f:
            chunk = np.frombuffer(f.read(), dtype=np.uint8)
            return cv2.imdecode(chunk, cv2.IMREAD_COLOR)
    except Exception as e:
        print(f"  Error reading {path}: {e}")
        return None

def imwrite_unicode(path, img, params=None):
    """日本語パス対応の画像保存"""
    try:
        ext = os.path.splitext(path)[1]
        result, nparray = cv2.imencode(ext, img, params)
        if result:
            with open(path, "wb") as f:
                nparray.tofile(f)
            return True
    except Exception as e:
        print(f"  Error writing {path}: {e}")
    return False

def optimize_image(image_path):
    """画像をWebPに変換し、必要に応じてリサイズする"""
    output_path = image_path.with_suffix(".webp")
    
    # 画像読み込み
    img = imread_unicode(str(image_path))
    if img is None:
        return False

    h, w = img.shape[:2]
    
    # リサイズ (アスペクト比維持)
    if w > MAX_WIDTH:
        new_w = MAX_WIDTH
        new_h = int(h * (MAX_WIDTH / w))
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        print(f"  Resized: {w}x{h} -> {new_w}x{new_h}")
    
    # WebPとして書き出し
    success = imwrite_unicode(str(output_path), img, [int(cv2.IMWRITE_WEBP_QUALITY), QUALITY])
    
    if success:
        old_size = image_path.stat().st_size / (1024 * 1024)
        new_size = output_path.stat().st_size / (1024 * 1024)
        print(f"  Optimized: {old_size:.2f}MB -> {new_size:.2f}MB (WebP)")
        return True
    return False

def main():
    if not IMAGES_DIR.exists():
        print(f"Error: {IMAGES_DIR} not found.")
        return 1

    print(f"Starting image optimization (WebP + Resize to {MAX_WIDTH}px)...")
    count = 0

    # images/part1, images/part2 などをスキャン
    for img_dir in IMAGES_DIR.iterdir():
        if not img_dir.is_dir() or img_dir.name in {"minimap", "thumbs"}:
            continue
            
        print(f"Processing directory: {img_dir.name}")
        for img_path in img_dir.iterdir():
            if img_path.suffix.lower() in SUPPORTED_EXTS:
                print(f"  Processing {img_path.name}...")
                if optimize_image(img_path):
                    count += 1

    print(f"\nDone. Optimized {count} images.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
