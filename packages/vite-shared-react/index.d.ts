import type { Plugin } from 'vite';

/** Get the list of external module IDs from the manifest (excludes non-JS like 'fonts') */
export function getExternalIds(): string[];

/** Vite plugin that injects import map for shared vendor bundles */
export function sharedReact(): Plugin;
export default sharedReact;
