module.exports = {
    'env': {
        'browser': true,
        'node': true
    },
    'parser': '@typescript-eslint/parser',
    'parserOptions': {
        'sourceType': 'module'
    },
    'plugins': [
        '@typescript-eslint'
    ],
    'rules': {
        '@typescript-eslint/member-delimiter-style': [
            'warn',
            {
                'multiline': {
                    'delimiter': 'semi',
                    'requireLast': true
                },
                'singleline': {
                    'delimiter': 'semi',
                    'requireLast': false
                }
            }
        ],
        '@typescript-eslint/semi': [
            'warn',
            'always'
        ],
        'constructor-super': 'warn',
        'curly': 'warn',
        'eqeqeq': [
            'warn',
            'always'
        ],
        'no-buffer-constructor': 'warn',
        'no-caller': 'warn',
        'no-debugger': 'warn',
        'no-duplicate-case': 'warn',
        'no-duplicate-imports': 'warn',
        'no-eval': 'warn',
        'no-extra-semi': 'warn',
        'no-new-wrappers': 'warn',
        'no-redeclare': 'off',
        'no-sparse-arrays': 'warn',
        'no-throw-literal': 'warn',
        'no-unsafe-finally': 'warn',
        'no-unused-labels': 'warn',
        'no-redeclare': 'warn',
        'no-throw-literal': 'warn',
        'no-var': 'warn',
    },
    'ignorePatterns': [
        '**/*.d.ts'
    ]
};