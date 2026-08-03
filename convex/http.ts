import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { httpRouter } from "convex/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const options = httpAction(async () => new Response(null, { status: 204, headers: corsHeaders }));

const ensureSession = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const sessionKey = text(body?.sessionKey);
    if (!sessionKey) return json({ error: "sessionKey is required" }, 400);

    const session = await ctx.runMutation(api.sessions.ensure, {
      sessionKey,
      displayName: text(body?.displayName, "Go DJ! Android Mixxx"),
    });
    return json(session);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const dispatch = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();
    const sessionKey = text(body?.sessionKey);
    const command = text(body?.command);
    if (!sessionKey || !command) {
      return json({ error: "sessionKey and command are required" }, 400);
    }

    const argsJson =
      typeof body?.argsJson === "string"
        ? body.argsJson
        : JSON.stringify(body?.args && typeof body.args === "object" ? body.args : {});
    const commandId = await ctx.runMutation(api.sessions.dispatch, {
      sessionKey,
      command,
      argsJson,
      protocol: text(body?.protocol, "mixxx-command-v1"),
      source: text(body?.source, "android-mixxx"),
      requestId: text(body?.requestId) || undefined,
    });
    return json({ commandId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
  }
});

const http = httpRouter();
http.route({ path: "/api/native/session", method: "OPTIONS", handler: options });
http.route({ path: "/api/native/session", method: "POST", handler: ensureSession });
http.route({ path: "/api/native/dispatch", method: "OPTIONS", handler: options });
http.route({ path: "/api/native/dispatch", method: "POST", handler: dispatch });

export default http;
