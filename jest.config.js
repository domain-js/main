/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // forceExit: true,
  collectCoverageFrom: [
    "src/utils/*.ts",
    "src/deps/**/*.ts",
    "src/dm/index.ts",
    "src/http/**/*.ts",
    "src/cli/*.ts",
  ],
};
