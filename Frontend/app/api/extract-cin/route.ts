import { NextRequest, NextResponse } from "next/server"

// Runs on the Node.js runtime so we can stream a multipart file upstream.
export const runtime = "nodejs"

// Server-side URL of the Django CIN-extraction microservice. Kept off the
// browser (no NEXT_PUBLIC_ prefix); defaults to the local dev port.
const EXTRACTION_SERVICE_URL =
  process.env.EXTRACTION_SERVICE_URL || "http://127.0.0.1:8100"

/**
 * Proxies a CIN image upload to the extraction microservice.
 *
 * The browser posts multipart form-data with a `file` field to this same-origin
 * route; we forward it to `POST /api/extract/cin/` and pass the JSON response
 * (and status code) straight back. This avoids CORS and hides the service URL.
 */
export async function POST(request: NextRequest) {
  let incoming: FormData
  try {
    incoming = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : téléversement multipart attendu." },
      { status: 400 },
    )
  }

  const file = incoming.get("file")
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Aucun fichier fourni." },
      { status: 400 },
    )
  }

  const upstream = new FormData()
  upstream.append("file", file, (file as File).name || "cin.jpg")

  let response: Response
  try {
    response = await fetch(`${EXTRACTION_SERVICE_URL}/api/extract/cin/`, {
      method: "POST",
      body: upstream,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: "Le service d'extraction est injoignable.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    )
  }

  const text = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { error: "Réponse inattendue du service d'extraction.", detail: text }
  }

  return NextResponse.json(payload, { status: response.status })
}
