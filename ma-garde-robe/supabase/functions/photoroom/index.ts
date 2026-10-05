import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const user = await requireUser(req);
  if (!user) return json({ error: "Authentication required" }, 401);

  try {
    const apiKey = Deno.env.get("PHOTOROOM_API_KEY");
    if (!apiKey) return json({ error: "Service unavailable" }, 503);

    const body = await req.json();
    const { imageUrl, imageBase64 } = body as { imageUrl?: string; imageBase64?: string };
    if (!imageUrl && !imageBase64) return json({ error: "Image is required" }, 400);

    let imageBlob: Blob;
    if (imageBase64) {
      const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      imageBlob = new Blob([bytes], { type: "image/png" });
    } else {
      const parsed = new URL(imageUrl!);
      if (parsed.protocol !== "https:" || !parsed.pathname.includes("/storage/v1/object/")) {
        return json({ error: "Invalid image source" }, 400);
      }
      const fetchResp = await fetch(parsed.toString());
      if (!fetchResp.ok) return json({ error: "Image unavailable" }, 400);
      imageBlob = await fetchResp.blob();
    }

    const formData = new FormData();
    formData.append("image_file", imageBlob, "image.png");
    const photoRoomResp = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: formData,
    });
    if (!photoRoomResp.ok) return json({ error: "Image processing failed" }, 502);

    return new Response(await photoRoomResp.blob(), {
      headers: { ...corsHeaders, "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error("photoroom failed", error);
    return json({ error: "Image processing failed" }, 500);
  }
});
