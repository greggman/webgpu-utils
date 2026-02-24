import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import html from 'eslint-plugin-html';
import oneVariablePerVar from 'eslint-plugin-one-variable-per-var';
import optionalCommaSpacing from 'eslint-plugin-optional-comma-spacing';
import requireTrailingComma from 'eslint-plugin-require-trailing-comma';
import globals from 'globals';

const shimContext = (context) => {
  const sourceCode = context.sourceCode;
  return new Proxy(context, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      if (sourceCode && prop in sourceCode && typeof sourceCode[prop] === 'function') {
        return sourceCode[prop].bind(sourceCode);
      }
      return undefined;
    },
  });
};

const fixRuleWithMissingSchema = (rule) => {
  const originalRule = typeof rule === 'function' ? { create: rule } : rule;
  return {
    ...originalRule,
    meta: {
      ...originalRule.meta,
      schema: originalRule.meta?.schema || [{ type: 'object', additionalProperties: true }],
    },
    create(context) {
      return originalRule.create(shimContext(context));
    },
  };
};

const wrappedOneVariablePerVar = {
  ...oneVariablePerVar,
  rules: Object.fromEntries(
    Object.entries(oneVariablePerVar.rules).map(([k, v]) => [k, fixRuleWithMissingSchema(v)])
  ),
};

const wrappedOptionalCommaSpacing = {
  ...optionalCommaSpacing,
  rules: Object.fromEntries(
    Object.entries(optionalCommaSpacing.rules).map(([k, v]) => [k, fixRuleWithMissingSchema(v)])
  ),
};

const wrappedRequireTrailingComma = {
  ...requireTrailingComma,
  rules: Object.fromEntries(
    Object.entries(requireTrailingComma.rules).map(([k, v]) => [k, fixRuleWithMissingSchema(v)])
  ),
};

export default tseslint.config(
  {
    // Ignore patterns
    ignores: [
      'dist/**/*',
      'src/3rdParty/**/*',
      'examples/*.html',
      'test/mocha*',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{js,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
      parserOptions: {
        project: ['./tsconfig.json'],
        extraFileExtensions: ['.html'],
      },
    },
    plugins: {
      html,
      'one-variable-per-var': wrappedOneVariablePerVar,
      'optional-comma-spacing': wrappedOptionalCommaSpacing,
      'require-trailing-comma': wrappedRequireTrailingComma,
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
    rules: {
        'brace-style': [2, '1tbs', { allowSingleLine: false }],
        camelcase: [0],
        'comma-dangle': 0,
        'comma-spacing': 0,
        'comma-style': [2, 'last'],
        'consistent-return': 2,
        curly: [2, 'all'],
        'dot-notation': 0,
        'eol-last': [0],
        eqeqeq: 2,
        'key-spacing': [0],
        'keyword-spacing': [1, { before: true, after: true, overrides: {} }],
        'new-cap': 2,
        'new-parens': 2,
        'no-alert': 2,
        'no-array-constructor': 2,
        'no-caller': 2,
        'no-const-assign': 2,
        'no-eval': 2,
        'no-extend-native': 2,
        'no-extra-bind': 2,
        'no-extra-parens': [2, 'functions'],
        'no-implied-eval': 2,
        'no-irregular-whitespace': 2,
        'no-iterator': 2,
        'no-label-var': 2,
        'no-labels': 2,
        'no-lone-blocks': 2,
        'no-loop-func': 2,
        'no-multi-spaces': [0],
        'no-multi-str': 2,
        'no-new-func': 2,
        'no-new-object': 2,
        'no-new-wrappers': 2,
        'no-new': 2,
        'no-obj-calls': 2,
        'no-octal-escape': 2,
        'no-process-exit': 2,
        'no-proto': 2,
        'no-return-assign': 2,
        'no-script-url': 2,
        'no-sequences': 2,
        'no-shadow-restricted-names': 2,
        'no-shadow': [0],
        'no-trailing-spaces': 2,
        'no-undef-init': 2,
        'no-underscore-dangle': 2,
        'no-unreachable': 2,
        'no-unused-expressions': 2,
        'no-use-before-define': 0,
        'no-var': 2,
        'no-with': 2,
        'one-variable-per-var/one-variable-per-var': [2],
        'optional-comma-spacing/optional-comma-spacing': [2, { after: true }],
        'prefer-const': 2,
        'require-trailing-comma/require-trailing-comma': [2],
        'semi-spacing': [2, { before: false, after: true }],
        semi: [2, 'always'],
        'space-before-function-paren': [
            2,
            {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always',
            },
        ],
        'space-infix-ops': 2,
        'space-unary-ops': [2, { words: true, nonwords: false }],
        strict: [2, 'function'],
        yoda: [2, 'never'],
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 2,
    },
  }
);
