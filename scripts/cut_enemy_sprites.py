"""Cut every enemy pose independently and place it on a stable per-role canvas."""

from pathlib import Path
from collections import deque
from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / "public" / "assets" / "enemy-roles-atlas.png"
ENEMY_DIR = ROOT / "public" / "assets" / "sprites" / "enemy"
BOSS_DIR = ROOT / "public" / "assets" / "sprites" / "boss"

# The generated source is visually arranged as four rows, but the figures are
# not aligned to a mathematical grid. These bands isolate one figure at a time.
ROW_BANDS = [(0, 235), (235, 465), (465, 715), (715, 1086)]
COL_BANDS = [(0, 360), (360, 720), (720, 1080), (1080, 1448)]
# The antlered boss row has wider first poses and a corpse beginning earlier.
BOSS_COL_BANDS = [(0, 375), (375, 720), (720, 1025), (1025, 1448)]
ALPHA_THRESHOLD = 20
PADDING = 10


def isolate_largest_figure(image: Image.Image) -> Image.Image:
    mask = image.getchannel("A").point(lambda alpha: 255 if alpha > ALPHA_THRESHOLD else 0)
    pixels = mask.load()
    visited = bytearray(image.width * image.height)
    largest: list[tuple[int, int]] = []
    for y in range(image.height):
        for x in range(image.width):
            index = y * image.width + x
            if visited[index] or not pixels[x, y]:
                continue
            visited[index] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= image.width or ny >= image.height:
                        continue
                    neighbor = ny * image.width + nx
                    if visited[neighbor] or not pixels[nx, ny]:
                        continue
                    visited[neighbor] = 1
                    queue.append((nx, ny))
            if len(component) > len(largest):
                largest = component
    keep = Image.new("L", image.size, 0)
    keep_pixels = keep.load()
    for x, y in largest:
        keep_pixels[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(7))
    isolated = image.copy()
    isolated.putalpha(ImageChops.multiply(image.getchannel("A"), keep))
    bbox = keep.getbbox()
    if bbox is None:
        raise RuntimeError("Sprite cell contains no visible pixels")
    left, top, right, bottom = bbox
    return isolated.crop((max(0, left - 3), max(0, top - 3), min(image.width, right + 3), min(image.height, bottom + 3)))


def main() -> None:
    atlas = Image.open(ATLAS).convert("RGBA")
    rows: list[list[Image.Image]] = []
    for row_index, (top, bottom) in enumerate(ROW_BANDS):
        poses: list[Image.Image] = []
        column_bands = BOSS_COL_BANDS if row_index == 3 else COL_BANDS
        for left, right in column_bands:
            cell = atlas.crop((left, top, right, bottom))
            poses.append(isolate_largest_figure(cell))
        rows.append(poses)

    for row_index, poses in enumerate(rows):
        canvas_width = max(pose.width for pose in poses) + PADDING * 2
        canvas_height = max(pose.height for pose in poses) + PADDING * 2
        for column_index, pose in enumerate(poses):
            canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
            # Ground-center alignment prevents apparent scaling and foot sliding.
            x = (canvas_width - pose.width) // 2
            y = canvas_height - PADDING - pose.height
            canvas.alpha_composite(pose, (x, y))
            destination = (BOSS_DIR / f"boss-c{column_index}.png") if row_index == 3 else (ENEMY_DIR / f"enemy-r{row_index}-c{column_index}.png")
            canvas.save(destination, optimize=True)


if __name__ == "__main__":
    main()
