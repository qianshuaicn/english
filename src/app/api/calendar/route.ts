import { NextResponse } from "next/server";
import { getCalendarEvents } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ events: await getCalendarEvents() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取学习日历失败" }, { status: 500 });
  }
}