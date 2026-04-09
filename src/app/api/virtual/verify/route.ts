import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    const correctPin = process.env.VIRTUAL_PIN || "0000"; // fallback

    if (pin === correctPin) {
      return Response.json({ success: true });
    } else {
      return Response.json({ success: false, error: "Invalid PIN" }, { status: 401 });
    }
  } catch (err) {
    return Response.json({ success: false, error: "Bad Request" }, { status: 400 });
  }
}
