"use client";

import { useTransition } from "react";
import { buttonDanger } from "@/components/ui";
import { cancelInvoice } from "@/server/invoices/actions";

export function PrintButton({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  );
}

export function CancelInvoiceButton({ id, number }: { id: string; number: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonDanger}
      onClick={() => {
        if (confirm(`ยืนยันยกเลิกใบกำกับภาษี ${number}?\nเลขที่นี้จะไม่ถูกนำกลับมาใช้อีก`)) startTransition(() => cancelInvoice(id));
      }}
    >
      {pending ? "กำลังยกเลิก…" : "ยกเลิกใบกำกับ"}
    </button>
  );
}
