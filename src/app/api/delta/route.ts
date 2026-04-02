import { type NextRequest } from "next/server";
import crypto from "crypto";

const BASE_URL = "https://api.india.delta.exchange";

function generateSignature(secret: string, message: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, queryParams } = body as {
      endpoint: string;
      queryParams?: string;
    };

    const apiKey = process.env.DELTA_API_KEY;
    const apiSecret = process.env.DELTA_API_SECRET;

    if (!apiKey || !apiSecret) {
      return Response.json(
        { success: false, error: "Server-side API keys not configured" },
        { status: 500 }
      );
    }

    if (!endpoint) {
      return Response.json(
        { success: false, error: "Missing endpoint" },
        { status: 400 }
      );
    }

    const allowedEndpoints = [
      "/v2/wallet/balances",
      "/v2/orders",
      "/v2/orders/history",
      "/v2/positions/margined",
      "/v2/fills",
      "/v2/wallet/transactions",
    ];

    if (!allowedEndpoints.includes(endpoint)) {
      return Response.json(
        { success: false, error: "Endpoint not allowed" },
        { status: 403 }
      );
    }

    const method = "GET";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = endpoint;
    const queryString = queryParams ? `?${queryParams}` : "";
    const payload = "";

    const signatureData = method + timestamp + path + queryString + payload;
    const signature = generateSignature(apiSecret, signatureData);

    const url = `${BASE_URL}${path}${queryString}`;

    const res = await fetch(url, {
      method,
      headers: {
        "api-key": apiKey,
        timestamp: timestamp,
        signature: signature,
        "User-Agent": "nextjs-delta-dashboard",
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    return Response.json({
      success: true,
      endpoint,
      status: res.status,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
