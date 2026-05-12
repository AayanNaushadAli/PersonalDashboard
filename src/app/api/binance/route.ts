import { type NextRequest } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://fapi.binance.com";

const ALLOWED_ENDPOINTS = [
  "/fapi/v3/balance",
  "/fapi/v3/account",
  "/fapi/v3/positionRisk",
  "/fapi/v1/openOrders",
  "/fapi/v1/allOrders",
  "/fapi/v1/userTrades",
  "/fapi/v1/income",
];

function generateSignature(secret: string, queryString: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(queryString)
    .digest("hex");
}

let cachedTimeOffset: number | null = null;

async function getServerTimeOffset(): Promise<number> {
  if (cachedTimeOffset !== null) return cachedTimeOffset;
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/time");
    const data = await res.json();
    cachedTimeOffset = data.serverTime - Date.now();
    return cachedTimeOffset;
  } catch (e) {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, queryParams } = body as {
      endpoint: string;
      queryParams?: string;
    };

    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_SECERET; // matching env var name

    if (!apiKey || !apiSecret) {
      return Response.json(
        { success: false, error: "Server-side Binance API keys not configured" },
        { status: 500 }
      );
    }

    if (!endpoint) {
      return Response.json(
        { success: false, error: "Missing endpoint" },
        { status: 400 }
      );
    }

    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return Response.json(
        { success: false, error: "Endpoint not allowed" },
        { status: 403 }
      );
    }

    const timeOffset = await getServerTimeOffset();
    const timestamp = (Date.now() + timeOffset).toString();
    
    // Build query string: user params + timestamp
    const paramParts = [queryParams, `timestamp=${timestamp}`].filter(Boolean).join("&");
    
    // Sign the full query string
    const signature = generateSignature(apiSecret, paramParts);
    const fullQuery = `${paramParts}&signature=${signature}`;

    const url = `${BASE_URL}${endpoint}?${fullQuery}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    // Binance returns arrays directly for most endpoints (not wrapped in {success, result})
    // Normalize to match the pattern the frontend expects
    return Response.json({
      success: res.ok,
      endpoint,
      status: res.status,
      data: {
        success: res.ok,
        result: data, // could be array or object
        ...(data.code ? { error: { code: data.code, msg: data.msg } } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
