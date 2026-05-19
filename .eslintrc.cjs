/**
 * FSD 레이어 경계 강제 (명세 4.3): app > processes > widgets > features > entities > shared
 * 상위 레이어는 하위만 import. shared 는 어떤 레이어도 import 불가.
 */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "plugin:boundaries/recommended"],
  plugins: ["boundaries"],
  settings: {
    "boundaries/include": ["src/**/*"],
    "boundaries/elements": [
      { type: "app", pattern: "src/app/**" },
      { type: "processes", pattern: "src/processes/**" },
      { type: "widgets", pattern: "src/widgets/**" },
      { type: "features", pattern: "src/features/**" },
      { type: "entities", pattern: "src/entities/**" },
      { type: "shared", pattern: "src/shared/**" },
    ],
  },
  rules: {
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "app", allow: ["processes", "widgets", "features", "entities", "shared"] },
          { from: "processes", allow: ["widgets", "features", "entities", "shared"] },
          { from: "widgets", allow: ["features", "entities", "shared"] },
          { from: "features", allow: ["entities", "shared"] },
          { from: "entities", allow: ["shared"] },
          { from: "shared", allow: ["shared"] },
        ],
      },
    ],
  },
};
