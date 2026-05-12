import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import crypto from "crypto";
const { supabaseAdmin } = require("../lib/supabase");

const BASE_URL = "https://fapi.binance.com";
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

const ENDPOINTS_TO_SYNC = [
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

let timeOffset = 0;

async function fetchTimeOffset() {
    try {
        const res = await fetch("https://fapi.binance.com/fapi/v1/time");
        const data = await res.json();
        timeOffset = data.serverTime - Date.now();
        console.log(`[BINANCE-SYNC] Time offset calculated: ${timeOffset}ms`);
    } catch (e) {
        console.error("[BINANCE-SYNC] Failed to fetch server time", e);
    }
}

async function fetchFromBinance(endpoint: string, extraParams: string = "") {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_SECERET;

    if (!apiKey || !apiSecret) {
        throw new Error("Missing BINANCE API keys in environment");
    }

    const timestamp = (Date.now() + timeOffset).toString();
    const paramParts = [extraParams, `timestamp=${timestamp}`].filter(Boolean).join("&");
    const signature = generateSignature(apiSecret, paramParts);
    const fullQuery = `${paramParts}&signature=${signature}`;

    const url = `${BASE_URL}${endpoint}?${fullQuery}`;

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "X-MBX-APIKEY": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            const error = await res.text();
            console.error(`[BINANCE-SYNC] Error for ${endpoint}: ${res.status} ${error}`);
            return null;
        }

        const data = await res.json();
        return data;
    } catch (e) {
        console.error(`[BINANCE-SYNC] Network error for ${endpoint}:`, e);
        return null;
    }
}

async function fetchPaginated(endpoint: string) {
    let allResults: any[] = [];
    let pages = 0;

    // 93 days back
    const cutoffMs = Date.now() - (93 * 24 * 60 * 60 * 1000);
    let startTime = cutoffMs;

    // Binance paginate with startTime/endTime/limit
    do {
        console.log(`     -> Fetching page ${pages + 1} for ${endpoint}`);
        const params = `startTime=${startTime}&limit=1000`;
        const data = await fetchFromBinance(endpoint, params);

        if (!data || !Array.isArray(data) || data.length === 0) {
            if (pages === 0 && !Array.isArray(data)) return null; // Error on first page
            break;
        }

        allResults = allResults.concat(data);

        // Move startTime forward past the last item
        const lastItem = data[data.length - 1];
        const lastTime = lastItem.time || lastItem.updateTime || lastItem.createTime || 0;
        if (lastTime <= startTime) break; // no progress
        startTime = lastTime + 1;

        pages++;
        if (pages > 30) break; // Safety cap

        // Rate limit respect
        await new Promise(resolve => setTimeout(resolve, 500));
    } while (true);

    return allResults;
}

async function syncAll() {
    console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Starting Binance Sync...`);

    for (const endpoint of ENDPOINTS_TO_SYNC) {
        let finalData: any;

        // Paginated endpoints: allOrders, userTrades, income
        if (["/fapi/v1/allOrders", "/fapi/v1/userTrades", "/fapi/v1/income"].includes(endpoint)) {
            const results = await fetchPaginated(endpoint);
            finalData = results;
        } else {
            finalData = await fetchFromBinance(endpoint);
        }

        if (finalData !== null) {
            console.log(`   ✅ Fetched ${endpoint}`);

            const { error } = await supabaseAdmin
                .from("binance_sync")
                .upsert({
                    endpoint: endpoint,
                    data: { success: true, result: finalData },
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
    console.log("📱 BINANCE -> SUPABASE SYNC SERVER");
    console.log("=========================================\n");

    if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_SECERET) {
        console.error("❌ ERROR: Missing Binance API keys in environment.");
        process.exit(1);
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("❌ ERROR: Missing Supabase environment variables.");
        process.exit(1);
    }

    // Initial sync
    await fetchTimeOffset();
    await syncAll();

    // Loop
    setInterval(async () => {
        try {
            await fetchTimeOffset(); // Sync time periodically
            await syncAll();
        } catch (e) {
            console.error("[BINANCE-SYNC] Global loop error:", e);
        }
    }, SYNC_INTERVAL_MS);
}

start().catch(console.error);
