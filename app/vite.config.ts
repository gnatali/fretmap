/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le build fonctionne à la racine du site GitHub Pages
  // (https://<compte>.github.io/fretmap/) comme sur un autre hébergement.
  base: './',
  plugins: [svelte(), svelteTesting()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Modules purs : node. Les tests de composants passent en jsdom par un commentaire en tête de fichier.
    environment: 'node',
  },
});
