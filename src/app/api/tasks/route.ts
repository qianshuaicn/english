import { NextResponse } from "next/server";
import { getStudyTasks } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await getStudyTasks() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取学习任务失败" }, { status: 500 });
  }
}
