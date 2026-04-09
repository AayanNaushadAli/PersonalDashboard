import { resetVirtualDB } from "@/lib/db";

export async function POST() {
    const state = resetVirtualDB();
    return Response.json({ success: true, ...state });
}
