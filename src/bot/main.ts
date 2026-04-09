import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { fetchBTCData } from "./market";
import { askAgent } from "./agent";
import { setLeverage, executeLiveOrder } from "./delta";
import { recordVirtualTrade } from "../lib/db";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loop() {
  console.log("\n=============================================");
  const modeText = process.env.LIVE_TRADING === "true" ? "LIVE REAL-MONEY MODE" : "DRY RUN MODE";
  console.log(`🤖 DELTA AI TRADING BOT (${modeText}) [STARTED]`);
  console.log("=============================================\n");

  while (true) {
    const timeNow = new Date().toLocaleTimeString();
    console.log(`[${timeNow}] 🔍 Analyzing Market Data...`);

    const data = await fetchBTCData();
    if (!data) {
      console.log(`[${timeNow}] ❌ Failed to fetch market data. Retrying in 15min.`);
      await sleep(15 * 60 * 1000);
      continue;
    }

    console.log(`[${timeNow}] 📊 BTC Price: $${data.currentPrice} | 15m RSI: ${data.currentRSI.toFixed(2)}`);
    console.log(`[${timeNow}] 🧠 Consulting Groq AI Brain...`);

    const decision = await askAgent(data);

    if (!decision) {
      console.log(`[${timeNow}] ❌ AI Agent failed to return a proper JSON response.`);
    } else {
      console.log("\n--- AI DECISION ---");
      console.log(`Action     : ${decision.action}`);
      console.log(`Confidence : ${decision.confidence_score}%`);
      console.log(`Analysis   : ${decision.analysis}`);
      
      if (decision.action !== "HOLD") {
         console.log(`Leverage   : ${decision.leverage || 1}x`);
         console.log(`Entry      : $${decision.entry_price}`);
         console.log(`Stop Loss  : $${decision.stop_loss}`);
         console.log(`Take Profit: $${decision.take_profit_1}`);
      }
      console.log("-------------------\n");

      if (decision.action !== "HOLD" && decision.confidence_score >= 80) {
        if (process.env.LIVE_TRADING === "true") {
          console.log(`[${timeNow}] 🚀 STRONG SIGNAL DETECTED. Executing LIVE Trade on Delta!`);
          if (decision.leverage) {
             await setLeverage(decision.leverage);
          }
          await executeLiveOrder(decision.action, 10, decision.entry_price, decision.stop_loss);
        } else {
          console.log(`[${timeNow}] 🚀 STRONG SIGNAL DETECTED. (Dry Run - Writing to Virtual DB)`);
          const price = decision.entry_price || data.currentPrice;
          recordVirtualTrade({
              symbol: "BTC",
              side: decision.action.toLowerCase() as "buy" | "sell",
              price: price,
              size: Number((10 / price).toFixed(6)), // $10 equivalent size
              leverage: decision.leverage || 1,
              is_bot: true
          });
        }
      } else if (decision.action !== "HOLD" && decision.confidence_score < 80) {
        console.log(`[${timeNow}] 🛡️ SIGNAL SKIPPED: Confidence below 80% threshold.`);
      }
    }

    console.log(`[${timeNow}] 💤 Sleeping for 15 minutes...\n`);
    
    // In our test right now we'll do a 15 min sleep
    // You can press Ctrl+C to stop the terminal
    await sleep(15 * 60 * 1000);
  }
}

loop().catch(console.error);
