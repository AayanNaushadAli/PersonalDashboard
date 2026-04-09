import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import crypto from "crypto";
const { supabaseAdmin } = require("../lib/supabase");

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

async function fetchFromDelta(endpoint: string, qString: string = "") {
    const apiKey = process.env.DELTA_API_KEY;
    const apiSecret = process.env.DELTA_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error("Missing DELTA API keys in environment");
    }

    const method = "GET";
    const path = endpoint;
    const queryString = qString;
    const payload = "";

    const { signature, timestamp } = generateSignature(apiSecret, method, path, queryString, payload);

    try {
        const res = await fetch(`${BASE_URL}${path}${queryString ? "?" + queryString : ""}`, {
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
        return data; // Return full response including meta for pagination
    } catch (e) {
        console.error(`[SYNC] network error for ${endpoint}:`, e);
        return null;
    }
}

async function fetchAllPages(endpoint: string) {
    let allResults: any[] = [];
    let afterCursor: string | null = null;
    let pages = 0;
    
    // We only want 93 days of history
    const cutoffDate = Date.now() - (93 * 24 * 60 * 60 * 1000);

    do {
        console.log(`     -> Fetching page ${pages + 1} for ${endpoint}`);
        const q = afterCursor ? `after=${afterCursor}&page_size=100` : `page_size=100`;
        const data = await fetchFromDelta(endpoint, q);

        if (data?.data?.success && Array.isArray(data.data.result)) {
            const items = data.data.result;
            allResults = allResults.concat(items);
            afterCursor = data.data.meta?.after || null;
            
            // Check if we've reached data older than 93 days
            if (items.length > 0) {
                const oldestItem = items[items.length - 1];
                const itemDate = new Date(oldestItem.updated_at || oldestItem.created_at).getTime();
                if (itemDate < cutoffDate) {
                    console.log(`     -> Reached 93-day limit for ${endpoint}`);
                    break;
                }
            }
        } else {
            break;
        }
        pages++;
        // Safety cap to prevent abusing API
        if (pages > 50) break;
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
    } while (afterCursor);

    return { success: true, result: allResults };
}

async function syncAll() {
    console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Starting Global Sync...`);
    
    for (const endpoint of ENDPOINTS_TO_SYNC) {
        let finalData;
        if (endpoint === "/v2/orders/history" || endpoint === "/v2/wallet/transactions") {
            finalData = await fetchAllPages(endpoint);
        } else {
            const raw = await fetchFromDelta(endpoint);
            finalData = raw?.data || raw;
        }

        if (finalData) {
            console.log(`   ✅ Fetched ${endpoint}`);
            
            const { error } = await supabaseAdmin
                .from("delta_sync")
                .upsert({ 
                    endpoint: endpoint, 
                    data: { success: true, result: finalData.result || finalData },
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
