import { Scene } from './scene';

export function download(name: string, data: Blob | string, type = 'application/octet-stream'): void {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fmt = (n: number) => n.toFixed(4).replace(/\.?0+$/, '');

/**
 * Full-size SVG (1 unit = 1 inch) with every front and tile outline, for
 * printing layout templates. Each front is its own group, so it can be
 * isolated in an SVG editor.
 */
export function sceneToSvg(scene: Scene): string {
  const { width: W, height: H } = scene.elevation;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}in" height="${H}in" viewBox="0 0 ${W} ${H}">`,
    '<style>.cab{fill:none;stroke:#999;stroke-width:0.03}.front{fill:none;stroke:#000;stroke-width:0.03}'
      + '.tile{fill:#f2e6d8;stroke:#000;stroke-width:0.01}.tile.m{fill:#d9c3ab}.margin{fill:none;stroke:#c00;stroke-width:0.01;stroke-dasharray:0.1 0.1}</style>',
  ];
  for (const c of scene.elevation.cabinets) {
    out.push(`<rect class="cab" x="${c.rect.x}" y="${c.rect.y}" width="${c.rect.w}" height="${c.rect.h}"/>`);
  }
  for (const f of scene.elevation.fronts) {
    const r = f.rect, m = scene.tileArea.get(f.id)!;
    out.push(`<g id="${f.id}">`);
    out.push(`<rect class="front" x="${fmt(r.x)}" y="${fmt(r.y)}" width="${fmt(r.w)}" height="${fmt(r.h)}"/>`);
    out.push(`<rect class="margin" x="${fmt(m.x)}" y="${fmt(m.y)}" width="${fmt(m.w)}" height="${fmt(m.h)}"/>`);
    for (const t of scene.tiles.get(f.id) ?? []) {
      const pts = t.verts.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(' ');
      out.push(`<polygon class="tile${t.mirrored ? ' m' : ''}" data-role="${t.role}" points="${pts}"/>`);
    }
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('\n');
}
