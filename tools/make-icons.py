#!/usr/bin/env python3
# runs-in: host
"""Generate the app icons from icon.png.

Pure standard library: zlib is all a non-interlaced 8-bit RGB PNG needs, so
this pulls in no dependency and stays reproducible. Run from the repo root:

    python3 tools/make-icons.py

Writes icon-192.png, icon-512.png and icon-maskable-512.png. icon.png stays as
the master artwork and is not shipped to the browser: nothing references it, not
the manifest, not index.html, not the service worker. It is 1.1MB and only this
script reads it, so it looks like dead weight and is not - deleting it would
leave the icons unreproducible.
"""

import struct
import zlib

SOURCE = 'icon.png'

# A maskable icon is only guaranteed the central circle of 80% diameter; the
# platform may crop anything outside it into a squircle, circle or teardrop.
MASKABLE_SAFE_FRACTION = 0.8

PAETH_UNAVAILABLE = -1


def read_png(path):
    """Return (width, height, RGB bytearray) for an 8-bit non-interlaced PNG."""
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'{path} is not a PNG')

    pos, idat = 8, bytearray()
    width = height = None

    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]

        if kind == b'IHDR':
            width, height, depth, colour, _, _, interlace = struct.unpack('>IIBBBBB', body)
            if (depth, colour, interlace) != (8, 2, 0):
                raise ValueError(f'{path}: expected 8-bit RGB non-interlaced, '
                                 f'got depth={depth} colour={colour} interlace={interlace}')
        elif kind == b'IDAT':
            idat += body
        elif kind == b'IEND':
            break

        pos += 12 + length

    return width, height, unfilter(zlib.decompress(bytes(idat)), width, height)


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def unfilter(raw, width, height):
    """Reverse the per-scanline filters PNG applies before compression."""
    stride = width * 3
    out = bytearray(height * stride)
    previous = bytearray(stride)
    pos = 0

    for y in range(height):
        kind = raw[pos]
        line = bytearray(raw[pos + 1:pos + 1 + stride])
        pos += 1 + stride

        if kind == 1:                                     # Sub
            for i in range(3, stride):
                line[i] = (line[i] + line[i - 3]) & 0xFF
        elif kind == 2:                                   # Up
            for i in range(stride):
                line[i] = (line[i] + previous[i]) & 0xFF
        elif kind == 3:                                   # Average
            for i in range(stride):
                left = line[i - 3] if i >= 3 else 0
                line[i] = (line[i] + ((left + previous[i]) >> 1)) & 0xFF
        elif kind == 4:                                   # Paeth
            for i in range(stride):
                left = line[i - 3] if i >= 3 else 0
                upleft = previous[i - 3] if i >= 3 else 0
                line[i] = (line[i] + paeth(left, previous[i], upleft)) & 0xFF
        elif kind != 0:
            raise ValueError(f'unknown filter type {kind} on row {y}')

        out[y * stride:(y + 1) * stride] = line
        previous = line

    return out


def write_png(path, width, height, pixels):
    """Write an 8-bit RGB PNG, choosing a filter per row the way encoders do."""
    stride = width * 3
    raw = bytearray()
    previous = bytearray(stride)

    for y in range(height):
        line = pixels[y * stride:(y + 1) * stride]
        left = lambda i: line[i - 3] if i >= 3 else 0
        upleft = lambda i: previous[i - 3] if i >= 3 else 0

        candidates = [
            (0, bytes(line)),
            (1, bytes((line[i] - left(i)) & 0xFF for i in range(stride))),
            (2, bytes((line[i] - previous[i]) & 0xFF for i in range(stride))),
            (3, bytes((line[i] - ((left(i) + previous[i]) >> 1)) & 0xFF for i in range(stride))),
            (4, bytes((line[i] - paeth(left(i), previous[i], upleft(i))) & 0xFF for i in range(stride)))
        ]

        # The usual heuristic: prefer the filter whose output is closest to zero
        cost, kind, encoded = min((sum(min(b, 256 - b) for b in body), k, body)
                                  for k, body in candidates)
        raw.append(kind)
        raw += encoded
        previous = line

    def chunk(kind, body):
        return (struct.pack('>I', len(body)) + kind + body
                + struct.pack('>I', zlib.crc32(kind + body) & 0xFFFFFFFF))

    header = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', header)
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))

    open(path, 'wb').write(png)
    return len(png)


def coverage(length, new_length):
    """For each output index, the source indices it covers and their normalised
    weights. Precomputed once per axis so the pixel loops stay tight."""
    scale = length / new_length
    table = []

    for out_index in range(new_length):
        start, end = out_index * scale, (out_index + 1) * scale
        first, last = int(start), min(int(end - 1e-9) + 1, length)

        pairs = [(i, min(end, i + 1) - max(start, i)) for i in range(first, last)]
        pairs = [(i, w) for i, w in pairs if w > 0]
        total = sum(w for _, w in pairs)
        table.append([(i, w / total) for i, w in pairs])

    return table


