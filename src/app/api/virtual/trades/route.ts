import { NextRequest } from "next/server";
import { readDB, recordVirtualTrade } from "@/lib/db";

export async function GET() {
   const state = readDB();
   return Response.json({ success: true, ...state });
}

export async function POST(req: NextRequest) {
   try {
       const body = await req.json();
       const state = recordVirtualTrade({
          symbol: body.symbol,
          side: body.side,
          price: Number(body.price),
          size: Number(body.size),
          leverage: body.leverage ? Number(body.leverage) : undefined,
          is_bot: false
       });
       return Response.json({ success: true, ...state });
   } catch (e: any) {
       return Response.json({ success: false, error: e.message }, { status: 400 });
   }
}
