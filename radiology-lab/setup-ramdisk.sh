#!/usr/bin/env bash
# setup-ramdisk.sh — mount the 6 GB RAM disk and copy datasets from Windows into it.
# Run this once per WSL session before training (the RAM disk is lost on WSL restart).
#
# Usage:  bash setup-ramdisk.sh [--copy]
#   --copy   also copy datasets from their Windows source paths (slow first time)
#
# Windows dataset source paths (edit these to match where you downloaded the data):
KITS23_SRC="/mnt/c/Users/dell/Desktop/ramdani/datasets/kits23"
TOTALSEG_SRC="/mnt/c/Users/dell/Desktop/ramdani/datasets/totalseg"
RSNA_SRC="/mnt/c/Users/dell/Desktop/ramdani/datasets/rsna"
LIDC_SRC="/mnt/c/Users/dell/Desktop/ramdani/datasets/lidc"
NIH_SRC="/mnt/c/Users/dell/Desktop/ramdani/datasets/nih"

set -e

# --- Mount RAM disk if not already mounted ---
if mountpoint -q /mnt/ramdisk; then
    echo "[ramdisk] Already mounted."
else
    echo "[ramdisk] Mounting 6 GB tmpfs..."
    sudo mkdir -p /mnt/ramdisk
    sudo mount -t tmpfs -o size=6G tmpfs /mnt/ramdisk
    echo "[ramdisk] Mounted."
fi

mkdir -p /mnt/ramdisk/{kits23,totalseg,rsna,lidc,nih}

# --- Copy datasets if requested ---
if [[ "$1" == "--copy" ]]; then
    copy_if_exists() {
        local src="$1" dst="$2" name="$3"
        if [ -d "$src" ]; then
            echo "[ramdisk] Copying $name..."
            rsync -a --info=progress2 "$src/" "$dst/"
            echo "[ramdisk] $name done."
        else
            echo "[ramdisk] SKIP $name — not found at $src"
        fi
    }
    copy_if_exists "$KITS23_SRC"    /mnt/ramdisk/kits23   "KiTS23"
    copy_if_exists "$TOTALSEG_SRC"  /mnt/ramdisk/totalseg "TotalSeg"
    copy_if_exists "$RSNA_SRC"      /mnt/ramdisk/rsna     "RSNA"
    copy_if_exists "$LIDC_SRC"      /mnt/ramdisk/lidc     "LIDC-IDRI"
    copy_if_exists "$NIH_SRC"       /mnt/ramdisk/nih      "NIH CXR14"
fi

echo ""
df -h /mnt/ramdisk
echo "[ramdisk] Ready. Run training with: make train-kits, make train-rsna, etc."
