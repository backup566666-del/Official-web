import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { interpretMemberResponse } from "@/lib/discord";
import {
  fetchRailwayBotMember,
  normalizeRailwayMemberPayload,
  probeRailwayBotHealth,
} from "@/lib/freecity-bot.server";

describe("Discord & Free City Railway Bot API contract", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("extracts role IDs, joinedAt, and pending flag from Discord guild member responses", () => {
    expect(
      interpretMemberResponse(200, {
        joined_at: "2026-06-01T12:00:00.000Z",
        pending: false,
        roles: ["111111111111111111", "222222222222222222"],
      }),
    ).toEqual({
      kind: "member",
      joinedAt: "2026-06-01T12:00:00.000Z",
      pending: false,
      roleIds: ["111111111111111111", "222222222222222222"],
    });

    expect(interpretMemberResponse(404, {})).toEqual({ kind: "not_member" });
    expect(interpretMemberResponse(401, {})).toEqual({ kind: "reconnect_required" });
  });

  it("reports not_configured cleanly when FREE_CITY_BOT_API_URL or FREE_CITY_BOT_API_KEY is missing", async () => {
    delete process.env["FREE_CITY_BOT_API_URL"];
    delete process.env["FREE_CITY_BOT_API_KEY"];

    const health = await probeRailwayBotHealth();
    expect(health.configured).toBe(false);
    expect(health.reachable).toBeNull();

    const lookup = await fetchRailwayBotMember("123456789012345678");
    expect(lookup.status).toBe("not_configured");
  });

  it("calls GET /health with x-api-key header when configured", async () => {
    process.env["FREE_CITY_BOT_API_URL"] = "https://bot-api.example.up.railway.app/";
    process.env["FREE_CITY_BOT_API_KEY"] = "secret-test-key";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const health = await probeRailwayBotHealth();
    expect(health).toMatchObject({
      configured: true,
      apiHost: "bot-api.example.up.railway.app",
      reachable: true,
      statusCode: 200,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://bot-api.example.up.railway.app/health",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-api-key": "secret-test-key",
        }),
      }),
    );
  });

  it("calls GET /api/members/:discordUserId with x-api-key and normalizes roles, XP, level, messageCount, Premium, and AI access", async () => {
    process.env["FREE_CITY_BOT_API_URL"] = "https://bot-api.example.up.railway.app";
    process.env["FREE_CITY_BOT_API_KEY"] = "secret-test-key";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          inGuild: true,
          roles: ["Citizen", "VIP"],
          roleIds: ["100", "200"],
          xp: 4820,
          level: 14,
          messageCount: 912,
          premium: {
            active: true,
            tier: "Free City VIP",
            expiresAt: "2027-01-01T00:00:00.000Z",
          },
          aiAccess: {
            enabled: true,
            tier: "Storyteller Plus",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchRailwayBotMember("123456789012345678");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://bot-api.example.up.railway.app/api/members/123456789012345678",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "x-api-key": "secret-test-key" }),
      }),
    );

    expect(result).toEqual({
      status: "synced",
      data: {
        inGuild: true,
        roles: ["Citizen", "VIP"],
        roleIds: ["100", "200"],
        xp: 4820,
        level: 14,
        messageCount: 912,
        vipStatus: "Free City VIP",
        premiumActive: true,
        premiumTier: "Free City VIP",
        premiumExpiresAt: "2027-01-01T00:00:00.000Z",
        aiAccessEnabled: true,
        aiAccessTier: "Storyteller Plus",
      },
    });
  });

  it("handles 404 from Railway API as not_found without inventing fields", async () => {
    process.env["FREE_CITY_BOT_API_URL"] = "https://bot-api.example.up.railway.app";
    process.env["FREE_CITY_BOT_API_KEY"] = "secret-test-key";

    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })) as unknown as typeof fetch;

    const result = await fetchRailwayBotMember("123456789012345678");
    expect(result.status).toBe("not_found");
    expect(normalizeRailwayMemberPayload({})).toEqual({ roles: [], roleIds: [] });
  });

  it("rejects non-numeric Discord IDs before making any outbound API call", async () => {
    process.env["FREE_CITY_BOT_API_URL"] = "https://bot-api.example.up.railway.app";
    process.env["FREE_CITY_BOT_API_KEY"] = "secret-test-key";
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchRailwayBotMember("../admin");
    expect(result.status).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
