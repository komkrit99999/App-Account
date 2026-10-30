import { requireFeature } from "@/lib/authz";
import { createCustomer } from "@/server/customers/actions";
import { listTags } from "@/server/tags/queries";
import { CustomerForm } from "@/components/customers/customer-form";

export default async function NewCustomerPage() {
  await requireFeature("createCustomer");
  const tags = await listTags();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">เพิ่มลูกค้า</h1>
      <CustomerForm
        action={createCustomer}
        initial={{ fields: { branchType: "head" }, tagIds: [] }}
        tags={tags}
        submitLabel="บันทึก"
        cancelHref="/customers"
      />
    </div>
  );
}
