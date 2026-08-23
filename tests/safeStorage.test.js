import test from "node:test";
import assert from "node:assert/strict";
import { getSafeStorage } from "../src/app/safeStorage.js";

test("读取 localStorage 属性失败时安全降级为空存储", () => {
  const target = {};
  Object.defineProperty(target, "localStorage", {
    get() {
      throw new Error("storage access denied");
    },
  });

  assert.equal(getSafeStorage(target), null);
});
