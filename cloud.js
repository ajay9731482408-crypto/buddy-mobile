/* Cloudflare cloud storage for Buddy Mobile, using Workers KV through the official REST API.
   The API token is sent only in the Authorization header. It is never put in a web address or logged.
   Needs: Account ID, KV Namespace ID, and an API token with "Workers KV Storage: Edit" for that namespace. */
(function (root) {
  'use strict';
  const API = 'https://api.cloudflare.com/client/v4';
  const KEY = 'buddy-mobile-state';

  class CloudError extends Error {}

  function url(cfg, key) {
    return `${API}/accounts/${encodeURIComponent(cfg.accountId)}/storage/kv/namespaces/${encodeURIComponent(cfg.namespaceId)}/values/${encodeURIComponent(key)}`;
  }

  async function call(cfg, method, key, body, fetchFn) {
    if (!cfg || !cfg.accountId || !cfg.namespaceId || !cfg.token) {
      throw new CloudError('Fill in the Account ID, the Namespace ID and the API token first.');
    }
    const f = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) throw new CloudError('This browser cannot make web requests.');
    const headers = { Authorization: 'Bearer ' + cfg.token };
    if (body !== undefined) headers['Content-Type'] = 'text/plain';
    let res;
    try {
      res = await f(url(cfg, key), { method, headers, body });
    } catch (e) {
      throw new CloudError('Could not reach Cloudflare. Check the internet connection. If it still fails, your browser may be blocking the request (see the README, "If the connection is blocked").');
    }
    if (method === 'GET' && res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new CloudError('Cloudflare rejected the token. Check it has "Workers KV Storage: Edit" for this namespace.');
    if (res.status === 404) throw new CloudError('The Account ID or the Namespace ID was not found. Copy both again from the Cloudflare dashboard.');
    if (!res.ok) throw new CloudError(`Cloudflare returned error ${res.status}. Try again later.`);
    return method === 'GET' ? await res.text() : true;
  }

  /* Worker mode: your own sync Worker (see worker/worker.js). Recommended on phones, because browsers
     always accept its answers, while direct API calls can be refused by the browser. */
  async function workerCall(cfg, method, body, fetchFn) {
    const base = String(cfg.workerUrl || '').replace(/\/+$/, '');
    if (!/^https:\/\//.test(base)) throw new CloudError('The Worker address must start with https://');
    if (!cfg.token || cfg.token.length < 16) throw new CloudError('Type the sync secret you set in the Worker (at least 16 characters).');
    const f = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) throw new CloudError('This browser cannot make web requests.');
    const headers = { Authorization: 'Bearer ' + cfg.token };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try { res = await f(base + '/state', { method, headers, body }); }
    catch (e) { throw new CloudError('Could not reach your Buddy Worker. Check its address, and that the internet works.'); }
    if (method === 'GET' && res.status === 404) return null;
    if (res.status === 401) throw new CloudError('The sync secret is wrong. It must match SYNC_SECRET in the Worker.');
    if (res.status === 403) throw new CloudError('The Worker refused this app address. Add it to ALLOWED_ORIGIN in the Worker settings.');
    if (!res.ok) throw new CloudError(`The Worker returned error ${res.status}. Check its setup, then try again.`);
    return method === 'GET' ? await res.text() : true;
  }
  function isWorker(cfg) { return cfg && cfg.mode === 'worker'; }

  /** Saves the whole state. */
  async function save(cfg, state, fetchFn) {
    if (isWorker(cfg)) return workerCall(cfg, 'PUT', JSON.stringify(state), fetchFn);
    return call(cfg, 'PUT', KEY, JSON.stringify(state), fetchFn);
  }

  /** Loads the state from the cloud, or null if nothing was saved yet. */
  async function load(cfg, fetchFn) {
    const text = isWorker(cfg) ? await workerCall(cfg, 'GET', undefined, fetchFn) : await call(cfg, 'GET', KEY, undefined, fetchFn);
    if (text === null) return null;
    try { return JSON.parse(text); } catch (e) { throw new CloudError('The cloud copy is damaged and was not used. Your phone copy is safe.'); }
  }

  /** Safe sync: load the cloud copy, merge it with this phone's copy, save the merged result, return it.
      Saving alone would replace the cloud copy and could erase items added on another phone. */
  async function sync(cfg, local, mergeFn, fetchFn) {
    const remote = await load(cfg, fetchFn);
    const merged = remote ? mergeFn(local, remote) : local;
    await save(cfg, merged, fetchFn);
    return merged;
  }

  /** Writes and reads a small test value. Returns true when both work. */
  async function test(cfg, fetchFn) {
    if (isWorker(cfg)) {
      // read only: a test must never write to the cloud copy (an empty write would look newer than your phone data)
      await workerCall(cfg, 'GET', undefined, fetchFn);
      return true;
    }
    const probe = 'buddy-mobile-test';
    await call(cfg, 'PUT', probe, 'ok ' + new Date().toISOString(), fetchFn);
    const back = await call(cfg, 'GET', probe, undefined, fetchFn);
    return typeof back === 'string' && back.indexOf('ok') === 0;
  }

  const api = { save, load, sync, test, CloudError, KEY, url };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuddyCloud = api;
})(typeof window !== 'undefined' ? window : globalThis);
