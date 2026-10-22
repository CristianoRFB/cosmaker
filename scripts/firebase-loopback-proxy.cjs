// Firebase CLI 15.32 uses ProxyAgent for every URL and ignores NO_PROXY.
// Keep inherited external proxy/CA policy; only literal loopback origins use a local Agent.
// Node --require preloads must be CommonJS, before Firebase CLI imports its HTTP client.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Agent, ProxyAgent } = require('undici');
const localAgent = new Agent();
const originalDispatch = ProxyAgent.prototype.dispatch;
ProxyAgent.prototype.dispatch = function dispatch(options, handler) {
  let hostname;
  try { hostname = new URL(String(options.origin)).hostname; } catch { return originalDispatch.call(this, options, handler); }
  if (['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)) return localAgent.dispatch(options, handler);
  return originalDispatch.call(this, options, handler);
};
