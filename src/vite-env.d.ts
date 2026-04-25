/// <reference types="vite/client" />

// Build-time injected by vite.config.ts (define) so the UI footer version
// stays in lockstep with package.json without a manual edit.
declare const __APP_VERSION__: string;

declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
