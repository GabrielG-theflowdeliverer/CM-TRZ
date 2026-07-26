import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Structural invariants that no feature test would notice.
 *
 * The layering rules in CLAUDE.md are enforced by lint (see eslint.config.js).
 * Import cycles are not: eslint can't see the whole graph, and the question
 * "does the server have a circular import?" was previously answerable only by
 * ad-hoc grepping — which is easy to get wrong, because a module-directory
 * view reports a cycle whenever any file under `a/` imports `b/` while any
 * file under `b/` imports `a/`, even when the two files form a perfectly fine
 * DAG. Resolving actual files is the only reading that matches what Node does.
 */

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Resolve every relative specifier to the file it names. The codebase is
 * NodeNext-style, so a `.js` specifier means the sibling `.ts`; a bare
 * directory means its `index.ts`. Bare specifiers (`express`, `@cmt/domain`)
 * are external and can't take part in a cycle inside this package.
 */
function buildImportGraph(files: string[]): Map<string, string[]> {
  const known = new Set(files);
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const edges: string[] = [];
    // Covers `import … from`, `export … from` and `import type … from` alike:
    // a type-only cycle is erased at runtime, but it is still a design cycle.
    for (const match of source.matchAll(/\bfrom\s+'(\.[^']*)'/g)) {
      const raw = path.resolve(path.dirname(file), match[1]!);
      const candidates = [raw.replace(/\.js$/, '.ts'), `${raw}.ts`, path.join(raw, 'index.ts')];
      const target = candidates.find((c) => known.has(c));
      if (target && target !== file) edges.push(target);
    }
    graph.set(file, edges);
  }
  return graph;
}

/** Tarjan's SCC: any component with more than one file is a genuine cycle. */
function findCycles(graph: Map<string, string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let counter = 0;

  const visit = (node: string): void => {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, index.get(next)!));
      }
    }

    if (low.get(node) === index.get(node)) {
      const component: string[] = [];
      for (;;) {
        const popped = stack.pop()!;
        onStack.delete(popped);
        component.push(popped);
        if (popped === node) break;
      }
      if (component.length > 1) cycles.push(component);
    }
  };

  for (const node of graph.keys()) if (!index.has(node)) visit(node);
  return cycles;
}

describe('server module graph', () => {
  it('has no circular imports', () => {
    const files = listSourceFiles(SRC).filter((f) => !f.endsWith('.test.ts'));
    // Guard against the check silently passing because it found nothing to read.
    expect(files.length).toBeGreaterThan(50);

    const cycles = findCycles(buildImportGraph(files)).map((cycle) =>
      cycle.map((f) => path.relative(SRC, f)).sort(),
    );

    // Named so a failure prints the offending files rather than just a count.
    expect(cycles).toEqual([]);
  });

  it('detects a cycle when one exists', () => {
    // The check above only means something if it can fail. This proves the
    // traversal finds a loop, so a green run is evidence and not an accident.
    const cycles = findCycles(
      new Map([
        ['a.ts', ['b.ts']],
        ['b.ts', ['c.ts']],
        ['c.ts', ['a.ts']],
        ['d.ts', ['a.ts']], // reaches the cycle without being in it
      ]),
    );
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});
