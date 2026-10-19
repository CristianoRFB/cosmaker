/** Apply the same viewport to built-in pages and the separate tenant/client sessions. */
export function workflowContextOptions() {
  return process.env.COSMAKER_E2E_MOBILE === 'true'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : {};
}
