import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  roots: ["<rootDir>/__tests__/"],
  testPathIgnorePatterns: [
    "<rootDir>/__tests__/setup.ts",
    "<rootDir>/__tests__/integration/helpers.ts",
  ],
};

export default createJestConfig(config);
