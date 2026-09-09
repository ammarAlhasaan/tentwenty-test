import { isAbsolute, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { envSchema, resolveDatabaseFile } from './config.js';

const valid = {
  NODE_ENV: 'production',
  PORT: '5000',
  DATABASE_PATH: './data/other.sqlite',
  FRONTEND_ORIGIN: 'https://example.com',
};

function issuePaths(input: unknown): string[] {
  const result = envSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('envSchema', () => {
  it('accepts a fully valid environment and coerces PORT to a number', () => {
    const parsed = envSchema.parse(valid);
    expect(parsed).toEqual({
      NODE_ENV: 'production',
      PORT: 5000,
      DATABASE_PATH: './data/other.sqlite',
      FRONTEND_ORIGIN: 'https://example.com',
    });
  });

  it('falls back to a documented default for every variable', () => {
    expect(envSchema.parse({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_PATH: './data/margin.sqlite',
      FRONTEND_ORIGIN: 'http://localhost:3000',
    });
  });

  it('rejects a non-numeric PORT and names it', () => {
    expect(issuePaths({ ...valid, PORT: 'not-a-number' })).toEqual(['PORT']);
  });

  it.each(['0', '70000'])('rejects PORT outside 1-65535 (%s)', (port) => {
    expect(issuePaths({ ...valid, PORT: port })).toEqual(['PORT']);
  });

  it('rejects a malformed FRONTEND_ORIGIN and names it', () => {
    expect(issuePaths({ ...valid, FRONTEND_ORIGIN: 'notaurl' })).toEqual(['FRONTEND_ORIGIN']);
  });

  // A browser sends `Origin` as scheme://host[:port] with no trailing slash and
  // no path, so anything else has to be normalised or the CORS check silently
  // matches nothing while the app starts happily.
  it.each([
    ['http://localhost:3000/', 'http://localhost:3000'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['https://example.com/path', 'https://example.com'],
    ['https://example.com/path?q=1#x', 'https://example.com'],
    ['https://example.com:8443/', 'https://example.com:8443'],
  ])('normalises FRONTEND_ORIGIN %s to the bare origin %s', (input, expected) => {
    expect(envSchema.parse({ ...valid, FRONTEND_ORIGIN: input }).FRONTEND_ORIGIN).toBe(expected);
  });

  it.each(['ftp://example.com', 'file:///tmp/x', 'ws://localhost:3000'])(
    'rejects the non-http(s) origin %s',
    (origin) => {
      expect(issuePaths({ ...valid, FRONTEND_ORIGIN: origin })).toEqual(['FRONTEND_ORIGIN']);
    },
  );

  it('explains what an acceptable origin looks like', () => {
    const result = envSchema.safeParse({ ...valid, FRONTEND_ORIGIN: 'ftp://example.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('http://localhost:3000');
    }
  });

  it('rejects a NODE_ENV outside the enum and names it', () => {
    expect(issuePaths({ ...valid, NODE_ENV: 'staging' })).toEqual(['NODE_ENV']);
  });

  it('rejects an empty DATABASE_PATH and names it', () => {
    expect(issuePaths({ ...valid, DATABASE_PATH: '' })).toEqual(['DATABASE_PATH']);
  });

  it('reports every offending variable at once', () => {
    expect(issuePaths({ PORT: 'x', FRONTEND_ORIGIN: 'y', NODE_ENV: 'z' }).sort()).toEqual([
      'FRONTEND_ORIGIN',
      'NODE_ENV',
      'PORT',
    ]);
  });
});

describe('resolveDatabaseFile', () => {
  it('resolves a relative path to the same file regardless of the working directory', () => {
    const fromRoot = vi.spyOn(process, 'cwd').mockReturnValue('/somewhere/repo-root');
    const a = resolveDatabaseFile('./data/margin.sqlite');
    fromRoot.mockReturnValue('/somewhere/repo-root/apps/api');
    const b = resolveDatabaseFile('./data/margin.sqlite');
    fromRoot.mockRestore();

    expect(a).toBe(b);
    expect(isAbsolute(a)).toBe(true);
    expect(a.endsWith('/apps/api/data/margin.sqlite')).toBe(true);
  });

  it('returns an absolute path unchanged', () => {
    expect(resolveDatabaseFile('/tmp/explicit.sqlite')).toBe(resolve('/tmp/explicit.sqlite'));
  });
});
