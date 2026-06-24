import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRoomCode, parseRoute } from "./router.js";

test("parseRoute recognizes the display, join, and controller routes", () => {
  assert.deepEqual(parseRoute("/"), { name: "home" });
  assert.deepEqual(parseRoute("/display"), { name: "display-create" });
  assert.deepEqual(parseRoute("/display/k8p4"), { name: "display-room", roomCode: "K8P4" });
  assert.deepEqual(parseRoute("/join/K8P4"), { name: "join", roomCode: "K8P4" });
  assert.deepEqual(parseRoute("/controller/k8p4"), { name: "controller", roomCode: "K8P4" });
});

test("parseRoute falls back for unsupported paths", () => {
  assert.deepEqual(parseRoute("/not-real"), { name: "not-found" });
});

test("normalizeRoomCode uppercases and trims values", () => {
  assert.equal(normalizeRoomCode(" k8p4 "), "K8P4");
});
