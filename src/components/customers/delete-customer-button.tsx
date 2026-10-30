"use client";

import { useTransition } from "react";
import { buttonDanger } from "@/components/ui";
import { deleteCustomer } from "@/server/customers/actions";

export function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={buttonDanger}
      onClick={() => {
        if (confirm(`ยืนยันลบลูกค้า "${name}" ?`)) startTransition(() => deleteCustomer(id));
      }}
    >
      {pending ? "กำลังลบ…" : "ลบ"}
    </button>
  );
}
