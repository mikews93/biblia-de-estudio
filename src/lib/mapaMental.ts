import { splitCites, verseRange } from './herramientas';

// Mapa mental de un capítulo: la IA escribe un esquema («# idea central», «- rama», «  - idea») y
// aquí se convierte en árbol, con el versículo de cada nodo para poder abrirlo.

export type MindNode = { text: string; from?: number; to?: number; cites: number[] };
export type MindBranch = MindNode & { leaves: MindNode[] };
export type MindMap = { title: string; branches: MindBranch[] };

function node(raw: string): MindNode {
  const { text, cites } = splitCites(raw);
  const r = verseRange(text);
  return { text: r.text.replace(/[.;:]$/, ''), from: r.from, to: r.to, cites };
}

export function parseMindMap(text: string): MindMap {
  let title = '';
  const branches: MindBranch[] = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    const line = raw.replace(/\*\*/g, '').replace(/\t/g, '  ');
    const h = line.match(/^\s*#{1,3}\s+(.+)$/);
    const item = line.match(/^(\s*)[-*•]\s+(.+)$/);
    if (h && !title) title = node(h[1]).text;
    else if (item && item[1].length < 2) branches.push({ ...node(item[2]), leaves: [] });
    else if (item && branches.length) branches[branches.length - 1].leaves.push(node(item[2]));
    else if (/^\s*(⟦\d+⟧\s*)+$/.test(line)) {
      // Marcas de cita sueltas: van con el último nodo
      const b = branches[branches.length - 1];
      const target = b?.leaves[b.leaves.length - 1] ?? b;
      if (target) target.cites = [...new Set([...target.cites, ...splitCites(line).cites])];
    }
  }
  return { title, branches: branches.filter((b) => b.text) };
}

/** «v. 3» o «vv. 1-8» */
export const versesLabel = (n: MindNode) =>
  n.from === undefined ? '' : n.to && n.to !== n.from ? `vv. ${n.from}-${n.to}` : `v. ${n.from}`;
