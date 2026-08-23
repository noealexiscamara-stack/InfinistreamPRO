import { extractPlayerError, formatTimeToFailure } from '../playbackError';

describe('extractPlayerError', () => {
  it('reads message and code from an object', () => {
    expect(extractPlayerError({ code: 'ERROR_CODE_IO_BAD_HTTP_STATUS', message: 'Response code: 404' })).toEqual(
      expect.objectContaining({
        code: 'ERROR_CODE_IO_BAD_HTTP_STATUS',
        message: 'Response code: 404',
      })
    );
  });

  it('falls back for null', () => {
    const out = extractPlayerError(null);
    expect(out.code).toBeNull();
    expect(out.message).toMatch(/inconnue/i);
  });
});

describe('formatTimeToFailure', () => {
  it('formats ms and seconds', () => {
    expect(formatTimeToFailure(250)).toBe('250 ms');
    expect(formatTimeToFailure(1500)).toBe('1.5 s');
  });
});
