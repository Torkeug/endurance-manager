"""
Build script for Kronos iRacing Bridge.
Produces a single Windows executable: dist/KronosBridge.exe

Run from the iracing-bridge directory using whichever Python has the
required dependencies installed (irsdk, requests, pystray, Pillow,
PyInstaller):

    python build.py
"""

import subprocess
import sys
from pathlib import Path

from PIL import Image

BRIDGE_DIR = Path(__file__).parent
LOGO_PNG = BRIDGE_DIR.parent / "public" / "kronos-logo.png"
GENERATED_ICO = BRIDGE_DIR / "KronosBridge.ico"

# Standard Windows icon sizes — covers all DPI modes including list view (16px)
# and high-DPI taskbar (256px)
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def generate_icon() -> Path:
    """Generate a multi-size .ico from kronos-logo.png."""
    src = Image.open(LOGO_PNG).convert("RGBA")
    frames = [src.resize((s, s), Image.Resampling.LANCZOS) for s in ICO_SIZES]
    frames[0].save(
        GENERATED_ICO,
        format="ICO",
        append_images=frames[1:],
        sizes=[(s, s) for s in ICO_SIZES],
    )
    print(f"Generated icon: {GENERATED_ICO} ({', '.join(str(s) for s in ICO_SIZES)}px)")
    return GENERATED_ICO


def build() -> None:
    icon = generate_icon()

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onefile",
        "--windowed",                          # no console window
        "--name", "KronosBridge",
        "--icon", str(icon),
        "--hidden-import", "pystray._win32",   # pystray Windows backend
        "--hidden-import", "PIL._imagingtk",
        str(BRIDGE_DIR / "kronos_bridge.py"),
    ]
    print(f"Building KronosBridge.exe using {sys.executable}...")
    result = subprocess.run(cmd, cwd=str(BRIDGE_DIR), check=False)
    if result.returncode == 0:
        print(f"\nDone — {BRIDGE_DIR / 'dist' / 'KronosBridge.exe'} is ready to distribute.")
    else:
        print("\nBuild failed.")
        sys.exit(result.returncode)


if __name__ == "__main__":
    build()
