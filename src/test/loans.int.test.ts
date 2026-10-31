// Loans: anyone can add, only admins change; the legal interest cap; who sees
// which loans. Through the real server actions and queries.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenError, NotFoundError, expectRedirect, setupIntegration, type TestUsers } from "./harness";

let h: Awaited<ReturnType<typeof setupIntegration>>;
let users: TestUsers;
let actions: typeof import("@/server/loans/actions");
let queries: typeof import("@/server/loans/queries");
let customerId: string;
let tier1LoanId: string;
let tier2LoanId: string;

function loanForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = { customerId, principal: "10000", interestRatePerYear: "15", interestDueDay: "5", startDate: "2026-10-01", principalDueDate: "", note: "", ...overrides };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

before(async () => {
  process.env.FEATURE_LOANS = "1";
  h = await setupIntegration();
  users = h.users;
  actions = await import("@/server/loans/actions");
  queries = await import("@/server/loans/queries");
  const c = await h.db.customer.create({
    data: { code: "C00001", name: "ผู้กู้ทดสอบ", facebook: "Test FB", lineId: "test.line", createdById: users.tier3.id },
  });
  customerId = c.id;
});

after(() => h.cleanup());

describe("every tier can add a loan, within the legal cap", () => {
  test("tier 1 creates a loan at the legal maximum", async () => {
    h.loginAs(users.tier1);
    assert.equal(await expectRedirect(actions.createLoan({}, loanForm({ principal: "5000" }))), `/customers/${customerId}`);
    const loan = await h.db.loan.findFirstOrThrow({ where: { createdById: users.tier1.id } });
    assert.equal(loan.principal.toFixed(2), "5000.00");
    assert.equal(loan.interestRatePerYear.toFixed(2), "15.00");
    assert.equal(loan.status, "ACTIVE");
    tier1LoanId = loan.id;
  });

  test("tier 2 creates a loan", async () => {
    h.loginAs(users.tier2);
    await expectRedirect(actions.createLoan({}, loanForm({ principal: "20000", interestRatePerYear: "12" })));
    tier2LoanId = (await h.db.loan.findFirstOrThrow({ where: { createdById: users.tier2.id } })).id;
  });

  test("a rate above 15% per year is refused for everyone, admin included, and nothing is saved", async () => {
    const before = await h.db.loan.count();
    for (const user of [users.tier1, users.tier2, users.admin]) {
      h.loginAs(user);
      for (const rate of ["15.5", "20", "240"]) {
        const r = await actions.createLoan({}, loanForm({ interestRatePerYear: rate }));
        assert.match(r.errors?.interestRatePerYear ?? "", /ไม่เกินร้อยละ 15/, `${user.username} rate ${rate}`);
      }
    }
    assert.equal(await h.db.loan.count(), before);
  });

  test("a deleted customer can't get a new loan", async () => {
    h.loginAs(users.tier1);
    const gone = await h.db.customer.create({ data: { code: "C00002", name: "ลบแล้ว", deletedAt: new Date(), createdById: users.tier3.id } });
    const r = await actions.createLoan({}, loanForm({ customerId: gone.id }));
    assert.ok(r.errors?.customerId);
  });

  test("logged out → /login", async () => {
    h.loginAs(null);
    assert.equal(await expectRedirect(actions.createLoan({}, loanForm())), "/login");
  });
});

describe("who sees which loans", () => {
  test("tier 1 sees only the loans they entered", async () => {
    const tier1 = users.tier1;
    const ids = (await queries.listLoans(tier1, { status: "ALL" })).map((l) => l.id);
    assert.deepEqual(ids, [tier1LoanId]);
    assert.deepEqual((await queries.listLoansForCustomer(tier1, customerId)).map((l) => l.id), [tier1LoanId]);
    assert.equal((await queries.getLoan(tier1, tier1LoanId))?.principal, "5000.00");
    assert.equal(await queries.getLoan(tier1, tier2LoanId), null, "someone else's loan looks missing");
  });

  test("tier 2 and up see every loan, with the borrower's contact details", async () => {
    const loans = await queries.listLoans(users.tier2, { status: "ALL" });
    assert.deepEqual(new Set(loans.map((l) => l.id)), new Set([tier1LoanId, tier2LoanId]));
    assert.equal(loans[0].customer.facebook, "Test FB");
    assert.equal(loans[0].customer.lineId, "test.line");
  });

  test("a user without createLoan or viewFinancial sees nothing (fail closed)", async () => {
    const nobody = { id: users.tier1.id, role: "MEMBER", tier: 0 };
    assert.deepEqual(await queries.listLoans(nobody, { status: "ALL" }), []);
    assert.equal(await queries.getLoan(nobody, tier1LoanId), null);
  });
});

