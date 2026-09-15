const ALLOWED_ORIGIN_PREFIXES = [
  "https://www.armpal.net",
  "https://armpal.net",
  "http://localhost",
  "https://localhost",
  "capacitor://",
  "ionic://",
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix));
}

export function setPushCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-push-secret"
  );
}

export function handlePushCorsPreflight(req, res) {
  setPushCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