def resize_area(pixels, width, height, new_width, new_height):
    """Separable area-average resample: every output pixel is the weighted mean
    of the source pixels it covers, which is the right filter for downscaling."""

    columns = coverage(width, new_width)
    wide = bytearray(height * new_width * 3)

    for y in range(height):
        row, out_row = y * width * 3, y * new_width * 3
        for x, pairs in enumerate(columns):
            r = g = b = 0.0
            for i, weight in pairs:
                p = row + i * 3
                r += pixels[p] * weight
                g += pixels[p + 1] * weight
                b += pixels[p + 2] * weight
            o = out_row + x * 3
            wide[o] = min(255, int(r + 0.5))
            wide[o + 1] = min(255, int(g + 0.5))
            wide[o + 2] = min(255, int(b + 0.5))

    rows = coverage(height, new_height)
    out = bytearray(new_height * new_width * 3)

    for y, pairs in enumerate(rows):
        out_row = y * new_width * 3
        for x in range(new_width):
            r = g = b = 0.0
            for i, weight in pairs:
                p = (i * new_width + x) * 3
                r += wide[p] * weight
                g += wide[p + 1] * weight
                b += wide[p + 2] * weight
            o = out_row + x * 3
            out[o] = min(255, int(r + 0.5))
            out[o + 1] = min(255, int(g + 0.5))
            out[o + 2] = min(255, int(b + 0.5))

    return out


def topmost_glyph(pixels, width, height, background, tolerance=12):
    """Bounding box of the first ink block from the top, split off at the first
    clear horizontal band. The artwork is a calendar mark above a wordmark, and
    a wordmark cannot survive a circular crop - only the mark is worth masking."""
    rows = []
    for y in range(height):
        row = y * width * 3
        rows.append(any(
            abs(pixels[row + x * 3] - background[0]) > tolerance
            or abs(pixels[row + x * 3 + 1] - background[1]) > tolerance
            or abs(pixels[row + x * 3 + 2] - background[2]) > tolerance
            for x in range(width)
        ))

    top = rows.index(True)
    gap = max(4, height // 50)
    bottom = height

    run = 0
    for y in range(top, height):
        run = run + 1 if not rows[y] else 0
        if run >= gap:
            bottom = y - run + 1
            break

    left, right = width, -1
    for y in range(top, bottom):
        row = y * width * 3
        for x in range(width):
            p = row + x * 3
            if (abs(pixels[p] - background[0]) > tolerance
                    or abs(pixels[p + 1] - background[1]) > tolerance
                    or abs(pixels[p + 2] - background[2]) > tolerance):
                left = min(left, x)
                right = max(right, x)

    return left, top, right + 1, bottom


def ink_bounds(pixels, width, height, background, tolerance=12):
    """Bounding box of everything that is not the flat background."""
    left, top, right, bottom = width, height, -1, -1

    for y in range(height):
        row = y * width * 3
        for x in range(width):
            p = row + x * 3
            if (abs(pixels[p] - background[0]) > tolerance
                    or abs(pixels[p + 1] - background[1]) > tolerance
                    or abs(pixels[p + 2] - background[2]) > tolerance):
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)

    return left, top, right + 1, bottom + 1


def crop(pixels, width, box):
    left, top, right, bottom = box
    out = bytearray()
    for y in range(top, bottom):
        out += pixels[(y * width + left) * 3:(y * width + right) * 3]
    return out, right - left, bottom - top


def main():
    width, height, pixels = read_png(SOURCE)
    print(f'{SOURCE}: {width}x{height}')

    for size in (192, 512):
        out = f'icon-{size}.png'
        written = write_png(out, size, size, resize_area(pixels, width, height, size, size))
        print(f'  {out}: {size}x{size}, {written:,} bytes')

    background = (pixels[0], pixels[1], pixels[2])
    whole = ink_bounds(pixels, width, height, background)
    box = topmost_glyph(pixels, width, height, background)
    art, art_width, art_height = crop(pixels, width, box)
    print(f'  all ink {whole}, calendar mark {box} ({art_width}x{art_height}), '
          f'background {background}')

    # Scale so the artwork's own bounding circle fits the guaranteed safe circle,
    # rather than assuming a square 80% inset the mask does not actually promise
    size = 512
    diagonal = (art_width ** 2 + art_height ** 2) ** 0.5
    factor = MASKABLE_SAFE_FRACTION * size / diagonal
    new_width, new_height = max(1, round(art_width * factor)), max(1, round(art_height * factor))
    scaled = resize_area(art, art_width, art_height, new_width, new_height)

    canvas = bytearray(bytes(background) * (size * size))
    offset_x, offset_y = (size - new_width) // 2, (size - new_height) // 2
    for y in range(new_height):
        start = ((offset_y + y) * size + offset_x) * 3
        canvas[start:start + new_width * 3] = scaled[y * new_width * 3:(y + 1) * new_width * 3]

    written = write_png('icon-maskable-512.png', size, size, canvas)
    print(f'  icon-maskable-512.png: {size}x{size}, artwork inset to '
          f'{new_width}x{new_height} ({factor:.0%}), {written:,} bytes')


if __name__ == '__main__':
    main()
