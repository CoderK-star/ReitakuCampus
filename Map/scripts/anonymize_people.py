import os
import sys
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

# 設定
ROOT = Path(__file__).resolve().parents[1]
IMAGES_DIR = ROOT / "images"
SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".webp")
EXCLUDED_DIRS = {"minimap", "thumbs"}

def anonymize_image(image_path, model):
    """画像内の人物を検出し、ぼかしを適用する (タイル分割推論対応)"""
    # 画像読み込み
    img = cv2.imread(str(image_path))
    if img is None:
        return False

    h, w = img.shape[:2]
    found_any = False
    
    # --- タイル分割推論 (Slicing Inference) ---
    # 360度画像などの巨大な画像で、遠くの小さな人を検出するために画像を分割して処理する
    # YOLOは通常640x640程度にリサイズして処理するため、巨大な画像だと小さなオブジェクトが潰れる
    slice_size = 800  # 各タイルのサイズ
    overlap = 200     # タイル間の重なり
    
    all_boxes = []
    
    # タイルごとにループ
    for y in range(0, h, slice_size - overlap):
        for x in range(0, w, slice_size - overlap):
            y2_slice = min(y + slice_size, h)
            x2_slice = min(x + slice_size, w)
            if (y2_slice - y) < 100 or (x2_slice - x) < 100: continue

            slice_img = img[y:y2_slice, x:x2_slice]
            
            # AI検出 (Personのみ)
            # タイル内での検出。誤検知を抑えるためconfは高めに。
            results = model.predict(slice_img, classes=[0], conf=0.25, imgsz=640, verbose=False)
            
            for r in results:
                for box in r.boxes:
                    bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                    all_boxes.append([bx1 + x, by1 + y, bx2 + x, by2 + y])
                    found_any = True

    if found_any:
        for box in all_boxes:
            x1, y1, x2, y2 = box
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            person_area = img[y1:y2, x1:x2]
            if person_area.size > 0:
                area_w = x2 - x1
                blur_size = max(15, area_w // 2)
                if blur_size % 2 == 0: blur_size += 1
                blurred = cv2.GaussianBlur(person_area, (blur_size, blur_size), 0)
                img[y1:y2, x1:x2] = blurred

        cv2.imwrite(str(image_path), img)
        return True
    return False

def main():
    if not IMAGES_DIR.exists():
        print(f"Error: {IMAGES_DIR} not found.")
        return 1

    # より高精度な X-Large モデルを使用
    model_name = 'yolov8x.pt'
    print(f"Loading AI model ({model_name})...")
    try:
        model = YOLO(model_name)
    except Exception as e:
        print(f"Failed to load model: {e}")
        return 1

    print("Starting deep scan anonymization (Tiling mode)...")
    processed_count = 0

    for img_dir in sorted(IMAGES_DIR.iterdir()):
        if not img_dir.is_dir() or img_dir.name in EXCLUDED_DIRS or img_dir.name.startswith('.'):
            continue
            
        print(f"Scanning directory: {img_dir.name}")
        for img_path in img_dir.iterdir():
            if img_path.suffix.lower() in SUPPORTED_EXTS:
                print(f"  Analyzing: {img_path.name}...", end="\r")
                if anonymize_image(img_path, model):
                    print(f"  Anonymized: {img_path.name}   ")
                    processed_count += 1
                else:
                    print(f"  Clean: {img_path.name}   ")

    print(f"\nDone. Processed {processed_count} images.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
