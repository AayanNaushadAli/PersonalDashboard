import { NextRequest } from "next/server";
import { resetVirtualDB } from "@/lib/db";

export async function POST(request: NextRequest) {
    const pin = request.headers.get("x-virtual-pin");
    const correctPin = process.env.VIRTUAL_PIN || "0000";

    if (pin !== correctPin) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const state = resetVirtualDB();
    return Response.json({ success: true, ...state });
}
