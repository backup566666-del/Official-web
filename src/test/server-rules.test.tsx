import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServerRulesBook } from "@/components/rules/ServerRulesBook";
import { GENERAL_RULES_WARNING, RULE_CATEGORIES, SERVER_RULES } from "@/data/server-rules";
import { routeTree } from "@/routeTree.gen";

describe("Free City Official Server Rules", () => {
  it("contains all 30 rules in exact numerical order 01 through 30", () => {
    expect(SERVER_RULES).toHaveLength(30);
    SERVER_RULES.forEach((rule, index) => {
      const expectedNumber = String(index + 1).padStart(2, "0");
      expect(rule.number).toBe(expectedNumber);
      expect(RULE_CATEGORIES).toContain(rule.category);
    });
  });

  it("exposes /rules publicly without requiring authentication", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/rules");
    expect(matches.some((match) => match.routeId === "/_authenticated")).toBe(false);
    expect(matches.at(-1)?.routeId).toBe("/rules");
  });

  it("renders the general warning and all 30 numbered rules with exact titles, descriptions, and punishments", () => {
    render(<ServerRulesBook />);

    expect(screen.getByText(GENERAL_RULES_WARNING)).toBeInTheDocument();

    for (const rule of SERVER_RULES) {
      expect(
        screen.getByRole("heading", { name: `${rule.number}. ${rule.title}` }),
      ).toBeInTheDocument();
      expect(screen.getByText(rule.description)).toBeInTheDocument();
      expect(
        screen.getAllByText(rule.punishment, { exact: false }).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("filters rules by search number, title, and keyword", () => {
    render(<ServerRulesBook />);

    const searchInput = screen.getByRole("searchbox", { name: "Search server rules" });

    fireEvent.change(searchInput, { target: { value: "24" } });
    expect(screen.getByRole("heading", { name: "24. NO MALICIOUS LINKS" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "01. RESPECT" })).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "bribery" } });
    expect(screen.getByRole("heading", { name: "30. NO BRIBERY" })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "vehicle" } });
    expect(screen.getByRole("heading", { name: "05. NO VDM" })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "zzzz-nonexistent" } });
    expect(screen.getByText("No matching rules found")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all 30 rules" }));
    expect(screen.getByRole("heading", { name: "01. RESPECT" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "30. NO BRIBERY" })).toBeInTheDocument();
  });

  it("filters rules across all five categories", () => {
    render(<ServerRulesBook />);

    fireEvent.click(screen.getByRole("button", { name: /Economy/i }));
    expect(screen.getByRole("heading", { name: "16. NO SCAMMING" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "17. NO FRAUD" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "18. NO UNAUTHORIZED TRADING" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "01. RESPECT" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Staff Conduct/i }));
    expect(screen.getByRole("heading", { name: "25. NO STAFF IMPERSONATION" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "30. NO BRIBERY" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /All Rules/i }));
    expect(screen.getByRole("heading", { name: "01. RESPECT" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "30. NO BRIBERY" })).toBeInTheDocument();
  });
});
