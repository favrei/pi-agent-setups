import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { COMPACTION_REASONS, parseModelReference, resolveConfig } from "../src/config.js";
const defaults = { thinkingLevel: undefined, fallbacks: [], timeoutMs: 90000, reasons: [...COMPACTION_REASONS] };

describe("resolveConfig", () => {
  test("unconfigured/disabled retains native behavior", () => {
    assert.equal(resolveConfig({}, {}), null);
    assert.equal(resolveConfig({ compactionModel: false }, {}), null);
    assert.equal(resolveConfig({ compactionModel: { model: "p/m" } }, { compactionModel: false }), null);
    assert.equal(resolveConfig({ compactionModel: { model: "p/m", enabled: false } }, {}), null);
  });
  test("legacy single model remains supported", () => {
    assert.deepEqual(resolveConfig({ compactionModel: { model: "p/m" } }, {}), { model: "p/m", ...defaults });
  });
  test("trusted project overrides merge, replacing backup arrays", () => {
    assert.deepEqual(resolveConfig({ compactionModel: { model: "p/base", thinkingLevel: "low", fallbacks: [{ model: "q/base" }] } },
      { compactionModel: { model: "p/project", fallbacks: [{ model: "q/project", thinkingLevel: "off" }], reasons: ["manual"] } }),
      { ...defaults, model: "p/project", thinkingLevel: "low", fallbacks: [{ model: "q/project", thinkingLevel: "off" }], reasons: ["manual"] });
  });
  test("Museminimal then directDeepSeekoff is explicit and ordered", () => {
    const c = resolveConfig({ compactionModel: { model: "meta/muse-spark-1.3-contributor", thinkingLevel: "minimal", fallbacks: [{ model: "deepseek/deepseek-flash", thinkingLevel: "off" }], timeoutMs: 60000 } }, {});
    assert.equal(c?.model, "meta/muse-spark-1.3-contributor");
    assert.deepEqual(c?.fallbacks, [{ model: "deepseek/deepseek-flash", thinkingLevel: "off" }]);
    assert.equal(c?.timeoutMs, 60000);
  });
  test("deduplicates routes and skips malformed backups", () => {
    const warnings: string[] = [];
    const c = resolveConfig({ compactionModel: { model: "p/m", fallbacks: [{ model: "p/m" }, { model: "q/m" }, { model: "q/m" }, { model: "/bad" }] } }, {}, s => warnings.push(s));
    assert.deepEqual(c?.fallbacks, [{ model: "q/m", thinkingLevel: undefined }]);
    assert.equal(warnings.length, 1);
  });
  test("bad optional settings warn and use safe defaults", () => {
    const warnings: string[] = [];
    const c = resolveConfig({ compactionModel: { model: "p/m", thinkingLevel: "extreme", reasons: ["wrong"], timeoutMs: Infinity, fallbacks: "wrong" } }, {}, s => warnings.push(s));
    assert.deepEqual(c, { model: "p/m", ...defaults });
    assert.equal(warnings.length, 4);
  });
  test("bounded timeout and bounded backup count", () => {
    for (const timeoutMs of [0, -1, 1.5, 600001, "1000"]) {
      assert.equal(resolveConfig({ compactionModel: { model: "p/m", timeoutMs } }, {}, () => {})?.timeoutMs, 90000);
    }
    assert.deepEqual(resolveConfig({ compactionModel: { model: "p/m", fallbacks: Array.from({ length: 5 }, (_, i) => ({ model: `p/${i}` })) } }, {}, () => {})?.fallbacks, []);
  });
  test("empty reasons disables routing", () => {
    assert.deepEqual(resolveConfig({ compactionModel: { model: "p/m", reasons: [] } }, {})?.reasons, []);
  });
});

describe("parseModelReference", () => {
  test("splits provider prefix but preserves model slashes", () => {
    assert.deepEqual(parseModelReference("openrouter/vendor/model"), { provider: "openrouter", modelId: "vendor/model" });
  });
  test("rejects malformed/whitespace references", () => {
    for (const s of ["model-only", "/model", "provider/", "  / m", "p /  "]) assert.equal(parseModelReference(s), null);
  });
});
