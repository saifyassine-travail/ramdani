"""
Downloads MedSAM2 pre-trained weights from HuggingFace.
Run once before starting the server:  python setup_weights.py
"""

import os
import sys
import urllib.request

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")
os.makedirs(WEIGHTS_DIR, exist_ok=True)

MODELS = {
    "MedSAM2_pretrain.pth": {
        "url": "https://huggingface.co/wanglab/medsam2/resolve/main/MedSAM2_pretrain.pth",
        "size_mb": 180,
        "description": "MedSAM2 fine-tuned on medical images (CT, MRI, X-ray, ultrasound)",
    },
}


def _progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        pct = min(downloaded / total_size * 100, 100)
        bar = "#" * int(pct / 2)
        sys.stdout.write(f"\r  [{bar:<50}] {pct:.1f}%")
        sys.stdout.flush()
        if pct >= 100:
            print()


def download_weights():
    print("=" * 60)
    print("  MedSAM2 Weight Downloader")
    print("=" * 60)

    for filename, info in MODELS.items():
        dest = os.path.join(WEIGHTS_DIR, filename)

        if os.path.exists(dest):
            size_mb = os.path.getsize(dest) / 1024 / 1024
            print(f"\n[SKIP] {filename} already exists ({size_mb:.0f} MB)")
            continue

        print(f"\nDownloading {filename} (~{info['size_mb']} MB)")
        print(f"  {info['description']}")
        print(f"  From: {info['url']}")

        try:
            urllib.request.urlretrieve(info["url"], dest, _progress)
            size_mb = os.path.getsize(dest) / 1024 / 1024
            print(f"  Saved to {dest} ({size_mb:.1f} MB)")
        except Exception as exc:
            print(f"\n[ERROR] Download failed: {exc}")
            print()
            print("  Manual download instructions:")
            print(f"  1. Visit: {info['url']}")
            print(f"  2. Save the file as: {dest}")
            if os.path.exists(dest):
                os.remove(dest)

    print("\n" + "=" * 60)
    print("  Done. Start the server with:  python main.py")
    print("=" * 60)


if __name__ == "__main__":
    download_weights()
