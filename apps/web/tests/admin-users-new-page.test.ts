import assert from "node:assert/strict";
import type { ComponentType, ReactElement } from "react";
import { describe, it } from "node:test";

import { AppShell } from "../app/_components/app-shell/app-shell";
import type { SafeUser } from "../lib/users";
import type { CreateUserInput } from "../lib/users-input";
import {
  authorizeAndCreateUser,
  errorFor,
  INITIAL_CREATE_USER_STATE,
  resolveCreateUserRedirect,
  submitCreateUser,
  type CreateUserFormState,
} from "../app/admin/users/new/create-user-state";
import { renderNewUserView, type NewUserViewUser } from "../app/admin/users/new/new-user-view";
import { NewUserPage } from "../app/admin/users/new/page";

type NewUserViewProps = {
  currentPath: string;
  title: string;
  kicker: string;
  description?: string;
  userLabel?: string;
  children: ReactElement;
};

function readViewProps(view: ReactElement): NewUserViewProps {
  return view.props as NewUserViewProps;
}

function safeUserFixture(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "user-1",
    email: "new@example.com",
    fullName: "New User",
    role: "STAFF",
    isActive: true,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

function formDataFrom(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const VALID_FIELDS = {
  email: "new@example.com",
  fullName: "New User",
  role: "STAFF",
  password: "password123",
};

describe("submitCreateUser", () => {
  it("forwards the parsed input to createUser and returns a success state", async () => {
    const calls: CreateUserInput[] = [];
    const state = await submitCreateUser(formDataFrom(VALID_FIELDS), async (input) => {
      calls.push(input);
      return { ok: true as const, value: safeUserFixture() };
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.email, "new@example.com");
    assert.equal(calls[0]!.role, "STAFF");
    assert.equal(state.status, "success");
    assert.equal(state.errors.length, 0);
  });

  it("returns validation field errors without calling createUser", async () => {
    let called = false;
    const state = await submitCreateUser(
      formDataFrom({ ...VALID_FIELDS, email: "not-an-email" }),
      async () => {
        called = true;
        return { ok: true as const, value: safeUserFixture() };
      },
    );

    assert.equal(called, false);
    assert.equal(state.status, "error");
    assert.ok(state.errors.some((error) => error.field === "email"));
  });

  it("maps a CONFLICT result to an email field error", async () => {
    const state = await submitCreateUser(
      formDataFrom(VALID_FIELDS),
      async () => ({ ok: false as const, error: "CONFLICT" }),
    );

    assert.equal(state.status, "error");
    const emailError = state.errors.find((error) => error.field === "email");
    assert.ok(emailError);
    assert.match(emailError!.message, /email/i);
  });

  it("maps an unknown failure to a form-level error", async () => {
    const state = await submitCreateUser(
      formDataFrom(VALID_FIELDS),
      async () => ({ ok: false as const, error: "UNKNOWN" }),
    );

    assert.equal(state.status, "error");
    assert.ok(state.errors.some((error) => error.field === "form"));
  });
});

describe("authorizeAndCreateUser security boundary", () => {
  it("does not call createUser when the request is unauthenticated", async () => {
    let called = false;
    const state = await authorizeAndCreateUser(formDataFrom(VALID_FIELDS), {
      readUser: async () => null,
      createUserFn: async () => {
        called = true;
        return { ok: true as const, value: safeUserFixture() };
      },
    });

    assert.equal(called, false);
    assert.equal(state.status, "error");
  });

  it("does not call createUser for STAFF (non-admin) users", async () => {
    let called = false;
    const state = await authorizeAndCreateUser(formDataFrom(VALID_FIELDS), {
      readUser: async () => ({ id: "staff-1", role: "STAFF" as const }),
      createUserFn: async () => {
        called = true;
        return { ok: true as const, value: safeUserFixture() };
      },
    });

    assert.equal(called, false);
    assert.equal(state.status, "error");
  });

  it("creates the user for active ADMIN users", async () => {
    const calls: CreateUserInput[] = [];
    const state = await authorizeAndCreateUser(formDataFrom(VALID_FIELDS), {
      readUser: async () => ({ id: "admin-1", role: "ADMIN" as const }),
      createUserFn: async (input) => {
        calls.push(input);
        return { ok: true as const, value: safeUserFixture() };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(state.status, "success");
  });
});

describe("errorFor", () => {
  it("returns the message for the matching field", () => {
    const state: CreateUserFormState = {
      status: "error",
      errors: [{ field: "email", message: "is required" }],
    };
    assert.equal(errorFor(state, "email"), "is required");
  });

  it("returns undefined when no error matches the field", () => {
    assert.equal(errorFor(INITIAL_CREATE_USER_STATE, "email"), undefined);
  });
});

describe("resolveCreateUserRedirect", () => {
  it("redirects to the users list on success", () => {
    assert.equal(
      resolveCreateUserRedirect({ status: "success", errors: [] }),
      "/admin/users",
    );
  });

  it("does not redirect on idle or error states", () => {
    assert.equal(resolveCreateUserRedirect(INITIAL_CREATE_USER_STATE), null);
    assert.equal(resolveCreateUserRedirect({ status: "error", errors: [] }), null);
  });
});

describe("renderNewUserView composition", () => {
  const FormStub: ComponentType = () => null;

  it("wraps the create-user form inside AppShell with admin-users context", () => {
    const view = renderNewUserView({
      user: { fullName: "Ada Lovelace" } as NewUserViewUser,
      CreateUserFormComponent: FormStub,
    });

    assert.equal(view.type, AppShell);
    const props = readViewProps(view);
    assert.equal(props.currentPath, "/admin/users/new");
    assert.equal(props.kicker, "MEDIASSWINT · Usuarios");
    assert.equal(props.title, "Nuevo usuario");
    assert.equal(props.userLabel, "Bienvenido, Ada Lovelace");
    assert.equal(props.children.type, FormStub);
  });

  it("falls back to a neutral userLabel when fullName is missing", () => {
    const view = renderNewUserView({
      user: { fullName: null },
      CreateUserFormComponent: FormStub,
    });
    assert.equal(readViewProps(view).userLabel, "Bienvenido");
  });
});

describe("NewUserPage route", () => {
  const FormStub: ComponentType = () => null;

  function defaultDeps(overrides: Record<string, unknown> = {}) {
    return {
      readUser: async () => ({ id: "admin-1", role: "ADMIN" as const, fullName: "Ada Lovelace" }),
      loadForm: async () => ({ default: FormStub }),
      ...overrides,
    };
  }

  it("renders the create-user form inside AppShell for ADMIN users", async () => {
    const view = await NewUserPage(defaultDeps());

    assert.equal(view.type, AppShell);
    const props = readViewProps(view);
    assert.equal(props.currentPath, "/admin/users/new");
    assert.equal(props.children.type, FormStub);
  });
});
