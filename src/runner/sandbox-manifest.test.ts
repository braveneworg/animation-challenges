import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const VENDOR_STEM_BY_SPECIFIER: Readonly<Record<string, string>> = {
  react: 'react',
  'react/jsx-runtime': 'react-jsx-runtime',
  'react-dom': 'react-dom',
  'react-dom/client': 'react-dom-client',
  motion: 'motion',
  'motion/react': 'motion-react',
};

function importMapOf(html: string): Record<string, string> {
  const match = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
  if (match === null || match[1] === undefined) throw new Error('sandbox.html has no import map');
  const parsed: unknown = JSON.parse(match[1]);
  if (typeof parsed !== 'object' || parsed === null || !('imports' in parsed)) throw new Error('no imports key');
  const imports: unknown = parsed.imports;
  if (typeof imports !== 'object' || imports === null) throw new Error('imports is not an object');
  const result: Record<string, string> = {};
  for (const key of Object.keys(imports)) {
    const value: unknown = Reflect.get(imports, key);
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

describe('sandbox.html manifest', () => {
  test('the import map covers exactly the six specifiers of spec §6.2 with dev vendor urls', () => {
    const imports = importMapOf(readFileSync('sandbox.html', 'utf8'));
    expect(Object.keys(imports).sort()).toEqual(Object.keys(VENDOR_STEM_BY_SPECIFIER).sort());
    for (const [specifier, stem] of Object.entries(VENDOR_STEM_BY_SPECIFIER)) {
      expect(imports[specifier]).toBe(`/src/sandbox/vendor/${stem}.ts`);
      expect(existsSync(`src/sandbox/vendor/${stem}.ts`)).toBe(true);
    }
  });

  test('sandbox.html declares the stage, the CSP meta, and the module entry', () => {
    const html = readFileSync('sandbox.html', 'utf8');
    expect(html).toContain('<div id="stage">');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain('/src/sandbox/main.ts');
  });

  test('vite.config.ts declares a build input for every vendor stem', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    for (const stem of Object.values(VENDOR_STEM_BY_SPECIFIER)) {
      expect(config.includes(`'${stem}'`)).toBe(true);
    }
    expect(config).toContain("resolve(rootDir, 'sandbox.html')");
  });
});
