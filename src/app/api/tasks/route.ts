import { NextResponse } from "next/server";
import { createStudyTask, getStudyTasks } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await getStudyTasks() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取学习任务失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const moduleName = typeof body.module === "string" ? body.module.trim() : "";
    if (!name || name.length > 120) {
      return NextResponse.json({ error: "任务名称不能为空，且不能超过 120 个字符。" }, { status: 400 });
    }
    const page = await createStudyTask(name, moduleName);
    return NextResponse.json({ id: page.id, url: page.url }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "创建任务失败" }, { status: 500 });
  }
}