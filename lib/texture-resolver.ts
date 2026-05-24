/**
 * Maps Vintage Story block codes to texture URL paths served by /api/textures/.
 * Returns null if no texture is available (caller should use a fallback colour).
 *
 * Texture paths are relative to the {DATA_DIR}/textures/ directory.
 * Verified against the bundled textures/ directory in this project.
 */

function tex(path: string): string {
  return `/api/textures/${path}`;
}

export function resolveTexture(blockcode: string): string | null {
  // game:drystone-{rock}
  {
    const m = blockcode.match(/^game:drystone-(.+)$/);
    if (m) return tex(`stone/drystone/${m[1]}1.png`);
  }

  // game:polishedrockold-{variant}-{rock}  (e.g. polishedrockold-full-basalt)
  {
    const m = blockcode.match(/^game:polishedrockold-([^-]+)-(.+)$/);
    if (m) return tex(`stone/polishedrock-old/${m[1]}/${m[2]}1.png`);
  }

  // game:rockpolished-{rock}
  {
    const m = blockcode.match(/^game:rockpolished-(.+)$/);
    if (m) return tex(`stone/polishedrock/${m[1]}.png`);
  }

  // game:planks-veryaged-*  (must be checked before generic planks rule)
  if (/^game:planks-veryaged/.test(blockcode)) {
    return tex('wood/planks/aged/veryaged1.png');
  }

  // game:planks-{type}-*
  {
    const m = blockcode.match(/^game:planks-([^-]+)/);
    if (m) return tex(`wood/planks/${m[1]}1.png`);
  }

  // game:plankslab-veryaged-*
  if (/^game:plankslab-veryaged/.test(blockcode)) {
    return tex('wood/planks/aged/veryaged1.png');
  }

  // game:plankslab-{type}-*
  {
    const m = blockcode.match(/^game:plankslab-([^-]+)/);
    if (m) return tex(`wood/planks/${m[1]}1.png`);
  }

  // game:agedstonebricks-{rock}
  {
    const m = blockcode.match(/^game:agedstonebricks-(.+)$/);
    if (m) return tex(`stone/agedbrick/${m[1]}1.png`);
  }

  // game:crackedstonebricks-{rock}
  {
    const m = blockcode.match(/^game:crackedstonebricks-(.+)$/);
    if (m) return tex(`stone/crackedbrick/${m[1]}1.png`);
  }

  // game:stonebricks-{rock}
  {
    const m = blockcode.match(/^game:stonebricks-(.+)$/);
    if (m) return tex(`stone/stonebrick/${m[1]}1.png`);
  }

  // game:glass-{type}
  {
    const m = blockcode.match(/^game:glass-(.+)$/);
    if (m) return tex(`glass/${m[1]}.png`);
  }

  // game:metalblock-corroded-plain-rusty-*
  if (/^game:metalblock-corroded-plain-rusty/.test(blockcode)) {
    return tex('metal/corroded/rusty1.png');
  }

  // game:metalblock-corroded-plain-normal-*
  if (/^game:metalblock-corroded-plain-normal/.test(blockcode)) {
    return tex('metal/corroded/normal1.png');
  }

  // game:metalblock-corroded-*  (fallback for other corroded variants)
  if (/^game:metalblock-corroded/.test(blockcode)) {
    return tex('metal/corroded/rusty1.png');
  }

  // game:creativeglow-*  — no texture, use emissive colour
  if (/^game:creativeglow/.test(blockcode)) {
    return null;
  }

  return null;
}

/**
 * Returns an approximate CSS hex colour for use in gallery material swatches.
 */
export function blockcodeToColor(blockcode: string): string {
  if (blockcode.includes('drystone')) return '#8B7355';
  if (blockcode.includes('polishedrock') || blockcode.includes('rockpolished')) return '#9B9B9B';
  if (blockcode.includes('planks') || blockcode.includes('plank')) return '#C19A6B';
  if (blockcode.includes('agedstonebricks') || blockcode.includes('agedbrick')) return '#7B6B5B';
  if (blockcode.includes('crackedstonebricks') || blockcode.includes('crackedbrick')) return '#6B5B4B';
  if (blockcode.includes('stonebricks') || blockcode.includes('stonebrick')) return '#8B7B6B';
  if (blockcode.includes('glass')) return '#ADD8E6';
  if (blockcode.includes('metal')) return '#A8A9AD';
  if (blockcode.includes('glow') || blockcode.includes('creativeglow')) return '#FFE066';
  return '#888888';
}
