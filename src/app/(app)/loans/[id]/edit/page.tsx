import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/authz";
import { loansEnabled } from "@/lib/features";
import { toDateInput } from "@/lib/format";
import { updateLoan } from "@/server/loans/actions";
import { getLoan } from "@/server/loans/queries";
import { LoanForm } from "@/components/loans/loan-form";

export default async function EditLoanPage({ params }: PageProps<"/loans/[id]/edit">) {
  // Checked in each page, not a layout: layouts and pages render in parallel,
  // so a layout's notFound() would not stop this page from streaming its data
  if (!loansEnabled()) notFound();
  const user = await requireFeature("editLoan");
  const { id } = await params;
  const loan = await getLoan(user, id);
  if (!loan) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">แก้ไขเงินกู้</h1>
      <LoanForm
        action={updateLoan.bind(null, loan.id)}
        initial={{
          customerId: loan.customer.id,
          principal: loan.principal,
          interestRatePerYear: String(Number(loan.interestRatePerYear)),
          interestDueDay: String(loan.interestDueDay),
          startDate: toDateInput(loan.startDate),
          principalDueDate: toDateInput(loan.principalDueDate),
          note: loan.note ?? "",
        }}
        borrowers={null}
        borrowerLabel={`${loan.customer.name} (${loan.customer.code})`}
        submitLabel="บันทึกการแก้ไข"
        cancelHref={`/customers/${loan.customer.id}`}
      />
    </div>
  );
}
