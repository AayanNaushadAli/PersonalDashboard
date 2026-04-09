import { RSI } from "technicalindicators";

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchBTCData() {
  try {
    // We use Binance public API for flawless, authentication-less OHLCV data
    const res = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=50");
    const data = await res.json() as any[][];
    
    const candles: Candle[] = data.map((c) => ({
      time: new Date(c[0]).toISOString(),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));

    // Calculate RSI
    const closePrices = candles.map(c => c.close);
    const rsiInput = { values: closePrices, period: 14 };
    const rsiValues = RSI.calculate(rsiInput);
    const currentRSI = rsiValues[rsiValues.length - 1];

    const currentPrice = candles[candles.length - 1].close;

    return { candles, currentRSI, currentPrice };
  } catch (error) {
    console.error("Failed to fetch market data", error);
    return null;
  }
}
