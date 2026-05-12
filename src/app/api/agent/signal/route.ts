import { NextResponse } from "next/server";
import { fetchBTCData } from "@/bot/market";
import { askAgent } from "@/bot/agent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const marketData = await fetchBTCData();
    if (!marketData) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch market data" },
        { status: 500 }
      );
    }

    const signal = await askAgent(marketData);
    if (!signal) {
      return NextResponse.json(
        { success: false, error: "AI Agent failed to provide a signal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      signal
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
