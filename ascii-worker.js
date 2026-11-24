self.onmessage = ({ data }) => {
  const { id, pixels, columns, rows, palette, chars } = data;
  const rgba = new Uint8ClampedArray(pixels);
  const sampleWidth = columns * 2;
  const indices = new Uint8Array(columns * rows);
  const colors = new Uint8ClampedArray(columns * rows * 3);
  for (let i = 0; i < columns * rows; i++) {
    const x = (i % columns) * 2, y = Math.floor(i / columns) * 2;
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const p = ((y + sy) * sampleWidth + x + sx) * 4;
      r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2];
    }
    r = Math.round(r / 4); g = Math.round(g / 4); b = Math.round(b / 4);
    // Rec.709 luma drives glyph selection; averaged source RGB remains un-darkened.
    const brightness = (r * .2126 + g * .7152 + b * .0722) / 255;
    indices[i] = Math.min(chars.length - 1, Math.round(brightness * (chars.length - 1)));
    let cr, cg, cb;
    if (palette === "mono") cr = cg = cb = Math.round(32 + brightness * 223);
    else if (palette === "matrix") {
      const tone = Math.round(32 + brightness * 223);
      cr = Math.round(tone * .34); cg = tone; cb = Math.round(tone * .22);
    } else {
      // No brightness multiplier: dark and mid-tone pixels are not artificially crushed.
      cr = r; cg = g; cb = b;
    }
    const c = i * 3; colors[c] = cr; colors[c + 1] = cg; colors[c + 2] = cb;
  }
  self.postMessage({ id, indices: indices.buffer, colors: colors.buffer }, [indices.buffer, colors.buffer]);
};