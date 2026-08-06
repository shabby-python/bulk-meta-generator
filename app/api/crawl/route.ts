import { NextResponse } from "next/server";
import { crawlOne } from "@/lib/crawler/crawl";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "Missing required field: url" }, { status: 400 });
  }

  const outcome = await crawlOne(body.url.trim());
  return NextResponse.json(outcome);
}
