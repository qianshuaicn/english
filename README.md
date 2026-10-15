# IELTS Study Dashboard

A Next.js dashboard based on the supplied Notion export. It reflects the current fields:

- Study board: `Task`, `Status`, `总进度`, `当日学时`, `总学时`, `Due`, `Module`
- Study calendar: `event`, `Date`, `Detailed records`

The UI includes daily tasks, status filters, completion statistics, a monthly calendar, study-time summary, and a Notion notes section that reads the linked IELTS module pages from the exported Notion homepage. The website does not include a create-task feature; tasks can be managed directly in Notion. The app calls Notion only from server-side Route Handlers; the API key is never exposed to browser code.

## 1. Configure Notion

1. Create an internal integration: <https://www.notion.so/profile/integrations>
2. Give the integration access to both the `学习看板` and `学习日历` databases.
3. Find the **data source IDs** for both databases. Exported filenames contain IDs that may be database IDs, not the data source IDs required by the current API. Do not assume they are interchangeable.
4. Copy `.env.example` to `.env.local` and fill in the values.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>.

## 2. Notion property types

The code detects the `Status` property type (`status` or `select`) before writing. The following property names must match exactly:

### 学习看板
- `Task`: title
- `Status`: status or select
- `总进度`: number (optional for creating tasks)
- `当日学时`: number (optional)
- `总学时`: number (optional)
- `Due`: date (optional)
- `Module`: select (optional)

### 学习日历
- `event`: title
- `Date`: date
- `Detailed records`: rich text

If a property in your actual Notion schema uses a different name or type, update `src/lib/notion.ts` to match it. A CSV export does not preserve every Notion property type.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import the repository at <https://vercel.com/new>.
3. In Vercel → Project → Settings → Environment Variables, set:
   - `NOTION_API_KEY`
   - `NOTION_STUDY_DATA_SOURCE_ID`
   - `NOTION_CALENDAR_DATA_SOURCE_ID`
   - `NOTION_API_VERSION` (optional; default `2025-09-03`)
4. Redeploy after adding environment variables.

## Security and current limitations

- Never put the Notion token in a `NEXT_PUBLIC_` variable or in client-side code.
- This is a personal dashboard starter, not a multi-user secured application. Before exposing it publicly, add authentication/rate limiting (or protect the Vercel deployment).
- Notion is rate limited; the API calls are server-side and return an error message if Notion rejects a request.
- The “mark done” control updates the Notion `Status` property. The dashboard reads page-body content from the linked IELTS module pages listed in `src/lib/notion.ts`. Make sure the `english` integration has access to each note page (and relevant child pages/databases). If the database's status options are not named `已完成` and `进行中`, change `src/app/api/tasks/[id]/route.ts`.
- `总进度` is displayed when available; this starter does not automatically derive task progress from subtasks.


## 任务跳转到 Notion

任务清单中的任务名称可点击打开对应 Notion 页面。「音标」任务使用用户提供的 Notion 深链接；其他任务默认使用学习看板数据库行返回的 `url`。如需为其他任务指定独立子页面，请在 `src/components/Dashboard.tsx` 的 `getTaskNotionUrl` 函数中添加对应名称与链接映射。页面不再单独显示笔记正文区域。
