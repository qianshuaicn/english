import { NextResponse } from "next/server";
import { updateTaskStatus } from "@/lib/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = body.status;
    if (!["已完成", "进行中", "未开始"].includes(status)) {
      return NextResponse.json({ error: "不支持的任务状态。" }, { status: 400 });
    }
    const page = await updateTaskStatus(id, status);
    return NextResponse.json({ id: page.id, status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新任务失败" }, { status: 500 });
  }
}