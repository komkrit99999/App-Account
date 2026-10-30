import { requireFeature } from "@/lib/authz";
import { todayDateInput } from "@/lib/format";
import { createLoan } from "@/server/loans/actions";
import { listBorrowerOptions } from "@/server/loans/queries";
import { LoanForm } from "@/components/loans/loan-form";

export default async function NewLoanPage({ searchParams }: PageProps<"/loans/new">) {
  await requireFeature("createLoan");
  const sp = await searchParams;
  const customerId = typeof sp.customer === "string" ? sp.customer : "";
  const borrowers = await listBorrowerOptions();
  const preselected = borrowers.find((b) => b.id === customerId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">เพิ่มเงินกู้</h1>
      <LoanForm
        action={createLoan}
        initial={{ customerId: preselected?.id ?? "", startDate: todayDateInput() }}
        borrowers={borrowers}
        submitLabel="บันทึก"
        cancelHref={preselected ? `/customers/${preselected.id}` : "/loans"}
      />
    </div>
  );
}
