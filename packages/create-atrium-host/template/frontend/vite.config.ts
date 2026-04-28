import { hostBundleConfig } from '@brendan-bank/atrium-host-bundle-utils/vite';

// One function call: lib-mode build emitting `dist/main.js`, CSS
// inlined via runtime <style> tags, defines for the externalised
// React + TanStack Query references. See @brendan-bank/atrium-host-bundle-utils
// for the rationale on each default.
export default hostBundleConfig({ entry: 'src/main.tsx' });
