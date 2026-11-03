"use client";

import { useTransition } from "react";
import { buttonDanger } from "@/components/ui";
import { deleteCompany } from "@/server/company/actions";

export function DeleteCompanyButton({ id, name }: { id: number; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonDanger}
      onClick={() => {
        if (!confirm(`ยืนยันลบบริษัท "${name}"?`)) return;
        startTransition(async () => {
          const result = await deleteCompany(id);
          if (result?.error) alert(result.error);
        });
      }}
    >
      {pending ? "กำลังลบ…" : "ลบบริษัท"}
    </button>
  );
}
