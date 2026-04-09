import Groq from "groq-sdk";
import fs from "fs";
import path from "path";

let groq: Groq | null = null;

export const getGroqClient = () => {
    if (!groq) {
        groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groq;
};

export interface TradeDecision {
  analysis: string;
  confidence_score: number;
  action: "BUY" | "SELL" | "HOLD";
  entry_price?: number;
  stop_loss?: number;
  take_profit_1?: number;
  leverage?: number;
}

export async function askAgent(marketData: any): Promise<TradeDecision | null> {
  // Read the AI instructions
  const promptPath = path.join(process.cwd(), "trade.md");
  const systemPrompt = fs.readFileSync(promptPath, "utf-8");

  // Format market data for context
  const marketContext = `
CURRENT BTC/USDT MARKET DATA (Last 15m candle close):
Price: $${marketData.currentPrice}
15m RSI (14): ${marketData.currentRSI.toFixed(2)}

Recent 5 Candles (OHLCV):
${JSON.stringify(marketData.candles.slice(-5), null, 2)}

You must respond in strict JSON format matching this schema:
{
  "analysis": "string detailing your reasoning",
  "confidence_score": number (0-100),
  "action": "BUY" | "SELL" | "HOLD",
  "entry_price": number (optional),
  "stop_loss": number (optional),
  "take_profit_1": number (optional),
  "leverage": number (optional, e.g. 1 to 10 based on risk and confidence)
}
`;

  try {
    const client = getGroqClient();
    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: marketContext }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = chatCompletion.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as TradeDecision;
  } catch (error) {
    console.error("Agent failed to process:", error);
    return null;
  }
}