describe("only admins edit, close and reopen", () => {
  for (const name of ["tier1", "tier2", "tier3"] as const) {
    test(`${name}: update and status changes are forbidden, even on their own loan`, async () => {
      h.loginAs(users[name]);
      const own = name === "tier1" ? tier1LoanId : tier2LoanId;
      await assert.rejects(actions.updateLoan(own, {}, loanForm({ principal: "1" })), ForbiddenError);
      await assert.rejects(actions.setLoanStatus(own, "CLOSED"), ForbiddenError);
      const row = await h.db.loan.findUniqueOrThrow({ where: { id: own } });
      assert.notEqual(row.principal.toFixed(2), "1.00");
      assert.equal(row.status, "ACTIVE");
    });
  }

  test("admin on tier 1 can't edit loans: they can't see the amounts", async () => {
    h.loginAs(users.adminTier1);
    await assert.rejects(actions.updateLoan(tier1LoanId, {}, loanForm({ principal: "1" })), ForbiddenError);
    await assert.rejects(actions.setLoanStatus(tier1LoanId, "CLOSED"), ForbiddenError);
  });

  test("admin edits a loan, but not above the cap", async () => {
    h.loginAs(users.admin);
    const r = await actions.updateLoan(tier2LoanId, {}, loanForm({ interestRatePerYear: "20" }));
    assert.ok(r.errors?.interestRatePerYear);
    assert.equal((await h.db.loan.findUniqueOrThrow({ where: { id: tier2LoanId } })).interestRatePerYear.toFixed(2), "12.00");

    await expectRedirect(actions.updateLoan(tier2LoanId, {}, loanForm({ principal: "8000", interestRatePerYear: "10" })));
    const updated = await h.db.loan.findUniqueOrThrow({ where: { id: tier2LoanId } });
    assert.equal(updated.principal.toFixed(2), "8000.00");
    assert.equal(updated.interestRatePerYear.toFixed(2), "10.00");
  });

  test("admin closes (ปิดยอด) and reopens", async () => {
    h.loginAs(users.admin);
    await actions.setLoanStatus(tier2LoanId, "CLOSED");
    let row = await h.db.loan.findUniqueOrThrow({ where: { id: tier2LoanId } });
    assert.equal(row.status, "CLOSED");
    assert.ok(row.closedAt);
    assert.ok(!(await queries.listLoans(users.admin, { status: "ACTIVE" })).some((l) => l.id === tier2LoanId));

    await actions.setLoanStatus(tier2LoanId, "ACTIVE");
    row = await h.db.loan.findUniqueOrThrow({ where: { id: tier2LoanId } });
    assert.equal(row.status, "ACTIVE");
    assert.equal(row.closedAt, null);
  });
});

describe("switched off (FEATURE_LOANS unset)", () => {
  before(() => {
    delete process.env.FEATURE_LOANS;
    h.loginAs(users.admin);
  });
  after(() => {
    process.env.FEATURE_LOANS = "1";
  });

  test("every loan server action answers 404 and changes nothing", async () => {
    const count = await h.db.loan.count();
    await assert.rejects(actions.createLoan({}, loanForm()), NotFoundError);
    await assert.rejects(actions.updateLoan(tier2LoanId, {}, loanForm({ principal: "1" })), NotFoundError);
    await assert.rejects(actions.setLoanStatus(tier2LoanId, "CLOSED"), NotFoundError);
    assert.equal(await h.db.loan.count(), count);
    const row = await h.db.loan.findUniqueOrThrow({ where: { id: tier2LoanId } });
    assert.equal(row.status, "ACTIVE");
    assert.notEqual(row.principal.toFixed(2), "1.00");
  });
});
