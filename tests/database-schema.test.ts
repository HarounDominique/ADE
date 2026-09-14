import test from "node:test";
import assert from "node:assert/strict";
import type { DatabaseConnection } from "../src/domain/database-schema.js";

/** `tsc --noEmit` (`npm run build`) is what actually enforces this file — `node --import tsx
    --test` transpiles without type-checking, so these assertions exist to fail the build, not the
    test run. Two independent guards, matching the spec's "no admite un campo de contraseña ni por
    accidente de tipado estructural":
    1. A declaration-level check: no key of `DatabaseConnection`, now or after a future edit,
       matches a password/secret-like name — this catches the field being reintroduced even
       through a widened/inferred assignment that excess-property checks alone would miss.
    2. A literal-level check: TypeScript's excess property check on an object literal is the
       concrete "accident" an editor could actually make (typing a password field straight into a
       connection literal), and must fail to compile. */

type ForbiddenConnectionKey = "password" | "pass" | "pwd" | "secret" | "token" | "credential" | "credentials" | "passphrase";

// If DatabaseConnection ever grows a key matching ForbiddenConnectionKey, this becomes the tuple
// branch instead of `true`, and the assignment below fails to typecheck.
type NoForbiddenKeys = Extract<keyof DatabaseConnection, ForbiddenConnectionKey> extends never
  ? true
  : ["DatabaseConnection must never declare a password/secret-like field", Extract<keyof DatabaseConnection, ForbiddenConnectionKey>];

const connectionKeysExcludePasswordLikeFields: NoForbiddenKeys = true;

test("DatabaseConnection's own keys admit no password/secret-like field, at the type declaration level", () => {
  assert.equal(connectionKeysExcludePasswordLikeFields, true);
});

test("DatabaseConnection rejects a password field on an object literal as an excess property", () => {
  // @ts-expect-error a `password` field must never typecheck against DatabaseConnection, even as
  // an accidental extra property on an otherwise-valid literal.
  const withPassword: DatabaseConnection = { id: "1", name: "Local", engine: "postgres", password: "secret" };
  assert.ok(withPassword);
});
