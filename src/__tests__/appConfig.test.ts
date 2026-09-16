// app.config.js refuses to build a release binary that would crash on launch
// for want of the Supabase environment variables (App Store review finding H2).

type Env = Record<string, string | undefined>;
type AppConfigModule = {
  isReleaseBuild: (env: Env) => boolean;
  buildEnvProblems: (env: Env) => string[];
  resolveConfig: <T>(config: T, env: Env) => T;
};

const { isReleaseBuild, buildEnvProblems, resolveConfig } =
  require('../../app.config') as AppConfigModule;

const VALID: Env = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.test.signature',
};

const config = { name: 'Axis', slug: 'axis-app' };

describe('isReleaseBuild', () => {
  it('is false off EAS, so local development never hits the check', () => {
    expect(isReleaseBuild({})).toBe(false);
    expect(isReleaseBuild({ EAS_BUILD_PROFILE: 'production' })).toBe(false);
  });

  it('is false for the development profile, which loads JS from Metro', () => {
    expect(isReleaseBuild({ EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'development' })).toBe(false);
  });

  it('is true for production and preview builds on EAS', () => {
    expect(isReleaseBuild({ EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'production' })).toBe(true);
    expect(isReleaseBuild({ EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'preview' })).toBe(true);
  });
});

describe('buildEnvProblems', () => {
  it('accepts a hosted https URL and an anon key', () => {
    expect(buildEnvProblems(VALID)).toEqual([]);
  });

  it('reports each missing or blank variable', () => {
    expect(buildEnvProblems({})).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL is not set.',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.',
    ]);
    expect(buildEnvProblems({ ...VALID, EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ' })).toEqual([
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.',
    ]);
  });

  it('rejects a URL that is not https', () => {
    expect(
      buildEnvProblems({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: 'http://abcdefghijklmnop.supabase.co' }),
    ).toEqual(['EXPO_PUBLIC_SUPABASE_URL must use https, got "http://abcdefghijklmnop.supabase.co".']);
  });

  it('rejects a local Supabase stack', () => {
    const problems = buildEnvProblems({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' });
    expect(problems).toContain(
      'EXPO_PUBLIC_SUPABASE_URL points at a local Supabase stack: "http://127.0.0.1:54321".',
    );
  });

  it('rejects something that is not a URL at all', () => {
    expect(buildEnvProblems({ ...VALID, EXPO_PUBLIC_SUPABASE_URL: 'supabase' })).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL is not a valid URL: "supabase".',
    ]);
  });
});

describe('resolveConfig', () => {
  it('returns app.json unchanged outside an EAS release build, even with nothing set', () => {
    expect(resolveConfig(config, {})).toBe(config);
  });

  it('returns app.json unchanged for a correctly configured release build', () => {
    expect(
      resolveConfig(config, { ...VALID, EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'production' }),
    ).toBe(config);
  });

  it('fails a release build that is missing the Supabase variables, and says how to fix it', () => {
    expect(() =>
      resolveConfig(config, { EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'production' }),
    ).toThrow(/Refusing to build the "production" profile[\s\S]*EXPO_PUBLIC_SUPABASE_URL is not set[\s\S]*eas env:create/);
  });
});
