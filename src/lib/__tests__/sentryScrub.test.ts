import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import { scrubBreadcrumb, scrubEvent, stripQuery } from '../sentryScrub';

const USER_ID = '66666666-6666-4666-8666-666666666666';
const PROFILES_URL = `https://abc.supabase.co/rest/v1/profiles?select=*&id=in.(${USER_ID})`;
const SEARCH_URL =
  'https://abc.supabase.co/rest/v1/listings?select=*&or=(title.ilike.*calculus%20textbook*)#frag';

describe('stripQuery', () => {
  it('keeps scheme, host and path and drops the query string and fragment', () => {
    expect(stripQuery(PROFILES_URL)).toBe('https://abc.supabase.co/rest/v1/profiles');
    expect(stripQuery(SEARCH_URL)).toBe('https://abc.supabase.co/rest/v1/listings');
    expect(stripQuery('https://abc.supabase.co/auth/v1/token#x')).toBe(
      'https://abc.supabase.co/auth/v1/token',
    );
  });

  it('leaves a URL with no query untouched', () => {
    expect(stripQuery('https://abc.supabase.co/rest/v1/rpc/delete_own_account')).toBe(
      'https://abc.supabase.co/rest/v1/rpc/delete_own_account',
    );
  });
});

describe('scrubBreadcrumb', () => {
  it('removes user ids from an XHR breadcrumb URL but keeps method and status', () => {
    const crumb: Breadcrumb = {
      category: 'xhr',
      type: 'http',
      data: { method: 'GET', url: PROFILES_URL, status_code: 200 },
    };
    const scrubbed = scrubBreadcrumb(crumb);
    expect(scrubbed?.data).toEqual({
      method: 'GET',
      url: 'https://abc.supabase.co/rest/v1/profiles',
      status_code: 200,
    });
    expect(JSON.stringify(scrubbed)).not.toContain(USER_ID);
  });

  it('removes search text from a fetch breadcrumb, including the split-out query fields', () => {
    const crumb: Breadcrumb = {
      category: 'fetch',
      type: 'http',
      data: {
        method: 'GET',
        url: SEARCH_URL,
        'http.query': '?select=*&or=(title.ilike.*calculus%20textbook*)',
        'http.fragment': '#frag',
      },
    };
    const text = JSON.stringify(scrubBreadcrumb(crumb));
    expect(text).not.toContain('calculus');
    expect(text).not.toContain('http.query');
    expect(text).not.toContain('http.fragment');
  });

  it('drops console breadcrumbs entirely', () => {
    expect(
      scrubBreadcrumb({ category: 'console', message: `signed in as ${USER_ID}` }),
    ).toBeNull();
  });

  it('passes through breadcrumbs with no data, and does not mutate the original', () => {
    const plain: Breadcrumb = { category: 'navigation', message: 'Home' };
    expect(scrubBreadcrumb(plain)).toBe(plain);

    const crumb: Breadcrumb = { category: 'xhr', data: { url: PROFILES_URL } };
    scrubBreadcrumb(crumb);
    expect(crumb.data?.url).toBe(PROFILES_URL);
  });
});

describe('scrubEvent', () => {
  it('scrubs breadcrumbs merged in from the native SDK, which bypass beforeBreadcrumb', () => {
    const event: ErrorEvent = {
      type: undefined,
      breadcrumbs: [
        { category: 'http', type: 'http', data: { url: PROFILES_URL, method: 'GET' } },
        { category: 'console', message: 'debug output' },
      ],
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.breadcrumbs).toEqual([
      {
        category: 'http',
        type: 'http',
        data: { url: 'https://abc.supabase.co/rest/v1/profiles', method: 'GET' },
      },
    ]);
  });

  it('strips the request URL, query string, cookies and headers from an HTTP-client error', () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        url: PROFILES_URL,
        method: 'GET',
        query_string: `id=in.(${USER_ID})`,
        cookies: { session: 'secret' },
        headers: { Authorization: 'Bearer secret' },
      },
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request).toEqual({
      url: 'https://abc.supabase.co/rest/v1/profiles',
      method: 'GET',
    });
    expect(JSON.stringify(scrubbed)).not.toMatch(new RegExp(`${USER_ID}|secret`));
  });

  it('leaves an event with nothing to scrub intact', () => {
    const event: ErrorEvent = { type: undefined, message: 'boom' };
    expect(scrubEvent(event)).toEqual(event);
  });
});
