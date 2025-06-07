export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  moduleFileExtensions: ['js'],
  testPathIgnorePatterns: ['/node_modules/', 'tests/e2e/']
};
