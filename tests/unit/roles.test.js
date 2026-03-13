import {
  isOwnerRole,
  isAdminRole,
  isStaffRole,
  canContributeRole,
  getRoleLabel,
} from "@/lib/roles";

describe("roles helpers", () => {
  test("owner/admin checks", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("admin")).toBe(false);

    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("contributor")).toBe(false);

    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("owner")).toBe(true);
    expect(isStaffRole("contributor")).toBe(false);
  });

  test("contribute + labels", () => {
    expect(canContributeRole("contributor")).toBe(true);
    expect(canContributeRole("owner")).toBe(true);
    expect(canContributeRole("admin")).toBe(true);
    expect(canContributeRole("viewer")).toBe(false);

    expect(getRoleLabel("owner")).toBe("Owner");
    expect(getRoleLabel(" ADMIN ")).toBe("Admin");
    expect(getRoleLabel("")).toBe("Contributor");
    expect(getRoleLabel(null)).toBe("Contributor");
  });
});
