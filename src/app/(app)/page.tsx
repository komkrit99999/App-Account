import { getCurrentUser } from "@/lib/dal";
import { FEATURES, TIER_LABELS, can, type Feature } from "@/lib/permissions";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">สวัสดี, {user.displayName}</h1>
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <dt className="text-slate-500">ชื่อผู้ใช้</dt>
        <dd>{user.username}</dd>
        <dt className="text-slate-500">บทบาท</dt>
        <dd>{user.role === "ADMIN" ? "ผู้ดูแลระบบ (Admin)" : "สมาชิก (Member)"}</dd>
        <dt className="text-slate-500">ระดับสิทธิ์</dt>
        <dd>{TIER_LABELS[user.tier]}</dd>
      </dl>

      <section className="max-w-md rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-500">สิทธิ์ของคุณ</h2>
        <ul className="space-y-1.5 text-sm">
          {(Object.keys(FEATURES) as Feature[]).map((feature) => {
            const allowed = can(user, feature);
            return (
              <li key={feature} className={allowed ? "" : "text-slate-400"}>
                <span className={allowed ? "text-emerald-600" : ""}>{allowed ? "✓" : "✗"}</span>{" "}
                {FEATURES[feature]}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
