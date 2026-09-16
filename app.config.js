// Axis — dynamic app config.
//
// app.json is still the source of truth: Expo passes it in as `config`, and
// this returns it unchanged. This file exists for one check.
//
// EXPO_PUBLIC_* variables are inlined into the JS bundle when it is built, and
// src/lib/supabase.ts throws at import if the Supabase pair is missing. That
// throw happens before any React tree (or error boundary) exists, so a store
// binary built without them crashes on launch, every launch — an automatic
// rejection under App Review Guideline 2.1. `.env` is gitignored, so EAS never
// uploads it: on a build server these values come only from the EAS
// environment named in eas.json.
//
// So on EAS release builds, refuse to build instead. A failed build costs a
// few minutes; a crashing binary costs a review cycle.
//
// Local development is untouched: EAS_BUILD is only set on EAS build servers,
// and the development profile loads its JS from Metro on your machine, which
// reads your local .env.

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

// Hostnames that only mean anything on a developer's machine or emulator.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2']);

// True on an EAS build server for any profile that ships an embedded bundle.
function isReleaseBuild(env) {
  return env.EAS_BUILD === 'true' && env.EAS_BUILD_PROFILE !== 'development';
}

// Everything wrong with the build's Supabase configuration, as readable lines.
// Empty means the build can go ahead.
function buildEnvProblems(env) {
  const problems = [];

  for (const name of REQUIRED) {
    if (!env[name] || !env[name].trim()) problems.push(`${name} is not set.`);
  }

  const url = env.EXPO_PUBLIC_SUPABASE_URL && env.EXPO_PUBLIC_SUPABASE_URL.trim();
  if (url) {
    let parsed = null;
    try {
      parsed = new URL(url);
    } catch {
      problems.push(`EXPO_PUBLIC_SUPABASE_URL is not a valid URL: "${url}".`);
    }
    if (parsed && parsed.protocol !== 'https:') {
      problems.push(`EXPO_PUBLIC_SUPABASE_URL must use https, got "${url}".`);
    }
    if (parsed && LOCAL_HOSTS.has(parsed.hostname)) {
      problems.push(`EXPO_PUBLIC_SUPABASE_URL points at a local Supabase stack: "${url}".`);
    }
  }

  return problems;
}

function resolveConfig(config, env) {
  if (!isReleaseBuild(env)) return config;

  const problems = buildEnvProblems(env);
  if (problems.length === 0) return config;

  // Each profile in eas.json names an EAS environment of the same name.
  const environment = env.EAS_BUILD_PROFILE;
  throw new Error(
    [
      `Refusing to build the "${environment}" profile: the app would crash on launch.`,
      ...problems.map((p) => `  - ${p}`),
      '',
      'Set them in the EAS environment this profile uses (see "environment" in eas.json), e.g.:',
      `  eas env:create --environment ${environment} --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext`,
      `  eas env:create --environment ${environment} --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext`,
      `Check what is set with: eas env:list --environment ${environment}`,
    ].join('\n'),
  );
}

module.exports = ({ config }) => resolveConfig(config, process.env);
module.exports.isReleaseBuild = isReleaseBuild;
module.exports.buildEnvProblems = buildEnvProblems;
module.exports.resolveConfig = resolveConfig;
