import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/authz";
import { updateCustomer } from "@/server/customers/actions";
import { getCustomer } from "@/server/customers/queries";
import { listTags } from "@/server/tags/queries";
import { CustomerForm } from "@/components/customers/customer-form";
import type { CustomerFormValues } from "@/server/customers/schema";

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const user = await requireFeature("editCustomer");
  const { id } = await params;
  const [customer, tags] = await Promise.all([getCustomer(user, id), listTags()]);
  if (!customer) notFound();

  const fields: Record<string, string> = {
    name: customer.name,
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    note: customer.note ?? "",
    companyName: customer.companyName ?? "",
    contactPerson: customer.contactPerson ?? "",
    taxId: customer.taxId ?? "",
    branchType: customer.isHeadOffice ? "head" : "branch",
    branchCode: customer.branchCode ?? "",
    // Only present for viewFinancial; editFinancial implies viewFinancial
    ...(customer.financial && {
      creditLimit: customer.financial.creditLimit ?? "",
      paymentTermDays: customer.financial.paymentTermDays?.toString() ?? "",
      outstandingBalance: customer.financial.outstandingBalance,
    }),
  };
  const initial: CustomerFormValues = { fields, tagIds: customer.tags.map((t) => t.id) };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">
        แก้ไขลูกค้า <span className="text-slate-400">{customer.code}</span>
      </h1>
      <CustomerForm
        action={updateCustomer.bind(null, customer.id)}
        initial={initial}
        tags={tags}
        submitLabel="บันทึกการแก้ไข"
        cancelHref={`/customers/${customer.id}`}
      />
    </div>
  );
}
