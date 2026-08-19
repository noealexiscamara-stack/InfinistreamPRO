import { XtreamClient } from '../client';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('XtreamClient', () => {
  const credentials = { serverUrl: 'http://example.com:8080/', username: 'user', password: 'pass' };

  it('normalizes the server url and builds the live stream url', () => {
    const client = new XtreamClient(credentials, jest.fn());
    expect(client.buildLiveStreamUrl(42)).toBe('http://example.com:8080/live/user/pass/42.m3u8');
  });

  it('authenticates successfully on a valid, active account', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({
        user_info: { auth: 1, status: 'Active', exp_date: '2000000000', active_cons: '1', max_connections: '2' },
      })
    );
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.authenticate();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('ok');
      expect(result.data.maxConnections).toBe(2);
    }
  });

  it('reports invalid_credentials when auth=0', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ user_info: { auth: 0 } }));
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.authenticate();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_credentials');
  });

  it('reports invalid_credentials on HTTP 401', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, 401));
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.authenticate();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_credentials');
  });

  it('reports server_error with the HTTP status on 5xx', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, 503));
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.authenticate();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('server_error');
      expect(result.message).toBe('Erreur serveur (HTTP 503)');
    }
  });

  it('reports a network error without throwing', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('offline'));
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.authenticate();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('network');
  });

  it('parses live categories', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse([
        { category_id: '1', category_name: 'Guinée' },
        { category_id: '2', category_name: 'Sport' },
      ])
    );
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.getLiveCategories();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([
        { categoryId: '1', categoryName: 'Guinée' },
        { categoryId: '2', categoryName: 'Sport' },
      ]);
    }
  });

  it('parses live streams and keeps category filter in the request', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse([{ stream_id: 10, name: 'RTG', category_id: '1' }]));
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.getLiveStreams('1');
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('category_id=1'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' }),
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]).toEqual({ streamId: 10, name: 'RTG', categoryId: '1', streamIcon: undefined, epgChannelId: undefined });
    }
  });

  it('reports malformed_response when the server returns unexpected JSON shape', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ not: 'an array' }));
    const client = new XtreamClient(credentials, fetchFn as any);
    const result = await client.getLiveStreams();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('malformed_response');
  });
});
