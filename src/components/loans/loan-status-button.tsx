"use client";

import { useTransition } from "react";
import { setLoanStatus } from "@/server/loans/actions";

export function LoanStatusButton({ id, status }: { id: string; status: "ACTIVE" | "CLOSED" }) {
  const [pending, startTransition] = useTransition();
  const closing = status === "ACTIVE";

  return (
    <button
      type="button"
      disabled={pending}
      className="text-blue-700 hover:underline disabled:opacity-60"
      onClick={() => {
        if (confirm(closing ? "ยืนยันปิดยอด (รับคืนเงินต้นครบแล้ว)?" : "เปิดสัญญานี้อีกครั้ง?")) {
          startTransition(() => setLoanStatus(id, closing ? "CLOSED" : "ACTIVE"));
        }
      }}
    >
      {pending ? "…" : closing ? "ปิดยอด" : "เปิดอีกครั้ง"}
    </button>
  );
}
