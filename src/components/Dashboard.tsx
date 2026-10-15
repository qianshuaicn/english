"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Task = {
  id: string; name: string; status: string; progress: number | null;
  todayHours: number | null; totalHours: number | null; due: string | null;
  module: string | null; url?: string;
};
type Event = { id: string; name: string; date: string | null; details: string; content: string; url?: string };
const modules = [
  { name: "听力练习", icon: "🎧", color: "#5595e9", hint: "精听 · 跟读 · 复盘" },
  { name: "阅读训练", icon: "📖", color: "#36a981", hint: "限时阅读 · 错题分析" },
  { name: "写作提升", icon: "✍️", color: "#e7a14b", hint: "范文拆解 · 观点积累" },
  { name: "口语准备", icon: "🗣️", color: "#9a75df", hint: "Part 1 · Part 2 · Part 3" },
  { name: "模拟考试", icon: "📝", color: "#e57f94", hint: "计时练习 · 成绩复盘" },
  { name: "词汇积累", icon: "📚", color: "#4caeb0", hint: "新词 · 例句 · 复习" },
  { name: "学习计划", icon: "📅", color: "#7d83d9", hint: "目标拆解 · 每日打卡" },
  { name: "错题本", icon: "📓", color: "#e69b5d", hint: "错误模式 · 定期回顾" },
];
const nav = [
  ["⌂", "学习总览"], ["☑", "每日打卡"], ["▦", "学习日历"], ["◷", "学习统计"],
];
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const formatDate = (d: Date) => d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
const monthLabel = (d: Date) => d.toLocaleDateString("zh-CN", { year: "numeric", month: "long" });
const isDone = (status: string) => ["已完成", "完成", "Done", "Completed"].includes(status);
const isInProgress = (status: string) => ["进行中", "In progress", "In Progress"].includes(status);

