// Critical-Engineer: consulted for quality standards in architectural prototypes
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // DISABLED FOR PROTOTYPE: Allows for rapid mocking of complex external types (e.g., SupabaseClient)
      // during architectural validation. See technical debt tracking below.
      files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**/*.ts', '**/tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in test mocks
        '@typescript-eslint/no-var-requires': 'off', // Allow require() for dynamic mocks
      },
    },
    {
      // Allow specific patterns in test setup and configuration files
      files: ['**/setup.ts', '**/vitest.config.ts', '**/vite.config.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Global test configuration needs flexibility
      },
    },
    {
      // Allow namespace in type definition files for database schema organization
      files: ['**/types/data.ts'],
      rules: {
        '@typescript-eslint/no-namespace': 'off', // Database row types are logically grouped
      },
    },
    {
      // Context providers need to export hooks alongside components
      files: ['**/contexts/*.tsx'],
      rules: {
        'react-refresh/only-export-components': 'off', // Context providers export hooks too
      },
    },
  ],
}