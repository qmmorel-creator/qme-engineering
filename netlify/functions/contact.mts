// BFF du formulaire de contact QME. Le navigateur n'appelle jamais Nexora
// directement : il appelle cette fonction, sur le domaine du site, qui
// signe la requête et la relaie vers /api/nexora/qme-intake. Aucun secret
// Nexora n'est jamais exposé au navigateur.
//
// Contrat exact (en-têtes, champs, réponses) documenté côté Nexora dans
// docs/qme-intake/CONTRAT.md (dépôt qmmorel-creator/nexora, nexora#279).

import type { Config } from "@netlify/functions";
import { createHmac } from "node:crypto";

declare const Netlify: { env: { get(name: string): string | undefined } };

const MAX_LENGTHS: Record<string, number> = {
  requestId: 100,
  name: 200,
  email: 254,
  organization: 200,
  need: 200,
  message: 5000,
  submittedAt: 100,
  sourceUrl: 2000,
  company_website: 200,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function contactConfig() {
  const signingKey = Netlify.env.get("QME_INTAKE_SIGNING_KEY");
  const intakeUrl = Netlify.env.get("NEXORA_INTAKE_URL");
  const missing: string[] = [];
  if (!signingKey) missing.push("QME_INTAKE_SIGNING_KEY");
  if (!intakeUrl) missing.push("NEXORA_INTAKE_URL");
  return { signingKey, intakeUrl, missing };
}

// Validation superficielle côté BFF : le contrôle strict (email, longueurs,
// origine, échappement) est fait côté Nexora — ce relais ne fait que
// rejeter tôt les corps grossièrement malformés pour éviter de signer une
// requête qui échouera de toute façon.
function sanitizeBody(raw: unknown, origin: string) {
  if (typeof raw !== "object" || raw === null) throw new Error("invalid_body");
  const body = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const field of Object.keys(MAX_LENGTHS)) {
    const value = body[field];
    if (value == null) continue;
    if (typeof value !== "string") throw new Error("invalid_body");
    if (value.length > MAX_LENGTHS[field]) throw new Error("invalid_body");
    out[field] = value;
  }
  if (!out.requestId || !UUID.test(out.requestId)) throw new Error("invalid_body");
  out.sourceUrl = out.sourceUrl || `${origin}/#contact`;
  return out;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const config = contactConfig();
  if (config.missing.length || !config.signingKey || !config.intakeUrl) {
    return json({ ok: false, error: "configuration_missing" }, 503);
  }

  let bodyJson: Record<string, string>;
  try {
    const raw = await req.json();
    bodyJson = sanitizeBody(raw, new URL(req.url).origin);
  } catch {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const rawBody = JSON.stringify(bodyJson);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", config.signingKey).update(`${timestamp}.${rawBody}`).digest("hex");

  let upstream: Response;
  try {
    upstream = await fetch(config.intakeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-qme-timestamp": timestamp,
        "x-qme-signature": signature,
      },
      body: rawBody,
    });
  } catch {
    return json({ ok: false, error: "upstream_unreachable" }, 502);
  }

  // Ne jamais relayer le corps d'erreur amont tel quel au visiteur : les
  // codes d'erreur détaillés de Nexora (validation, signature, débit) ne
  // sont pas destinés au public. Seuls "created"/"duplicate"/"received"
  // (succès) sont transmis ; tout le reste devient une erreur générique.
  if (upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    const status = typeof (data as { status?: unknown }).status === "string" ? (data as { status: string }).status : "received";
    return json({ ok: true, status }, upstream.status);
  }

  if (upstream.status === 429) return json({ ok: false, error: "rate_limited" }, 429);
  return json({ ok: false, error: "request_failed" }, 502);
};

export const config: Config = { path: "/api/contact", method: ["POST"] };
