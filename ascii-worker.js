self.onmessage = ({ data }) => {
  const { id, pixels, columns, rows, palette, chars } = data;
  const rgba = new Uint8ClampedArray(pixels);
  const indices = new Uint8Array(columns * rows);
  const colors = new Uint8ClampedArray(columns * rows * 3);
  for (let i = 0; i < columns * rows; i++) {
    const p = i * 4, r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    const brightness = (r * .299 + g * .587 + b * .114) / 255;
    indices[i] = Math.min(chars.length - 1, Math.floor(brightness * (chars.length - 1)));
    let cr, cg, cb;
    if (palette === "mono") cr = cg = cb = Math.round(95 + brightness * 155);
    else if (palette === "matrix") {
      const tone = Math.round(65 + brightness * 170);
      cr = Math.round(tone * .58); cg = tone; cb = Math.round(tone * .42);
    } else {
      const lift = .32 + brightness * .68;
      cr = Math.round(r * lift); cg = Math.round(g * lift); cb = Math.round(b * lift);
    }
    const c = i * 3; colors[c] = cr; colors[c + 1] = cg; colors[c + 2] = cb;
  }
  self.postMessage({ id, indices: indices.buffer, colors: colors.buffer }, [indices.buffer, colors.buffer]);
};