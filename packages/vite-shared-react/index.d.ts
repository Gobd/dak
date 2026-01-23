import type { Plugin, UserConfig } from 'vite';

/** Get the list of external module IDs from the manifest (excludes non-JS like 'fonts') */
export function getExternalIds(): string[];

/** Vite plugin that injects import map for shared vendor bundles */
export function sharedReact(): Plugin;
export default sharedReact;

export interface PWAOptions {
  name: string;
  short_name: string;
  description: string;
  orientation?: 'portrait' | 'landscape' | 'any';
  includeAssets?: string[];
}

export interface ViteConfigOptions {
  base: string;
  port: number;
  pwa?: PWAOptions;
  rollupInput?: Record<string, string>;
}

/** Create a Vite config with shared plugins and settings */
export function createViteConfig(options: ViteConfigOptions): UserConfig;
