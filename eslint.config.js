// Configuration ESLint 9 (flat config) pour le front Baignade Rives d'Paris.
// Couvre le code source TypeScript / React (src/). Le dossier dist, les
// fonctions Edge Deno (supabase/functions) et les fichiers de configuration
// racine sont ignorés : ils tournent dans des environnements distincts.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'supabase/functions', '*.config.js', '*.config.ts'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Variables inutilisées : avertissement, en tolérant le préfixe « _ ».
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // « any » toléré (échappatoires de typage Supabase existantes) : signalé
      // en avertissement pour resserrage ultérieur, sans bloquer le lint.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