// 音标页面使用你提供的 Notion 深链接；其他任务优先使用学习看板数据库行自身的 Notion 页面链接。
const PHONETICS_NOTION_URL = "https://app.notion.com/p/qianshuaiblog/1cd7d4cca92a838eb1c581a0af55121c?p=3f97d4cca92a809d9498e286c0d391c9&pm=s";
const getTaskNotionUrl = (task: Task) => task.name.trim().includes("音标") ? PHONETICS_NOTION_URL : task.url;

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("全部任务");
  const [month, setMonth] = useState(() => new Date());
  const [activeNav, setActiveNav] = useState("学习总览");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [taskRes, calendarRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/calendar")]);
      const taskData = await taskRes.json();
      const calendarData = await calendarRes.json();
      if (!taskRes.ok) throw new Error(taskData.error || "学习看板读取失败");
      setTasks(taskData.tasks || []);
      if (calendarRes.ok) setEvents(calendarData.events || []);
      else setNotice(calendarData.error || "学习日历暂不可用，学习看板仍可使用。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取数据失败");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const completed = tasks.filter(t => isDone(t.status)).length;
  const inProgress = tasks.filter(t => isInProgress(t.status)).length;
  const totalHours = tasks.reduce((sum, t) => sum + (t.totalHours || 0), 0);
  const todayHours = tasks.reduce((sum, t) => sum + (t.todayHours || 0), 0);
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const filtered = tasks.filter(t => {
    if (filter === "待开始") return !isDone(t.status) && !isInProgress(t.status);
    if (filter === "进行中") return isInProgress(t.status);
    if (filter === "已完成") return isDone(t.status);
    return true;
  });
  const eventDates = useMemo(() => new Set(events.map(e => e.date).filter(Boolean)), [events]);
  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start); date.setDate(start.getDate() + i);
      const iso = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
      return { date, iso, outside: date.getMonth() !== month.getMonth(), today: iso === todayISO(), hasEvent: eventDates.has(iso) };
    });
  }, [month, eventDates]);

  async function toggleTask(task: Task) {
    const nextStatus = isDone(task.status) ? "进行中" : "已完成";
    setBusy(task.id); setNotice(""); setError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失败");
      setTasks(old => old.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
      setNotice(nextStatus === "已完成" ? `已打卡：${task.name}` : `已将「${task.name}」设为进行中`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally { setBusy(null); }
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">✦</div><div><div className="brand-name">STUDY SPACE</div><div className="brand-sub">IELTS · PERSONAL GROWTH</div></div></div>
      <div><div className="nav-label">WORKSPACE</div><nav className="nav-list">{nav.map(([icon, label]) => <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => { setActiveNav(label); if (label === "每日打卡") document.getElementById("tasks")?.scrollIntoView({ behavior: "smooth" }); else if (label === "学习日历") document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth" }); else if (label === "学习统计") document.getElementById("stats")?.scrollIntoView({ behavior: "smooth" }); else window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className="nav-icon">{icon}</span>{label}</button>)}</nav></div>
      <div><div className="nav-label">IELTS MODULES</div><nav className="nav-list">{modules.slice(0, 6).map(m => <a key={m.name} className="nav-item" href="#modules"><span className="nav-icon">{m.icon}</span>{m.name}</a>)}</nav></div>
      <div className="sidebar-bottom"><strong>🌱 每天进步一点点</strong><p>不追求一次学很多，只要今天比昨天多掌握一点。</p></div>
    </aside>

    <main className="main">
      <header className="topbar"><div><div className="eyebrow">YOUR LEARNING JOURNEY</div><h1 className="page-title">学习总览</h1><div className="page-subtitle">{formatDate(new Date())} · 稳步积累，持续进步</div></div><div className="top-actions"><div className="date-chip">📅 {todayISO()}</div><div className="avatar">学</div></div></header>

      {error && <div className="notice error">{error}<div style={{ marginTop: 7 }}><button className="text-button" onClick={() => void load()}>重新加载</button></div></div>}
      {notice && <div className="notice">{notice}</div>}

      <section className="hero"><div className="hero-copy"><div className="hero-kicker">SMALL STEPS, BIG PROGRESS</div><h2>今天也为目标前进一步 ✨</h2><p>把学习拆成可完成的小任务。完成一次打卡，就是向更好的自己靠近一步。</p></div><div className="hero-stat"><strong>{percent}%</strong><span>任务完成率</span><div className="progress-line" style={{ background: "#ffffff44", marginTop: 11 }}><span style={{ width: `${percent}%`, background: "#fff" }}/></div></div></section>

      <div className="section-heading" id="stats"><div><h2>今日学习数据</h2><p>把每一次努力，都记录下来</p></div><button className="text-button" onClick={() => void load()}>↻ 刷新数据</button></div>
      <section className="stats-grid">
        <Stat icon="☑" color="#7568e8" bg="#f0edff" label="已完成任务" value={`${completed} / ${tasks.length}`} foot={`${percent}% 总完成率`}/>
        <Stat icon="◷" color="#e7a14b" bg="#fff3df" label="当日学习时长" value={`${todayHours.toFixed(1)}h`} foot="来自学习看板「当日学时」"/>
        <Stat icon="▤" color="#36a981" bg="#e8f8f0" label="累计学习时长" value={`${totalHours.toFixed(1)}h`} foot="来自学习看板「总学时」"/>
        <Stat icon="✦" color="#5595e9" bg="#eaf3ff" label="进行中任务" value={inProgress} foot="保持节奏，持续推进"/>
      </section>

      <div className="content-grid">
        <section id="tasks">
          <div className="section-heading"><div><h2>📋 今日学习任务</h2><p>来自你的 Notion「学习看板」数据库</p></div></div>
          <div className="panel">
            <div className="panel-title-row"><div><div className="panel-title">任务清单</div><div className="panel-note">点击任务名称打开对应的 Notion 页面；左侧方框用于学习打卡</div></div><span className="pill">{filtered.length} 项</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 13 }}>{["全部任务", "待开始", "进行中", "已完成"].map(f => <button key={f} className="pill" onClick={() => setFilter(f)} style={filter === f ? { background: "#eeeaff", color: "#6758d9" } : {}}>{f}</button>)}</div>
            {loading ? <div className="loading">正在读取你的 Notion 学习看板…</div> : filtered.length === 0 ? <div className="empty">当前筛选条件下没有任务。</div> :
              <div className="task-list">{filtered.map(task => {
                const done = isDone(task.status);
                const statusClass = done ? "done" : isInProgress(task.status) ? "" : "notstarted";
                const progress = task.progress ?? (done ? 100 : isInProgress(task.status) ? 35 : 0);
                const taskUrl = getTaskNotionUrl(task);
                return <div className="task-row" key={task.id}><button aria-label={done ? "取消完成" : "标记完成"} className={`task-check ${done ? "done" : ""}`} disabled={busy === task.id} onClick={() => void toggleTask(task)}>{done ? "✓" : ""}</button><div className="task-info"><div className="task-name">{taskUrl ? <a className="task-name-link" href={taskUrl} target="_blank" rel="noreferrer" title={`在 Notion 中打开：${task.name}`}>{task.name} <span aria-hidden="true">↗</span></a> : task.name}</div><div className="task-meta">{task.module || "英语学习"}{task.due ? ` · 截止 ${task.due}` : ""}</div><div className="progress-line"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></div></div><span className={`status ${statusClass}`}>{busy === task.id ? "保存中" : task.status}</span>{task.todayHours !== null && <span className="task-hours">{task.todayHours}h</span>}</div>;
              })}</div>}
          </div>
        </section>

        <section id="calendar">
          <div className="section-heading"><div><h2>🗓️ 学习日历</h2><p>查看每天留下的学习足迹</p></div></div>
          <div className="panel">
            <div className="calendar-head"><div className="calendar-month">{monthLabel(month)}</div><div className="month-nav"><button aria-label="上个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}>‹</button><button aria-label="下个月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}>›</button></div></div>
            <div className="calendar-grid">{["一","二","三","四","五","六","日"].map(d => <div key={d} className="weekday">{d}</div>)}{calendarCells.map(c => <div key={c.iso} className={`calendar-day ${c.outside ? "outside" : ""} ${c.today ? "today" : ""} ${c.hasEvent ? "has-event" : ""}`} title={events.filter(e => e.date === c.iso).map(e => e.name).join("、") || c.iso}><span>{c.date.getDate()}</span>{c.hasEvent && <span className="day-dot"/>}</div>)}</div>
            <div className="panel-note" style={{ marginTop: 13 }}>🟢 有记录的日期会显示标记</div>
            <div style={{ borderTop: "1px solid #eff0f5", marginTop: 16, paddingTop: 14 }}><div className="panel-title" style={{ fontSize: 12, marginBottom: 9 }}>最近学习记录</div>{events.length ? events.slice(0,4).map(e => <div key={e.id} style={{ display: "flex", gap: 9, padding: "7px 0", borderBottom: "1px solid #f5f5f8" }}><span style={{ color: "#7568e8" }}>•</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 700 }}>{e.name}</div><div style={{ fontSize: 10, color: "#8a8fa3", marginTop: 4 }}>{e.date || "未设置日期"}{e.details ? ` · ${e.details}` : ""}</div></div></div>) : <div className="panel-note">暂无学习日历记录，或尚未配置日历数据源。</div>}</div>
          </div>
        </section>
      </div>

      <section id="modules"><div className="section-heading"><div><h2>🧭 快捷入口</h2><p>沿用你 Notion 学习主页中的 IELTS 模块</p></div></div><div className="module-grid">{modules.map(m => <div className="module-card" key={m.name}><div className="module-head"><span>{m.icon}</span><span>{m.name}</span></div><p>{m.hint}</p><div className="progress-line"><span style={{ width: "12%", background: m.color }}/></div></div>)}</div></section>
      <div className="section-heading"><div><h2>🌿 学习提醒</h2><p>专注今天能完成的事情，不必一次做到完美</p></div></div><div className="quick-links"><a className="quick-link" href="https://www.notion.so/13afa98cfb3183a1a757013fe6b3a7ac" target="_blank" rel="noreferrer">🎧 听力练习 ↗</a><a className="quick-link" href="https://www.notion.so/8f8fa98cfb31836f8c79017966f83ef5" target="_blank" rel="noreferrer">📖 阅读训练 ↗</a><a className="quick-link" href="https://www.notion.so/e28fa98cfb3182df9303017ed122d5c8" target="_blank" rel="noreferrer">✍️ 写作提升 ↗</a><a className="quick-link" href="https://www.notion.so/c2ffa98cfb31833b9d0a0141c90a1e38" target="_blank" rel="noreferrer">🗣️ 口语准备 ↗</a><a className="quick-link" href="https://www.notion.so/02cfa98cfb3183c58ad881ae2222ff01" target="_blank" rel="noreferrer">📅 学习计划 ↗</a><a className="quick-link" href="https://www.notion.so/840fa98cfb3183cb8389014d7aab7949" target="_blank" rel="noreferrer">📓 错题本 ↗</a></div>
      <footer className="footer-note">MADE FOR YOUR DAILY PROGRESS · 数据由 Notion 提供</footer>
    </main>
  </div>;
}

function Stat({ icon, color, bg, label, value, foot }: { icon: string; color: string; bg: string; label: string; value: string | number; foot: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon" style={{ color, background: bg }}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>;
}