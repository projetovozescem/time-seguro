// supabase/functions/relato-upload-url/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token, relato_id } = await req.json();
    if (!token || !relato_id) return json({ ok: false, motivo: "dados_invalidos" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: path, error } = await admin.rpc("_relato_caminho_foto", {
      p_token: token,
      p_relato: relato_id,
    });
    if (error || !path) return json({ ok: false, motivo: "upload_nao_permitido" }, 403);

    const { data, error: e2 } = await admin.storage
      .from("relatos-fotos")
      .createSignedUploadUrl(path);
    if (e2) throw e2;
    return json({ ok: true, path, upload_token: data.token });
  } catch (_e) {
    return json({ ok: false, motivo: "erro_interno" }, 500);
  }
});
