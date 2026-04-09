import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase";

const BASE_URL = "https://api.india.delta.exchange";
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

const ENDPOINTS_TO_SYNC = [
  "/v2/wallet/balances",
  "/v2/orders",
  "/v2/orders/history",
  "/v2/positions/margined",
  "/v2/fills",
  "/v2/wallet/transactions",
];

function generateSignature(secret: string, method: string, path: string, queryString: string, payload: string): { signature: string, timestamp: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureData = method + timestamp + path + queryString + payload;
    const signature = crypto.createHmac("sha256", secret).update(signatureData).digest("hex");
    return { signature, timestamp };
}

async function fetchFromDelta(endpoint: string) {
    const apiKey = process.env.DELTA_API_KEY;
    const apiSecret = process.env.DELTA_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error("Missing DELTA API keys in environment");
    }

    const method = "GET";
    const path = endpoint;
    const queryString = "";
    const payload = "";

    const { signature, timestamp } = generateSignature(apiSecret, method, path, queryString, payload);

    try {
        const res = await fetch(`${BASE_URL}${path}${queryString}`, {
            method,
            headers: {
                "api-key": apiKey,
                "timestamp": timestamp,
                "signature": signature,
                "User-Agent": "phone-sync-server",
                "Content-Type": "application/json",
            }
        });

        if (!res.ok) {
            const error = await res.text();
            console.error(`[SYNC] Delta Error for ${endpoint}: ${res.status} ${error}`);
            return null;
        }

        const data = await res.json();
        return data.data || data; // Delta usually wraps in { data: ... }
    } catch (e) {
        console.error(`[SYNC] network error for ${endpoint}:`, e);
        return null;
    }
}

async function syncAll() {
    console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Starting Global Sync...`);
    
    for (const endpoint of ENDPOINTS_TO_SYNC) {
        const data = await fetchFromDelta(endpoint);
        if (data) {
            console.log(`   ✅ Fetched ${endpoint}`);
            
            const { error } = await supabaseAdmin
                .from("delta_sync")
                .upsert({ 
                    endpoint: endpoint, 
                    data: data,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'endpoint' });

            if (error) {
                console.error(`   ❌ Supabase Error for ${endpoint}:`, error.message);
            } else {
                console.log(`   💾 Saved to Supabase`);
            }
        }
    }
}

async function start() {
    console.log("=========================================");
    console.log("📱 DELTA -> SUPABASE SYNC SERVER (PHONE)");
    console.log("=========================================\n");

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("❌ ERROR: Missing Supabase environment variables.");
        process.exit(1);
    }

    // Initial sync
    await syncAll();

    // Loop
    setInterval(async () => {
        try {
            await syncAll();
        } catch (e) {
            console.error("[SYNC] Global loop error:", e);
        }
    }, SYNC_INTERVAL_MS);
}

start().catch(console.error);
