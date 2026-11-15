import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createGoogleAuthorizeUrl,
  createSignedSessionToken,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  isGoogleOAuthConfigured,
  readSessionFromRequest,
  resolveRequestOrigin,
  verifyOAuthState,
  verifySignedSessionToken,
} from "./lib/google-oauth.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function safeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function renderOAuthPopupHtml(payload: { type: string; sessionToken?: string; message?: string }, fallbackRedirect: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Free City — Sign in</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0b0a14; color: #f5f5fa; display: grid; place-items: center; min-height: 100vh; text-align: center; padding: 24px; }
    p { opacity: 0.8; font-size: 14px; }
  </style>
</head>
<body>
  <div>
    <p>${payload.type === "FC_GOOGLE_AUTH_SUCCESS" ? "Signed in. Returning to Free City…" : "Sign-in did not complete. You can close this window."}</p>
  </div>
  <script>
    (function () {
      var data = ${safeJsonForHtml(payload)};
      if (window.opener) {
        try { window.opener.postMessage(data, "*"); } catch (e) {}
        window.close();
      } else {
        window.location.replace(${safeJsonForHtml(fallbackRedirect)});
      }
    })();
  </script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

async function handleGoogleAuthRoutes(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const isHttps = url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  if (path === "/api/auth/google/url" && request.method === "GET") {
    if (!isGoogleOAuthConfigured()) {
      return Response.json({ configured: false }, { status: 200, headers: { "cache-control": "no-store" } });
    }
    const origin = resolveRequestOrigin(request, url.searchParams.get("origin"));
    if (!origin) {
      return Response.json({ configured: false, error: "Invalid origin" }, { status: 400 });
    }
    const mode = url.searchParams.get("mode") === "popup" ? "popup" : "redirect";
    const authUrl = createGoogleAuthorizeUrl(origin, mode);
    return Response.json({ configured: true, url: authUrl }, { status: 200, headers: { "cache-control": "no-store" } });
  }

  if ((path === "/auth/google/callback" || path === "/auth/google/callback/") && request.method === "GET") {
    const errorParam = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (errorParam || !code || !state) {
      return renderOAuthPopupHtml(
        { type: "FC_GOOGLE_AUTH_ERROR", message: "Google sign-in was cancelled or incomplete." },
        "/login?oauth_error=cancelled",
      );
    }

    const statePayload = verifyOAuthState(state);
    if (!statePayload) {
      return renderOAuthPopupHtml(
        { type: "FC_GOOGLE_AUTH_ERROR", message: "Sign-in session expired. Please try again." },
        "/login?oauth_error=expired",
      );
    }

    const tokens = await exchangeGoogleCode(code, statePayload.redirectUri);
    if (!tokens) {
      return renderOAuthPopupHtml(
        { type: "FC_GOOGLE_AUTH_ERROR", message: "Couldn't verify your Google sign-in. Please try again." },
        "/login?oauth_error=exchange",
      );
    }

    const user = await fetchGoogleUserInfo(tokens.access_token);
    if (!user) {
      return renderOAuthPopupHtml(
        { type: "FC_GOOGLE_AUTH_ERROR", message: "Couldn't read your Google profile. Please try again." },
        "/login?oauth_error=userinfo",
      );
    }

    const sessionToken = createSignedSessionToken(user);
    const cookie = buildSessionCookie(sessionToken, isHttps);

    if (statePayload.mode === "popup") {
      const resp = renderOAuthPopupHtml(
        { type: "FC_GOOGLE_AUTH_SUCCESS", sessionToken },
        "/dashboard",
      );
      resp.headers.append("set-cookie", cookie);
      return resp;
    }

    return new Response(null, {
      status: 302,
      headers: {
        location: `${statePayload.origin}/dashboard`,
        "set-cookie": cookie,
        "cache-control": "no-store",
      },
    });
  }

  if (path === "/api/auth/session" && request.method === "GET") {
    const user = readSessionFromRequest(request);
    return Response.json({ user }, { status: 200, headers: { "cache-control": "no-store" } });
  }

  if (path === "/api/auth/session" && request.method === "POST") {
    let bodyToken: string | undefined;
    try {
      const body = (await request.json()) as { token?: unknown };
      if (typeof body.token === "string") bodyToken = body.token;
    } catch {
      bodyToken = undefined;
    }
    const authHeader = request.headers.get("authorization");
    const token = bodyToken ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined);
    const user = verifySignedSessionToken(token);
    if (!user || !token) {
      return Response.json({ user: null }, { status: 401 });
    }
    return Response.json(
      { user },
      {
        status: 200,
        headers: {
          "set-cookie": buildSessionCookie(token, isHttps),
          "cache-control": "no-store",
        },
      },
    );
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    return Response.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "set-cookie": buildClearSessionCookie(isHttps),
          "cache-control": "no-store",
        },
      },
    );
  }

  return null;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const authResponse = await handleGoogleAuthRoutes(request);
      if (authResponse) return authResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
