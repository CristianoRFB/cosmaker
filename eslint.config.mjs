import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const ignoredGeneratedFiles = {
  ignores: ['.next/**', 'out/**', 'coverage/**', 'node_modules/**', 'functions/lib/**', 'next-env.d.ts'],
};
const nextConfigs = compat.extends('next/core-web-vitals', 'next/typescript');
const config = [ignoredGeneratedFiles, ...nextConfigs];

export default config;
