// AWS's published Signature V4 test vector ("get-vanilla"). If this matches, the signing is correct.
import { test } from "node:test";
import assert from "node:assert/strict";
import { signV4 } from "./worker.js";
test("matches AWS's published test vector get-vanilla", async () => {
  const r = await signV4({
    method: "GET", host: "example.amazonaws.com", path: "/", query: "", body: "",
    region: "us-east-1", service: "service",
    accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    amzDate: "20150830T123600Z",
  });
  assert.match(r.authorization, /Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31$/);
  assert.match(r.authorization, /SignedHeaders=host;x-amz-date/);
  assert.equal(r.payloadHash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});
