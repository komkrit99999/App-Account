"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-sm font-medium text-slate-700">
          ชื่อผู้ใช้
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
