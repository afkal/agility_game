// Development-only endpoint for the outfit studio: saves item placements into
// shared/wardrobe-placement.ts. It exists only inside `vite` dev; the built
// game and the game server never have it.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const TARGET = fileURLToPath(new URL('../shared/wardrobe-placement.ts', import.meta.url));
const ROUND = (n: number) => Math.round(n * 100) / 100;

type Placement = { dx: number; dy: number; scale: number; rotation: number };

function isPlacement(value: unknown): value is Placement {
  const p = value as Placement;
  return (
    typeof p === 'object' &&
    p !== null &&
    [p.dx, p.dy, p.scale, p.rotation].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    p.scale > 0
  );
}

/** The placements file's text, with only items and dogs that move away from where they are drawn. */
export function placementSource(placements: Record<string, Record<string, Placement>>): string {
  const lines: string[] = [];
  for (const item of Object.keys(placements).sort()) {
    const dogs = Object.entries(placements[item]!)
      .filter(([, p]) => p.dx !== 0 || p.dy !== 0 || p.scale !== 1 || p.rotation !== 0)
      .sort(([a], [b]) => a.localeCompare(b));
    if (dogs.length === 0) continue;
    lines.push(`  '${item}': {`);
    for (const [dog, p] of dogs) {
      lines.push(`    ${dog}: { dx: ${ROUND(p.dx)}, dy: ${ROUND(p.dy)}, scale: ${ROUND(p.scale)}, rotation: ${ROUND(p.rotation)} },`);
    }
    lines.push('  },');
  }
  return `// Where each item sits on each dog, as set in the outfit studio
// (/asustestudio on the development server). The studio rewrites this file;
// edit it there rather than by hand.

import type { Placements } from './wardrobe.ts';

export const PLACEMENTS: Placements = {${lines.length ? `\n${lines.join('\n')}\n` : ''}};
`;
}

export function studioPlugin(): Plugin {
  return {
    name: 'outfit-studio',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__studio/placements', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const placements = JSON.parse(body) as Record<string, Record<string, unknown>>;
            const valid = Object.values(placements).every((dogs) => Object.values(dogs).every(isPlacement));
            if (!valid) throw new Error('invalid placement');
            writeFileSync(TARGET, placementSource(placements as Record<string, Record<string, Placement>>));
            res.setHeader('content-type', 'application/json');
            res.end('{"saved":true}');
          } catch {
            res.statusCode = 400;
            res.end('{"saved":false}');
          }
        });
      });
    },
  };
}
