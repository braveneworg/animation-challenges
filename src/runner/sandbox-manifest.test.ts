import { describe, expect, test } from 'vitest';

import sandboxHtml from '../../sandbox.html?raw';
import viteConfigSource from '../../vite.config.ts?raw';

const VENDOR_STEM_BY_SPECIFIER: Readonly<Record<string, string>> = {
  react: 'react',
  'react/jsx-runtime': 'react-jsx-runtime',
  'react-dom': 'react-dom',
  'react-dom/client': 'react-dom-client',
  motion: 'motion',
  'motion/react': 'motion-react',
};

// Keys alone prove the module exists in the build graph — a stronger check than fs existence,
// since it fails if the file is renamed even before anything ever imports it. The loader values
// (dynamic `import()` functions) are never invoked.
const vendorModules = import.meta.glob('../sandbox/vendor/*.ts');

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
    const imports = importMapOf(sandboxHtml);
    expect(Object.keys(imports).sort()).toEqual(Object.keys(VENDOR_STEM_BY_SPECIFIER).sort());
    for (const [specifier, stem] of Object.entries(VENDOR_STEM_BY_SPECIFIER)) {
      expect(imports[specifier]).toBe(`/src/sandbox/vendor/${stem}.ts`);
      expect(Object.keys(vendorModules)).toContain(`../sandbox/vendor/${stem}.ts`);
    }
  });

  test('sandbox.html declares the stage, the CSP meta, and the module entry', () => {
    expect(sandboxHtml).toContain('<div id="stage">');
    expect(sandboxHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(sandboxHtml).toContain('/src/sandbox/main.ts');
  });

  test('vite.config.ts declares a build input for every vendor stem', () => {
    for (const stem of Object.values(VENDOR_STEM_BY_SPECIFIER)) {
      expect(viteConfigSource.includes(`'${stem}'`)).toBe(true);
    }
    expect(viteConfigSource).toContain("resolve(rootDir, 'sandbox.html')");
  });
});
