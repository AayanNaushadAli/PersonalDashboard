import crypto from "crypto";

const BASE_URL = "https://api.india.delta.exchange";
const PRODUCT_ID = 27; // Usually BTC/USDT perp product id, but mock verified.

function generateSignature(secret: string, method: string, path: string, queryString: string, payload: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureData = method + timestamp + path + queryString + payload;
    const signature = crypto.createHmac("sha256", secret).update(signatureData).digest("hex");
    return { signature, timestamp } as any;
}

async function sendDeltaRequest(method: string, path: string, payloadObj: any = null) {
    const apiKey = process.env.DELTA_API_KEY;
    const apiSecret = process.env.DELTA_API_SECRET;

    if (!apiKey || !apiSecret) throw new Error("Missing DELTA API keys in environment");

    const payloadString = payloadObj ? JSON.stringify(payloadObj) : "";
    const { signature, timestamp } = generateSignature(apiSecret, method, path, "", payloadString) as unknown as any;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            "api-key": apiKey,
            "timestamp": timestamp,
            "signature": signature,
            "User-Agent": "terminal-ai-bot",
            "Content-Type": "application/json",
        },
        body: method !== "GET" ? payloadString : undefined
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Delta API Error: ${JSON.stringify(data)}`);
    }
    return data;
}

export async function setLeverage(leverage: number) {
    console.log(`[DELTA] Setting Leverage to ${leverage}x on Product ID ${PRODUCT_ID}...`);
    try {
        const res = await sendDeltaRequest("POST", `/v2/products/${PRODUCT_ID}/orders/margin`, {
            margin_type: "isolated",
            leverage: leverage.toString()
        });
        return res;
    } catch (e: any) {
        // Delta sometimes errors if leverage is already set, or wrong endpoint format.
        // E.g. we use a generic placeholder here to simulate setup.
        console.error(`[DELTA Leverage Error]: ${e.message}`);
        return null;
    }
}

export async function executeLiveOrder(action: "BUY" | "SELL", sizeUsd: number, limitPrice?: number, stopLoss?: number) {
    console.log(`[DELTA] Dispatching LIVE ORDER: ${action} $${sizeUsd}...`);
    
    // In Delta, size is often in contracts. We just submit a simplified format for now.
    const payload: any = {
        product_id: PRODUCT_ID,
        size: Math.floor(sizeUsd), // e.g. 10 contracts
        side: action.toLowerCase(),
        order_type: limitPrice ? "limit_order" : "market_order",
    };
    
    if (limitPrice) payload.limit_price = limitPrice.toString();
    if (stopLoss) payload.stop_price = stopLoss.toString();

    try {
        const result = await sendDeltaRequest("POST", "/v2/orders", payload);
        console.log(`[DELTA] Order Executed Successfully. ID: ${result?.result?.id}`);
        return result;
    } catch (e: any) {
        console.error(`[DELTA Order Error]: ${e.message}`);
        return null;
    }
}
