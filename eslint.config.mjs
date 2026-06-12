// Flat config for ESLint 9 + Next 16.
// The previous FlatCompat bridge crashed ("Invalid config schema") because
// eslint-config-next now ships native flat configs — use them directly.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
];

export default eslintConfig;
