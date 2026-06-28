import os
import glob
from PIL import Image, ImageOps

target_dir = r"c:\โปรเจ็กต์ใน Antigravity\Portfolio\Certificates"
image_files = glob.glob(os.path.join(target_dir, "**", "*.*"), recursive=True)

processed_count = 0
rotated_count = 0

for file_path in image_files:
    ext = file_path.lower().split('.')[-1]
    if ext not in ['jpg', 'jpeg', 'png', 'webp']:
        continue
    
    try:
        img = Image.open(file_path)
        img_fixed = ImageOps.exif_transpose(img)
        if img_fixed != img:
            print(f"Fixing rotation for: {file_path}")
            exif = img.getexif()
            if 274 in exif:
                del exif[274]
            try:
                img_fixed.save(file_path, exif=exif)
            except Exception:
                # If preserving exif fails, save without it
                img_fixed.save(file_path)
            rotated_count += 1
        processed_count += 1
    except Exception as e:
        pass
        # print(f"Error processing {file_path}: {e}")

print(f"Processed {processed_count} images. Fixed EXIF rotation for {rotated_count} images.")
