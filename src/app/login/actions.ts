"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin" && "code" in error && error.code === "inactive") {
        return { error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
      }
      return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
    }
    // signIn() throws a redirect on success — let Next handle it
    throw error;
  }
}
