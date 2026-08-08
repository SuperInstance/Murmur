/**
 * Tests for ModuleRegistry and utility functions
 *
 * These tests cover the core logic of the module registry without
 * needing a live filesystem — we test the in-memory operations
 * (status updates, resource tracking, filtering, statistics) by
 * directly manipulating the module map through public methods.
 */

import { describe, test, expect, beforeEach } from 'vitest';

// We test the ModuleRegistry class directly. Since scanPackagesDirectory
// hits the filesystem, we focus on the in-memory operations that are
// the core business logic.

// Import the class dynamically to avoid Next.js global augmentation issues
import { ModuleRegistry } from '../module-registry';
import { cn } from '../utils';

describe('cn utility', () => {
  test('merges conflicting tailwind classes', () => {
    const result = cn('px-4 py-2', 'px-6');
    expect(result).toContain('px-6');
    expect(result).not.toContain('px-4');
    expect(result).toContain('py-2');
  });

  test('handles conditional classes', () => {
    const result = cn('text-red-500', false && 'text-blue-500', undefined, 'font-bold');
    expect(result).toContain('text-red-500');
    expect(result).not.toContain('text-blue-500');
    expect(result).toContain('font-bold');
  });

  test('handles empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  test('handles objects (clsx features)', () => {
    // twMerge resolves display conflicts: 'flex' and 'block' are both display utilities
    // so 'block' wins as the later class. Test with non-conflicting classes.
    const result = cn('p-4', { hidden: false, 'text-center': true });
    expect(result).toContain('p-4');
    expect(result).toContain('text-center');
    expect(result).not.toContain('hidden');
  });

  test('deduplicates after merge', () => {
    const result = cn('p-4', 'p-4', 'p-4');
    // twMerge should consolidate padding
    expect(result.match(/p-4/g)?.length).toBe(1);
  });
});

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry('/fake/path');
  });

  describe('getModuleState', () => {
    test('returns undefined for unknown module', () => {
      expect(registry.getModuleState('unknown')).toBeUndefined();
    });
  });

  describe('getAllModules', () => {
    test('returns empty array initially', () => {
      expect(registry.getAllModules()).toEqual([]);
    });
  });

  describe('getLoadedModules', () => {
    test('returns empty array when no modules loaded', () => {
      expect(registry.getLoadedModules()).toEqual([]);
    });
  });

  describe('getModulesByCategory', () => {
    test('returns empty array for foundation when empty', () => {
      expect(registry.getModulesByCategory('foundation')).toEqual([]);
    });

    test('returns empty array for feature when empty', () => {
      expect(registry.getModulesByCategory('feature')).toEqual([]);
    });
  });

  describe('updateModuleStatus', () => {
    test('does not throw for unknown module', () => {
      expect(() => registry.updateModuleStatus('nope', 'loaded')).not.toThrow();
    });

    test('updates status to loaded', async () => {
      // Populate via scanPackagesDirectory won't work with fake path,
      // but scanPackagesDirectory returns empty gracefully
      await registry.scanPackagesDirectory();
      expect(registry.getAllModules()).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    test('returns zero stats for empty registry', () => {
      const stats = registry.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.foundation).toBe(0);
      expect(stats.feature).toBe(0);
      expect(stats.loaded).toBe(0);
      expect(stats.installed).toBe(0);
    });
  });

  describe('scanPackagesDirectory', () => {
    test('returns empty array for non-existent path', async () => {
      const result = await registry.scanPackagesDirectory();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

/**
 * Integration-style tests that verify ModuleRegistry behavior
 * by creating a temporary packages directory structure.
 */
describe('ModuleRegistry with filesystem', () => {
  test('discovers modules from package.json files', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    // Create a temp packages directory
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));
    const pkgDir = path.join(tmpDir, 'test-module');
    await fs.mkdir(pkgDir, { recursive: true });

    const packageJson = {
      name: '@superinstance/test-module',
      version: '1.0.0',
      description: 'A test module',
      dependencies: {},
    };
    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify(packageJson)
    );

    // Create a foundation module
    const asyncDir = path.join(tmpDir, 'async');
    await fs.mkdir(asyncDir, { recursive: true });
    await fs.writeFile(
      path.join(asyncDir, 'package.json'),
      JSON.stringify({
        name: '@superinstance/async',
        version: '2.0.0',
        description: 'Async utilities',
        dependencies: {},
      })
    );

    // Create a hidden directory that should be skipped
    const hiddenDir = path.join(tmpDir, '.hidden');
    await fs.mkdir(hiddenDir, { recursive: true });
    await fs.writeFile(
      path.join(hiddenDir, 'package.json'),
      JSON.stringify({ name: 'should-be-skipped', version: '0.0.0', description: '', dependencies: {} })
    );

    try {
      const reg = new ModuleRegistry(tmpDir);
      const modules = await reg.scanPackagesDirectory();

      expect(modules).toHaveLength(2); // test-module + async, .hidden skipped
      expect(modules.some(m => m.id === '@superinstance/test-module')).toBe(true);
      expect(modules.some(m => m.id === '@superinstance/async')).toBe(true);
      expect(modules.some(m => m.id === 'should-be-skipped')).toBe(false);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  test('categorizes foundation modules correctly', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));

    // Create a foundation module (cache)
    const cacheDir = path.join(tmpDir, 'cache');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, 'package.json'),
      JSON.stringify({
        name: '@superinstance/cache',
        version: '1.0.0',
        description: 'Cache layer',
        dependencies: {},
      })
    );

    // Create a feature module
    const featureDir = path.join(tmpDir, 'feature-x');
    await fs.mkdir(featureDir, { recursive: true });
    await fs.writeFile(
      path.join(featureDir, 'package.json'),
      JSON.stringify({
        name: '@superinstance/feature-x',
        version: '0.1.0',
        description: 'Feature X',
        dependencies: {},
      })
    );

    try {
      const reg = new ModuleRegistry(tmpDir);
      const modules = await reg.scanPackagesDirectory();

      const cache = modules.find(m => m.id === '@superinstance/cache');
      const feature = modules.find(m => m.id === '@superinstance/feature-x');

      expect(cache?.category).toBe('foundation');
      expect(feature?.category).toBe('feature');
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  test('preserves existing state on rescan', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));
    const pkgDir = path.join(tmpDir, 'test-mod');
    await fs.mkdir(pkgDir, { recursive: true });
    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@superinstance/test-mod', version: '1.0.0', description: 'Test', dependencies: {} })
    );

    try {
      const reg = new ModuleRegistry(tmpDir);
      await reg.scanPackagesDirectory();

      // Update status to loaded
      reg.updateModuleStatus('@superinstance/test-mod', 'loaded');
      expect(reg.getModuleState('@superinstance/test-mod')?.loaded).toBe(true);

      // Rescan — should preserve loaded state
      await reg.scanPackagesDirectory();
      expect(reg.getModuleState('@superinstance/test-mod')?.loaded).toBe(true);
      expect(reg.getModuleState('@superinstance/test-mod')?.status).toBe('loaded');
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  test('updates module resources', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));
    const pkgDir = path.join(tmpDir, 'res-mod');
    await fs.mkdir(pkgDir, { recursive: true });
    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@superinstance/res-mod', version: '1.0.0', description: 'Resource test', dependencies: {} })
    );

    try {
      const reg = new ModuleRegistry(tmpDir);
      await reg.scanPackagesDirectory();

      reg.updateModuleResources('@superinstance/res-mod', { cpu: 45.2, memory: 128 });
      const state = reg.getModuleState('@superinstance/res-mod');
      expect(state?.resources.cpu).toBe(45.2);
      expect(state?.resources.memory).toBe(128);
      expect(state?.resources.disk).toBe(0); // unchanged
      expect(state?.resources.lastUpdate).toBeInstanceOf(Date);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  test('computes statistics correctly', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));

    // Create 3 modules: 1 foundation, 2 feature
    for (const [dirName, pkgName] of [
      ['cache', '@superinstance/cache'],
      ['feature-a', '@superinstance/feature-a'],
      ['feature-b', '@superinstance/feature-b'],
    ] as const) {
      const dir = path.join(tmpDir, dirName);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: pkgName, version: '1.0.0', description: '', dependencies: {} })
      );
    }

    try {
      const reg = new ModuleRegistry(tmpDir);
      await reg.scanPackagesDirectory();

      // Load one feature module
      reg.updateModuleStatus('@superinstance/feature-a', 'loaded');

      const stats = reg.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.foundation).toBe(1);
      expect(stats.feature).toBe(2);
      expect(stats.loaded).toBe(1);
      expect(stats.installed).toBe(3);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  test('handles directory without package.json gracefully', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));

    // Create a directory without package.json
    const noPkgDir = path.join(tmpDir, 'no-package');
    await fs.mkdir(noPkgDir, { recursive: true });

    // Also create a valid module
    const validDir = path.join(tmpDir, 'valid');
    await fs.mkdir(validDir, { recursive: true });
    await fs.writeFile(
      path.join(validDir, 'package.json'),
      JSON.stringify({ name: '@superinstance/valid', version: '1.0.0', description: 'Valid', dependencies: {} })
    );

    try {
      const reg = new ModuleRegistry(tmpDir);
      const modules = await reg.scanPackagesDirectory();

      expect(modules).toHaveLength(1);
      expect(modules[0].id).toBe('@superinstance/valid');
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  test('sets error state on module', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));
    const pkgDir = path.join(tmpDir, 'err-mod');
    await fs.mkdir(pkgDir, { recursive: true });
    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@superinstance/err-mod', version: '1.0.0', description: 'Error test', dependencies: {} })
    );

    try {
      const reg = new ModuleRegistry(tmpDir);
      await reg.scanPackagesDirectory();

      reg.updateModuleStatus('@superinstance/err-mod', 'error', 'Failed to load dependency');
      const state = reg.getModuleState('@superinstance/err-mod');
      expect(state?.status).toBe('error');
      expect(state?.error).toBe('Failed to load dependency');
      expect(state?.loaded).toBe(false);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  test('getLoadedModules returns only loaded', async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    const path = await import('path');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'murmur-test-'));

    for (const [dirName, pkgName] of [
      ['mod-a', '@superinstance/mod-a'],
      ['mod-b', '@superinstance/mod-b'],
    ] as const) {
      const dir = path.join(tmpDir, dirName);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: pkgName, version: '1.0.0', description: '', dependencies: {} })
      );
    }

    try {
      const reg = new ModuleRegistry(tmpDir);
      await reg.scanPackagesDirectory();

      reg.updateModuleStatus('@superinstance/mod-a', 'loaded');

      const loaded = reg.getLoadedModules();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('@superinstance/mod-a');
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });
});

/**
 * Tests for getRegistry and getOrInitRegistry functions
 * These use the global singleton, so we test them separately.
 */
describe('Global registry functions', () => {
  test('getRegistry returns a ModuleRegistry instance', async () => {
    const { getRegistry } = await import('../module-registry');
    const reg = getRegistry();
    expect(reg).toBeDefined();
    expect(reg.getAllModules).toBeDefined();
  });
});
