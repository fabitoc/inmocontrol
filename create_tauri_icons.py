import os
from PIL import Image, ImageDraw

icons_dir = os.path.join("src-tauri", "icons")
os.makedirs(icons_dir, exist_ok=True)

def make_icon(size):
    img = Image.new("RGBA", (size, size), (37, 99, 235, 255))
    draw = ImageDraw.Draw(img)
    margin = size // 6
    draw.rectangle([margin, margin, size - margin, size - margin], fill=(255, 255, 255, 255))
    inner = size // 3
    draw.rectangle([inner, inner, size - inner, size - inner], fill=(37, 99, 235, 255))
    return img

# Generate PNGs
make_icon(32).save(os.path.join(icons_dir, "32x32.png"))
make_icon(128).save(os.path.join(icons_dir, "128x128.png"))
make_icon(256).save(os.path.join(icons_dir, "128x128@2x.png"))

# Generate ICO
ico_img = make_icon(256)
ico_img.save(os.path.join(icons_dir, "icon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

# Generate dummy ICNS / placeholding binary
icns_img = make_icon(256)
icns_img.save(os.path.join(icons_dir, "icon.icns"), format="PNG")

print("Tauri icons created successfully in src-tauri/icons")
