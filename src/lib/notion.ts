import { cache } from "react";

const API_BASE = "https://api.notion.com/v1";
const API_VERSION = process.env.NOTION_API_VERSION || "2025-09-03";

export type NotionProperty = Record<string, any>;
export type StudyTask = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  todayHours: number | null;
  totalHours: number | null;
  due: string | null;
  module: string | null;
  url?: string;
};
export type CalendarEvent = {
  id: string;
  name: string;
  date: string | null;
  details: string;
};

function config() {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("缺少 NOTION_API_KEY，请在本地 .env.local 或 Vercel 环境变量中配置。");
  return token;
}

async function notionFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = config();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": API_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.message || `Notion API 请求失败 (${response.status})`;
    throw new Error(`${message}${body?.code ? ` [${body.code}]` : ""}`);
  }
  return body as T;
}

function getSourceId(kind: "study" | "calendar") {
  const id = kind === "study"
    ? process.env.NOTION_STUDY_DATA_SOURCE_ID
    : process.env.NOTION_CALENDAR_DATA_SOURCE_ID;
  if (!id) throw new Error(`缺少 ${kind === "study" ? "NOTION_STUDY_DATA_SOURCE_ID" : "NOTION_CALENDAR_DATA_SOURCE_ID"} 环境变量。`);
  return id.replace(/-/g, "");
}

type SourceSchema = { properties: Record<string, { type: string; [key: string]: any }> };
const getSchema = cache(async (sourceId: string): Promise<SourceSchema> => {
  const data = await notionFetch<any>(`/data_sources/${sourceId}`);
  return { properties: data.properties || {} };
});

function titleText(prop: NotionProperty | undefined): string {
  if (!prop) return "";
  const arr = prop.title || prop.rich_text || [];
  return arr.map((x: any) => x.plain_text || x.text?.content || "").join("");
}
function selectText(prop: NotionProperty | undefined): string {
  return prop?.status?.name || prop?.select?.name || "";
}
function numberValue(prop: NotionProperty | undefined): number | null {
  const v = prop?.number;
  return typeof v === "number" ? v : null;
}
function dateValue(prop: NotionProperty | undefined): string | null {
  return prop?.date?.start || null;
}
function propertyName(properties: Record<string, any>, expected: string) {
  if (properties[expected]) return expected;
  const key = Object.keys(properties).find(k => k.toLowerCase() === expected.toLowerCase());
  return key || expected;
}

async function querySource(sourceId: string) {
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const result = await notionFetch<any>(`/data_sources/${sourceId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    all.push(...(result.results || []));
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return all;
}

export async function getStudyTasks(): Promise<StudyTask[]> {
  const sourceId = getSourceId("study");
  const schema = await getSchema(sourceId);
  const p = schema.properties;
  const taskKey = propertyName(p, "Task");
  const statusKey = propertyName(p, "Status");
  const progressKey = propertyName(p, "总进度");
  const todayHoursKey = propertyName(p, "当日学时");
  const totalHoursKey = propertyName(p, "总学时");
  const dueKey = propertyName(p, "Due");
  const moduleKey = propertyName(p, "Module");
  const rows = await querySource(sourceId);
  return rows.map(row => {
    const props = row.properties || {};
    return {
      id: row.id,
      name: titleText(props[taskKey]) || "未命名任务",
      status: selectText(props[statusKey]) || "未开始",
      progress: numberValue(props[progressKey]) ?? (() => {
        const raw = titleText(props[progressKey]) || "";
        const n = Number(raw.replace("%", ""));
        return Number.isFinite(n) && raw ? n : null;
      })(),
      todayHours: numberValue(props[todayHoursKey]),
      totalHours: numberValue(props[totalHoursKey]),
      due: dateValue(props[dueKey]),
      module: selectText(props[moduleKey]) || null,
      url: row.url,
    };
  });
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const sourceId = getSourceId("calendar");
  const schema = await getSchema(sourceId);
  const p = schema.properties;
  const eventKey = propertyName(p, "event");
  const dateKey = propertyName(p, "Date");
  const detailsKey = propertyName(p, "Detailed records");
  const rows = await querySource(sourceId);
  return rows.map(row => ({
    id: row.id,
    name: titleText(row.properties?.[eventKey]) || "学习记录",
    date: dateValue(row.properties?.[dateKey]),
    details: titleText(row.properties?.[detailsKey]),
  }));
}

export async function updateTaskStatus(pageId: string, statusName: string) {
  const sourceId = getSourceId("study");
  const schema = await getSchema(sourceId);
  const key = propertyName(schema.properties, "Status");
  const type = schema.properties[key]?.type;
  let value: Record<string, unknown>;
  if (type === "status") value = { status: { name: statusName } };
  else if (type === "select") value = { select: { name: statusName } };
  else throw new Error(`Notion 的 Status 字段类型是 ${type || "未知"}，需要设置为 Status 或 Select。`);
  return notionFetch<any>(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { [key]: value } }),
  });
}

export async function createStudyTask(name: string, moduleName: string) {
  const sourceId = getSourceId("study");
  const schema = await getSchema(sourceId);
  const p = schema.properties;
  const taskKey = propertyName(p, "Task");
  const statusKey = propertyName(p, "Status");
  const moduleKey = propertyName(p, "Module");
  const properties: Record<string, unknown> = {
    [taskKey]: { title: [{ text: { content: name } }] },
  };
  const statusType = p[statusKey]?.type;
  if (statusType === "status") properties[statusKey] = { status: { name: "未开始" } };
  else if (statusType === "select") properties[statusKey] = { select: { name: "未开始" } };
  if (moduleName && p[moduleKey]?.type === "select") properties[moduleKey] = { select: { name: moduleName } };
  return notionFetch<any>("/pages", {
    method: "POST",
    body: JSON.stringify({ parent: { type: "data_source_id", data_source_id: sourceId }, properties }),
  });
}