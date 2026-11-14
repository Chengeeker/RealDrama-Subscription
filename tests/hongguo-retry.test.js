"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");

const context = {md5: value => crypto.createHash("md5").update(value).digest("hex")};
vm.createContext(context);
for (const name of ["sdk", "hongguo"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "programs", name + ".js"), "utf8"), context);
}

// Regression: retry requests must not reuse a synthetic ID from the previous
// attempt, which was the behavior introduced accidentally in 0.1.7.
const syntheticIds = [];
let serial = 0;
context.hgDeviceID = () => "1" + String(++serial).padStart(15, "0");
context.hongguoSign = parameters => {
  const parsed = JSON.parse(parameters);
  syntheticIds.push([parsed.device_id, parsed.iid]);
  return JSON.stringify({query:"fixture=1",headers:{}});
};
const state = {};
let gen = context.hgRequest("/fixture", null, null, state);
assert.equal(gen.next().done, false);
assert.equal(gen.next({status:200,text:""}).done, false);
assert.equal(gen.next({status:200,text:JSON.stringify({code:0,data:{ok:true}})}).value.ok, true);
assert.notEqual(syntheticIds[0][0], syntheticIds[1][0]);
assert.notEqual(syntheticIds[0][1], syntheticIds[1][1]);

const vid="7654407663190543385";
context.hongguoRegisterRequest = () => "synthetic registration capability";
let registrations,modernCalls,legacyCalls;
context.hgRegister = function* () {
  registrations++;
  return {device_id:String(1000000000000000 + registrations),iid:String(2000000000000000 + registrations),cdid:"fixture"};
};
context.hgModelChoices = function* () {
  return [{url:"https://example.com/fixture.mp4",height:720,key:"",headers:{}}];
};
context.select = choices => ({url:choices[0].url,variants:choices});
context.hgModel = value => typeof value === "string" ? JSON.parse(value) : value;
const payload = {chapter:{videoId:vid},quality:720};
function reset() { registrations=0; modernCalls=0; legacyCalls=0; }
function run() {
  const g = context.hgResolve(payload, {});
  const first = g.next();
  if (!first.done) throw new Error("Unexpected outgoing fixture request");
  return first.value;
}

// Empty modern response gets one NEW registration and retries the same episode.
reset();
context.hgRequest = function* (route) {
  if (route.includes("multi_video_model")) {
    modernCalls++;
    if (modernCalls===1) throw new Error("Hongguo empty response");
    return {[vid]:{video_model:"{}"}};
  }
  legacyCalls++;
  throw new Error("Unexpected legacy fallback");
};
assert.equal(run().url,"https://example.com/fixture.mp4");
assert.equal(registrations,2);
assert.equal(modernCalls,2);
assert.equal(legacyCalls,0);

// After two bounded modern failures, retain the original legacy fallback.
reset();
context.hgRequest = function* (route) {
  if (route.includes("multi_video_model")) {
    modernCalls++;
    throw new Error("Hongguo empty response");
  }
  legacyCalls++;
  return {video_model:"{}"};
};
assert.equal(run().url,"https://example.com/fixture.mp4");
assert.equal(registrations,2);
assert.equal(modernCalls,2);
assert.equal(legacyCalls,1);

// HTTP 429 must remain terminal: no extra identity or fallback traffic.
reset();
context.hgRequest = function* () {
  modernCalls++;
  const err = new Error("rate limited");
  err.httpStatus=429;
  throw err;
};
assert.throws(run, /rate limited/);
assert.equal(registrations,1);
assert.equal(modernCalls,1);

console.log("Hongguo identity regression and bounded recovery tests passed");
