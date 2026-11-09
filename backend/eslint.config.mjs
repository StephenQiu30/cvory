import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  {ignores: ['dist/**', 'dist-test/**', 'node_modules/**']},
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: {'@stylistic': stylistic},
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
      '@typescript-eslint/no-explicit-any': 'error',
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true}],
      '@stylistic/semi': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
);
