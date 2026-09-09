// Vercel serverless function — proxies chat requests to the Anthropic API.
// This keeps ANTHROPIC_API_KEY on the server; it is never sent to the browser.
//
// The frontend (src/App.jsx) calls fetch("/api/chat", { method: "POST", body: {...} })
// with the same shape it would send directly to Anthropic: { model, max_tokens, messages }.
// This function just forwards that body and adds the API key + required headers.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not set. Add it in your hosting provider's environment variables.",
    });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await anthropicRes.json();
    return res.status(anthropicRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Anthropic API", detail: String(err) });
  }
}
