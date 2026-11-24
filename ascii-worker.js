self.onmessage = ({ data }) => {
  const { id, pixels, columns, rows, palette, chars } = data;
  const rgba = new Uint8ClampedArray(pixels);
  const indices = new Uint8Array(columns * rows);
  const colors = new Uint8ClampedArray(columns * rows * 3);
  for (let i = 0; i < columns * rows; i++) {
    const p = i * 4, r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    // Rec.709 luma drives glyph selection; full-color output keeps source RGB intact.
    const brightness = (r * .2126 + g * .7152 + b * .0722) / 255;
    indices[i] = Math.min(chars.length - 1, Math.floor(brightness * (chars.length - 1)));
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