import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  let body: { value?: unknown; width?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const value = typeof body.value === "string" ? body.value.trim() : "";
  const requestedWidth = typeof body.width === "number" ? body.width : 256;
  const width = Math.min(Math.max(Math.round(requestedWidth), 128), 1024);

  if (!value || value.length > 2048) {
    return new Response(JSON.stringify({ error: "INVALID_QR_VALUE" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  try {
    const svg = await QRCode.toString(value, {
      type: "svg",
      width,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });

    return new Response(JSON.stringify({ svg }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ error: "QR_GENERATION_FAILED" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
