import { isMissingSchemaError } from '../schemaLag';

describe('isMissingSchemaError', () => {
  it('recognises a table PostgREST cannot find in its schema cache', () => {
    // The 0052 incident, verbatim: the migration that creates
    // public.conversation_hides had not been applied to production.
    expect(
      isMissingSchemaError({
        code: 'PGRST205',
        message: "Could not find the table 'public.conversation_hides' in the schema cache",
        details: null,
        hint: null,
      }),
    ).toBe(true);
  });

  it('recognises the pre-schema-cache and Postgres-level forms of the same thing', () => {
    // 42P01 is what PostgREST returned for a missing relation before it
    // answered from a schema cache, and what still surfaces from Postgres
    // itself. PGRST202/42883 are the function equivalents — an .rpc() whose
    // migration is absent.
    expect(isMissingSchemaError({ code: '42P01', message: 'relation "public.x" does not exist' })).toBe(true);
    expect(isMissingSchemaError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(true);
    expect(isMissingSchemaError({ code: '42883', message: 'function public.x() does not exist' })).toBe(true);
  });

  it('treats a missing grant as schema lag, not as authorization', () => {
    // RLS refusing a row is not an error — it returns zero rows. So a 42501
    // can only mean the migration's GRANTs never ran: the table is there and
    // the API role cannot see it, which is the half-applied version of the
    // same problem.
    expect(
      isMissingSchemaError({ code: '42501', message: 'permission denied for table conversation_hides' }),
    ).toBe(true);
  });

  it('does not absorb a request that never reached the server', () => {
    // postgrest-js reports a fetch failure, an abort or a timeout with an
    // empty code and status 0. This is the case a user must see as "try
    // again"; mistaking it for a missing table would hide a real outage.
    expect(isMissingSchemaError({ code: '', message: 'FetchError: Network request failed', status: 0 })).toBe(false);
    expect(isMissingSchemaError(new TypeError('Network request failed'))).toBe(false);
    expect(isMissingSchemaError({ status: 503 })).toBe(false);
  });

  it('does not absorb an answer from the database that is not about a missing object', () => {
    expect(isMissingSchemaError({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false);
    expect(isMissingSchemaError({ code: 'PGRST301', message: 'JWT expired' })).toBe(false);
    expect(isMissingSchemaError({ code: '23505', message: 'duplicate key value' })).toBe(false);
  });

  it('does not absorb a missing column, which is far more likely to be our bug', () => {
    // A migration arrives in one transaction, so a table does not appear
    // without its columns. A typo in a .select() produces exactly these, and
    // that must stay loud.
    expect(isMissingSchemaError({ code: '42703', message: 'column "hiden_at" does not exist' })).toBe(false);
    expect(isMissingSchemaError({ code: 'PGRST204', message: "Could not find the 'x' column" })).toBe(false);
  });

  it('does not absorb a non-error', () => {
    expect(isMissingSchemaError(null)).toBe(false);
    expect(isMissingSchemaError(undefined)).toBe(false);
    expect(isMissingSchemaError('PGRST205')).toBe(false);
    expect(isMissingSchemaError({ code: 205 })).toBe(false);
  });
});
