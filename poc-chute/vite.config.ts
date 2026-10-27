/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le build fonctionne sous https://<compte>.github.io/fretmap/poc-chute/
  // comme à la racine de `vite preview` (tests de bout en bout).
  base: './',
  plugins: [svelte(), svelteTesting()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Modules purs : node. Les tests de composants passent en jsdom par un commentaire en tête de fichier.
    environment: 'node',
  },
});
