import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Style-debt guards (FABLE-ADMIN-UIUX §2): warn in-editor; the blocking
      // gate is the ratchet in scripts/check-style-debt.mjs (npm run lint).
      'no-restricted-syntax': [
        'warn',
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            'No inline styles — use a CSS-module class with design tokens (FABLE-ADMIN-UIUX §2).',
        },
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{6}/]',
          message:
            'No raw hex colors in TS/TSX — use a var(--*) token from styles/variables.css.',
        },
      ],
    },
  },
])
