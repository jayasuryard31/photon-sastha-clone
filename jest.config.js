module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.(js|ts)'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
