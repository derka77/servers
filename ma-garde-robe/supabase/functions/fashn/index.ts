import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const FASHN_BASE = "https://api.fashn.ai/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function recordUsage(userId: string) {
  const { data, error } = await serviceClient().rpc("increment_fashn_usage", { p_user_id: userId });
  if (error) console.error("fashn usage tracking failed", error);
  return typeof data === "number" ? data : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const user = await requireUser(req);
  if (!user) return json({ error: "Authentication required" }, 401);

  try {
    const apiKey = (Deno.env.get("FASHN_API_KEY") || "").trim();
    if (!apiKey) return json({ error: "Service unavailable" }, 503);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "run";
    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (action === "credits" && req.method === "GET") {
      const [resp, usageResult] = await Promise.all([
        fetch(`${FASHN_BASE}/credits`, { headers: authHeaders }),
        serviceClient().from("fashn_usage").select("credits_used").eq("user_id", user.id).maybeSingle(),
      ]);
      const data = await resp.json();
      if (!resp.ok) return json({ error: "Credits unavailable" }, resp.status);
      return json({ ...data, user_used: usageResult.data?.credits_used ?? 0 });
    }

    if (action === "run" && req.method === "POST") {
      const body = await req.json();
      const { modelImage, garmentImage, modelName } = body as { modelImage?: string; garmentImage?: string; modelName?: string };
      if (!modelImage || !garmentImage) return json({ error: "Images are required" }, 400);
      const resolvedModel = modelName || "tryon-v1.6";
      const inputs = resolvedModel === "tryon-max"
        ? { product_image: garmentImage, model_image: modelImage, generation_mode: "fast", resolution: "1k" }
        : { model_image: modelImage, garment_image: garmentImage };
      const resp = await fetch(`${FASHN_BASE}/run`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ model_name: resolvedModel, inputs }),
      });
      const data = await resp.json();
      if (!resp.ok) return json({ error: "Try-on request failed" }, resp.status);
      const userUsed = await recordUsage(user.id);
      return json({ ...data, user_used: userUsed });
    }

    if (action === "status" && req.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Job id is required" }, 400);
      const resp = await fetch(`${FASHN_BASE}/status/${encodeURIComponent(id)}`, { headers: authHeaders });
      const data = await resp.json();
      if (!resp.ok) return json({ error: "Status unavailable" }, resp.status);
      return json(data);
    }

    if (action === "face-to-model" && req.method === "POST") {
      const body = await req.json();
      const { faceImage } = body as { faceImage?: string };
      if (!faceImage) return json({ error: "Face image is required" }, 400);
      const resp = await fetch(`${FASHN_BASE}/run`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ model_name: "face-to-model", inputs: { face_image: faceImage, generation_mode: "fast", resolution: "1k", output_format: "jpeg" } }),
      });
      const data = await resp.json();
      if (!resp.ok) return json({ error: "Avatar generation failed" }, resp.status);
      const userUsed = await recordUsage(user.id);
      return json({ ...data, user_used: userUsed });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("fashn failed", error);
    return json({ error: "FASHN service unavailable" }, 500);
  }
});
