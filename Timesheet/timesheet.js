/* global useDataStorage, useObsidianApp, useCallback, useState, Obsidian, Notice, LucideIcon */

function App() {
  const app = useObsidianApp();
  const { getData } = useDataStorage();

  // ===== Settings =====
  const s = (getData() || {}).settings || {};
  const tag = s.tag || "timesheet";
  const folder = s.folder || "10 Projects/Timesheets";
  const limitToFolder = Boolean(s.limitToFolder ?? false);
  const dateProp = s.dateProp || "date";
  const startProp = s.startProp || "Start Time";
  const finishProp = s.finishProp || "Finish Time";
  const durationProp = s.durationProp || "duration";
  const targetHours = Number(s.targetHours || 10);
  const minHoursForHit = Number(s.minHoursForHit || 1);
  const filenamePattern = s.filenamePattern || "Timesheet - ${date}.md";
  const templateFilePath = s.templateFilePath || "50 System/Templates/timelog-template";
  const defaultStart = s.defaultStart || "07:00";
  const defaultFinish = s.defaultFinish || "17:00";
  const showDayNumbers = Boolean(s.showDayNumbers ?? true);
  // ===== Review rule settings =====
  const requireNoOverlap = Boolean(s.requireNoOverlap ?? true);
  const reviewMinHours = Number(s.reviewMinHours ?? 8);
  const reviewMaxHours = Number(s.reviewMaxHours ?? 12);
  const allowedHoursRange = s.allowedHoursRange || "06:00-22:00";
  const requireAddress = Boolean(s.requireAddress ?? false);
  const reviewProp = s.reviewProp || "review_status";

  // ===== utils ===== (Moved here, before any usage and return)
  function todayYMD() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function shiftYM(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function timeOptions(step) {
    const opts = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += step) {
        opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return opts;
  }
  function ymdStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function monthNameShort(m) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[m];
  }
  function startOfWeek(d, firstDay = 0) {
    const day = d.getDay();
    const diff = (day < firstDay ? 7 : 0) + day - firstDay;
    const s = new Date(d);
    s.setDate(d.getDate() - diff);
    return s;
  }
  function endOfWeek(d, firstDay = 0) {
    const s = startOfWeek(d, firstDay);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return e;
  }
  function parseDateOnly(str) {
    if (!str) return null;
    const m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(m[1], m[2] - 1, m[3]);
    return null;
  }
  function parseDateTime(str) {
    if (!str) return null;
    const m = str.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) return new Date(m[1], m[2] - 1, m[3], m[4], m[5]);
    return null;
  }
  function toNum(str) {
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function normalizeTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = timeStr.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
  }
  function toHHMM(str) {
    const dt = parseDateTime(str);
    if (!dt) return '';
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  }
  function hhmmToMinutes(hhmm){
    if (!hhmm || !/\d{2}:\d{2}/.test(hhmm)) return null;
    const [h,m] = hhmm.split(":").map(Number);
    return h*60+m;
  }
  function parseAllowedRange(rangeStr){
    const m = String(rangeStr||"").match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
    if (!m) return null;
    return { min: hhmmToMinutes(m[1]), max: hhmmToMinutes(m[2]) };
  }
  function fmtDT(dt) {
    return `${ymdStr(dt)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:00`;
  }
  function notice(msg) {
    new Obsidian.Notice(msg);
  }
  async function getFMByPath(path) {
    const f = app.vault.getAbstractFileByPath(path);
    const cache = app.metadataCache.getFileCache(f);
    return cache ? cache.frontmatter || {} : {};
  }
  async function findDailyPathByDate(ymd) {
    const files = app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folder));
    for (const f of files) {
      const fm = app.metadataCache.getFileCache(f)?.frontmatter || {};
      if (parseDateOnly(fm[dateProp]) && ymdStr(parseDateOnly(fm[dateProp])) === ymd) {
        return f.path;
      }
    }
    return null;
  }
  async function writeToVault(app, path, content) {
    let f = app.vault.getAbstractFileByPath(path);
    if (!f) {
      f = await app.vault.create(path, content);
    } else {
      await app.vault.modify(f, content);
    }
  }
  function defaultDailyContent(ymd, tag) {
    return `---\ntags: [${tag}]\ndate: ${ymd}\n---\n`;
  }
  function matchTimesheet(fm, tag){
    const tags = fm.tags ?? fm.tag ?? [];
    const list = Array.isArray(tags) ? tags.map(String) : String(tags||"").split(/[,\s]+/).filter(Boolean);
    return list.includes(tag) || String(fm.type||"").toLowerCase()==="timesheet";
  }
  function hasOverlap(entries){ if (!entries || entries.length<2) return false; const a=entries.slice().sort((x,y)=>x.st-y.st); for(let i=1;i<a.length;i++) if(a[i].st<a[i-1].ft) return true; return false; }
  function durationHours(st, ft){ let ms = ft - st; if (ms < 0) ms += 24*3600000; return ms/3600000; }

  async function readFMTags(app, path){
    try{
      const file = app.vault.getAbstractFileByPath(path);
      const raw = await app.vault.read(file);
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?/); if (!m) return [];
      const line = m[1].split(/\r?\n/).find(l=>/^tags\s*:/.test(l.trim())); if (!line) return [];
      const v = line.split(":")[1] || ""; const arr = v.includes("[") ? v.replace(/[\[\]]/g,"").split(",") : v.split(",");
      return arr.map(x=>x.trim()).filter(Boolean);
    } catch { return []; }
  }
  function addTimesheetTag(cur, tag){ const set=new Set(cur||[]); set.add(tag); return `[${Array.from(set).join(", ")}]`; }

  async function ensureDailyFile(app, ymd, cfg){
    const hit = app.vault.getMarkdownFiles().find(f=>{
      if (cfg.folder && !f.path.startsWith(cfg.folder)) return false;
      const fm = app.metadataCache.getFileCache(f)?.frontmatter || {};
      if (!matchTimesheet(fm, cfg.tag)) return false;
      const d = parseDateOnly(fm[dateProp]); return d && ymdStr(d)===ymd;
    });
    if (hit) return hit.path;

    const fname = String(cfg.filenamePattern).replace(/\$\{date\}/g, ymd);
    const dest = `${cfg.folder}/${fname}`;
    try {
      const tpl = app.vault.getAbstractFileByPath(cfg.templateFilePath);
      const tplContent = await app.vault.read(tpl);
      const filled = tplContent.replace(/\$\{date\}/g, ymd);
      await writeToVault(app, dest, filled);
    } catch {
      await writeToVault(app, dest, defaultDailyContent(ymd, cfg.tag));
    }
    return dest;
  }

  async function ensureFrontmatter(app, fileOrPath, patch){
    const file = typeof fileOrPath === "string" ? app.vault.getAbstractFileByPath(fileOrPath) : fileOrPath;
    const raw = await app.vault.read(file);
    const updated = upsertFrontmatter(raw, patch);
    if (updated !== raw) await app.vault.modify(file, updated);
  }
  function upsertFrontmatter(text, kv){
    const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) {
      const lines = Object.entries(kv).map(([k,v]) => `${k}: ${v}`);
      return `---\n${lines.join("\n")}\n---\n` + text;
    }
    const head = m[1].split(/\r?\n/);
    const keysLower = Object.keys(kv).map(k=>k.toLowerCase());
    const out = head.map(ln=>{
      const k = ln.split(":")[0]?.trim().toLowerCase();
      if (keysLower.includes(k)) {
        const trueKey = Object.keys(kv).find(K=>K.toLowerCase()===k);
        return `${trueKey}: ${kv[trueKey]}`;
      }
      return ln;
    });
    // Add new keys if not present
    Object.entries(kv).forEach(([key, val]) => {
      if (!head.some(ln => ln.split(":")[0]?.trim().toLowerCase() === key.toLowerCase())) {
        out.push(`${key}: ${val}`);
      }
    });
    return text.replace(m[0], `---\n${out.join("\n")}\n---\n`);
  }
  async function ensureFolder(app, path) {
    const parts = path.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += (current ? '/' : '') + part;
      const f = app.vault.getAbstractFileByPath(current);
      if (!f) {
        await app.vault.createFolder(current);
      } else if (!Array.isArray(f.children)) {
        throw new Error(`Path ${current} is not a folder`);
      }
    }
  }
  // ===== State =====
  const [month, setMonth] = useState(todayYMD().slice(0,7)); // YYYY-MM
  const [range, setRange] = useState({ start: null, end: null });
  const [byDay, setByDay] = useState({});
  const [weekTimes, setWeekTimes] = useState(0);
  const [monthTimes, setMonthTimes] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [qa, setQA] = useState({ date: todayYMD(), start: defaultStart, finish: defaultFinish, duration:"", address:"" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReview, setShowReview] = useState(false);

  // 下拉时间选项（30 分钟步长）
  const timeOpts = useMemo(()=>timeOptions(30), []);

  // ===== 计算当月数据 =====
  const compute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [Y, M] = month.split("-").map(Number);
      const start = new Date(Y, M-1, 1);
      const end   = new Date(Y, M,   0);
      setRange({ start, end });

      const files = app.vault.getMarkdownFiles().filter(f => !limitToFolder || f.path.startsWith(folder));
      const tmp = {};
      let monTotal = 0;
      for (const f of files) {
        const fm = app.metadataCache.getFileCache(f)?.frontmatter || {};
        if (!matchTimesheet(fm, tag)) continue;
        const d = parseDateOnly(fm[dateProp]); if (!d || d < start || d > end) continue;

        const ymd = ymdStr(d);
        const st = parseDateTime(fm[startProp]);
        const ft = parseDateTime(fm[finishProp]);
        let dur  = toNum(fm[durationProp]);
        const calcDur = (st && ft) ? durationHours(st, ft) : (isFinite(dur) ? dur : 0);

        if (st && ft && (!isFinite(dur) || Math.abs(calcDur - dur) > 0.01)) {
          await ensureFrontmatter(app, f, { [durationProp]: round2(calcDur) });
        }

        (tmp[ymd] ||= { total: 0, entries: [], paths: [], details: [] });
        tmp[ymd].total += calcDur;
        monTotal += calcDur;
        if (st && ft) tmp[ymd].entries.push({ st, ft });
        tmp[ymd].paths.push(f.path);
        tmp[ymd].details.push({
          start: toHHMM(fm[startProp] || ''),
          finish: toHHMM(fm[finishProp] || ''),
          duration: round2(calcDur),
          address: fm.Address || fm.address || '',
          path: f.path
        });
      }

      const idx = {};
      const rangeAllowed = parseAllowedRange(allowedHoursRange);
      Object.keys(tmp).forEach(ymd=>{
        const d = tmp[ymd];
        const rec = { hours: round2(d.total), conflicts: hasOverlap(d.entries), paths: d.paths, details: d.details };

        // Evaluate review violations
        const issues = [];
        if (requireNoOverlap && rec.conflicts) issues.push("overlap");
        if (isFinite(reviewMinHours) && rec.hours < reviewMinHours) issues.push("below-min-hours");
        if (isFinite(reviewMaxHours) && rec.hours > reviewMaxHours) issues.push("above-max-hours");
        let missingAddr = false, timeOutOfRange = false, missingStartOrFinish = false;
        for (const det of rec.details) {
          if (requireAddress && !String(det.address||"").trim()) missingAddr = true;
          if (!det.start || !det.finish) missingStartOrFinish = true;
          if (rangeAllowed) {
            const stMin = hhmmToMinutes(det.start);
            const ftMin = hhmmToMinutes(det.finish);
            if ((stMin!=null && stMin < rangeAllowed.min) || (ftMin!=null && ftMin > rangeAllowed.max)) {
              timeOutOfRange = true;
            }
          }
        }
        if (missingAddr) issues.push("missing-address");
        if (missingStartOrFinish) issues.push("missing-start-or-finish");
        if (timeOutOfRange) issues.push("time-out-of-range");

        rec.violations = issues;
        idx[ymd] = rec;
      });
      setByDay(idx);
      setMonthTotal(round2(monTotal));

      // counters
      const thisWeekS = startOfWeek(new Date(),1), thisWeekE = endOfWeek(new Date(),1);
      let wk = 0, mon = 0;
      for (let d=new Date(thisWeekS); d<=thisWeekE; d.setDate(d.getDate()+1)) {
        if ((idx[ymdStr(d)]?.hours || 0) >= minHoursForHit) wk++;
      }
      for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
        if ((idx[ymdStr(d)]?.hours || 0) >= minHoursForHit) mon++;
      }
      setWeekTimes(wk); setMonthTimes(mon);
    } catch (e) {
      setError(e.message || 'Error loading data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [app, month, tag, folder, limitToFolder, dateProp, startProp, finishProp, durationProp, minHoursForHit]);

  useEffect(()=>{ compute(); }, [compute]);

  // ===== 仅保留“本月内有日期”的周 =====
  const cal = useMemo(()=>{
    const [Y, M] = month.split("-").map(Number);
    const start = new Date(Y, M-1, 1);
    const end   = new Date(Y, M,   0);

    const firstCell = startOfWeek(start, 1);
    const lastCell  = endOfWeek(end,   1);

    const allRows = [];
    for (let d = new Date(firstCell); d <= lastCell; d.setDate(d.getDate()+7)) {
      const row = [];
      for (let c=0;c<7;c++){
        const x = new Date(d); x.setDate(d.getDate()+c);
        row.push({ d: x, ymd: ymdStr(x), inMonth: x.getMonth() === start.getMonth(), dayNum: x.getDate() });
      }
      allRows.push(row);
    }
    const rows = allRows.filter(row => row.some(c => c.inMonth));
    const monthWeekIndex = rows.map((_, i) => i+1);
    return { rows, monthWeekIndex, monthName: monthNameShort(M-1) };
  }, [month]);

  // ===== Heatmap colors (pink) =====
  const palette = [
    "#FBF7F8", // 0h
    "#F6EBEF", // <5h
    "#EFD9E1", // <=10h (5-10)
    "#C67C95"  // >10h
  ];
  function colorFor(h){
    const x = Number(h || 0);
    if (x <= 0) return palette[0];
    if (x < 5) return palette[1];
    if (x <= 10) return palette[2];
    return palette[3];
  }

  // ===== Quick Add helpers =====
  function recalcDuration(q){
    const st = normalizeTime(q.date, q.start);
    const ft = normalizeTime(q.date, q.finish);
    if (st && ft) q.duration = String(round2(durationHours(st, ft)));
    return q;
  }
  const onStartChange  = (val) => setQA(prev => recalcDuration({ ...prev, start:  val }));
  const onFinishChange = (val) => setQA(prev => recalcDuration({ ...prev, finish: val }));

  // 点击日格：自动回填当日文件 frontmatter
  const onCellClick = async (ymd) => {
    try {
      let next = {
        date: ymd,
        start: qa.start || defaultStart,
        finish: qa.finish || defaultFinish,
        duration: "",
        address: ""
      };

      // 优先用聚合的路径；没有就限定目录兜底查找
      let path = byDay[ymd]?.paths?.[0];
      if (!path) path = await findDailyPathByDate(ymd);

      if (path){
        const fm = await getFMByPath(path);
        const st = toHHMM(fm[startProp]);
        const ft = toHHMM(fm[finishProp]);
        const du = Number(fm[durationProp]);

        if (st) next.start  = st;
        if (ft) next.finish = ft;
        if (isFinite(du)) next.duration = String(du);
        const addr = fm.Address ?? fm.address ?? "";
        if (addr) next.address = addr;

        if (st && ft) next = recalcDuration(next);
        setQA(next);
        notice(`Loaded ${ymd}`);
      } else {
        next = recalcDuration(next);
        setQA(next);
        notice(`No file for ${ymd}, using defaults.`);
      }
    } catch (e) {
      console.error("[onCellClick error]", e);
      notice(`Click failed: ${e.message || e}`);
    }
  };

  const saveQuickAdd = async (openAfter=false) => {
    setSaving(true);
    try{
      const ymd = qa.date || todayYMD();
      const st = normalizeTime(ymd, qa.start);
      const ft = normalizeTime(ymd, qa.finish);
      const hasSF = Boolean(st && ft);
      const dur = hasSF ? durationHours(st, ft) : toNum(qa.duration);

      const path = await ensureDailyFile(app, ymd, { folder, filenamePattern, templateFilePath, tag });
      const patch = {
        [dateProp]: ymd,
        ...(hasSF ? { [startProp]: fmtDT(st), [finishProp]: fmtDT(ft), [durationProp]: round2(dur||0) }
                  : { [durationProp]: round2(dur||0) }),
        tags: addTimesheetTag(await readFMTags(app, path), tag)
      };
      if (qa.address?.trim()) patch["Address"] = qa.address.trim();
      await ensureFrontmatter(app, app.vault.getAbstractFileByPath(path), patch);

      if (openAfter) app.workspace.openLinkText(path, "", false);
      setQA(x=>({ ...x, start: defaultStart, finish: defaultFinish, duration:"", address: "" }));

      // Add delay to allow metadataCache to update
      await new Promise(resolve => setTimeout(resolve, 300));

      await compute();
      notice("Saved.");
    }catch(e){ console.error(e); notice("Save failed."); }
    finally{ setSaving(false); }
  };

  // New: Delete entry for a day
  const deleteDayEntry = async (ymd) => {
    if (!confirm(`Delete entry for ${ymd}?`)) return;
    try {
      const path = byDay[ymd]?.paths?.[0];
      if (path) {
        await app.vault.delete(app.vault.getAbstractFileByPath(path));
        await compute();
        notice(`Deleted ${ymd}`);
      }
    } catch (e) {
      notice('Delete failed');
    }
  };

  // ===== Export / Report =====
  const exportCSV = async () => {
    if (!range.start) return;
    try {
      await ensureFolder(app, `${folder}/Exports`);
      const rows = [["Date","Start","Finish","Duration","Address","Conflict","File"]];
      for (let d=new Date(range.start); d<=range.end; d.setDate(d.getDate()+1)) {
        const y = ymdStr(d);
        const rec = byDay[y] || {details: [], conflicts: false};
        if (rec.details.length === 0) {
          rows.push([y, "", "", "0", "", "", ""]);
        } else {
          for (const det of rec.details) {
            rows.push([y, det.start, det.finish, String(det.duration), det.address, rec.conflicts ? "YES" : "", det.path]);
          }
        }
      }
      const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
      const fname = `Timesheet-Month-${month}.csv`;
      await writeToVault(app, `${folder}/Exports/${fname}`, csv);
      notice(`CSV exported → ${folder}/Exports/${fname}`);
    } catch (e) {
      console.error("CSV export error:", e);
      notice(`CSV export failed: ${e.message || 'Unknown error'}`);
    }
  };
  
  // ===== Review actions =====
  const openDayFile = async (ymd) => {
    const path = byDay[ymd]?.paths?.[0];
    if (path) app.workspace.openLinkText(path, "", false);
  };
  const setReviewStatus = async (ymd, status) => {
    try {
      const rec = byDay[ymd];
      if (!rec || !rec.paths || rec.paths.length===0) return notice("No file for "+ymd);
      for (const p of rec.paths) {
        await ensureFrontmatter(app, app.vault.getAbstractFileByPath(p), { [reviewProp]: status });
      }
      // small delay for metadata cache refresh
      await new Promise(r=>setTimeout(r, 200));
      await compute();
      notice(`Marked ${ymd}: ${status}`);
    } catch (e) { console.error(e); notice("Set review failed"); }
  };

  const generateReviewReport = async () => {
    if (!range.start) return;
    try {
      await ensureFolder(app, `${folder}/Reports`);
      // collect violations only
      const rows = [];
      let totalDays = 0;
      let violatedDays = 0;
      for (let d=new Date(range.start); d<=range.end; d.setDate(d.getDate()+1)) {
        const y = ymdStr(d);
        const rec = byDay[y];
        if (!rec) continue;
        totalDays++;
        const issues = (rec.violations||[]);
        if (issues.length>0) {
          violatedDays++;
          const human = issues.map(k=>({
            "overlap": "Overlap",
            "below-min-hours": `Below min (${reviewMinHours}h)` ,
            "above-max-hours": `Above max (${reviewMaxHours}h)` ,
            "missing-address": "Missing address",
            "missing-start-or-finish": "Missing start/finish",
            "time-out-of-range": `Outside ${allowedHoursRange}`
          }[k] || k)).join(", ");
          const link = rec.paths?.[0] ? `[[${rec.paths[0]}|Open]]` : "";
          rows.push(`| ${y} | ${rec.hours} | ${human} | ${link} |`);
        }
      }
      const tableHead = `| Date | Hours | Issues | File |\n|------|-------|--------|------|`;
      const md = `---\ntype: timesheet-review\nmode: month\nrange: ${month}\nviolated_days: ${violatedDays}\ntotal_days: ${totalDays}\n---\n\n# Timesheet Review - ${month}\n\n- Violated days: ${violatedDays}/${totalDays}\n- Rules: ${requireNoOverlap?"no-overlap; ":""}min>=${reviewMinHours}h; max<=${reviewMaxHours}h; ${requireAddress?"address-required; ":""}${allowedHoursRange?`hours ${allowedHoursRange}`:""}\n\n## Violations\n${tableHead}\n${rows.join("\n")}\n`;
      const fname = `Review - ${month}.md`;
      await writeToVault(app, `${folder}/Reports/${fname}`, md);
      app.workspace.openLinkText(`${folder}/Reports/${fname}`, "", false);
    } catch (e) { console.error(e); notice(`Review report failed: ${e.message||"Unknown error"}`); }
  };
  const generateReport = async () => {
    if (!range.start) return;
    try {
      await ensureFolder(app, `${folder}/Reports`);
      let total=0;
      let tableRows = [];
      for (let d=new Date(range.start); d<=range.end; d.setDate(d.getDate()+1)) {
        const y = ymdStr(d);
        const rec = byDay[y] || {details: [], conflicts: false};
        const conflict = rec.conflicts ? "YES" : "";
        if (rec.details.length === 0) {
          tableRows.push(`| ${y} |  |  | 0 |  | ${conflict} |  |`);
        } else {
          for (const det of rec.details) {
            const link = det.path ? `[[${det.path}|Open]]` : "";
            tableRows.push(`| ${y} | ${det.start} | ${det.finish} | ${det.duration} | ${det.address} | ${conflict} | ${link} |`);
            total += Number(det.duration || 0);
          }
        }
      }
      const table = `| Date | Start | Finish | Duration | Address | Conflict | File |\n|------|-------|--------|----------|---------|----------|------|\n${tableRows.join('\n')}`;
      const md =
`---
type: timesheet-report
mode: month
range: ${month}
total_hours: ${round2(total)}
---

# Timesheet Monthly Report - ${month}

- **This month (days ≥ ${minHoursForHit}h)**: ${monthTimes} times
- **Total hours**: **${round2(total)} h**
- **Target outline**: ≥ ${targetHours} h/day

## Daily
${table}
`;
      const fname = `Monthly - ${month}.md`;
      await writeToVault(app, `${folder}/Reports/${fname}`, md);
      app.workspace.openLinkText(`${folder}/Reports/${fname}`, "", false);
    } catch (e) {
      console.error("Report generation error:", e);
      notice(`Report generation failed: ${e.message || 'Unknown error'}`);
    }
  };

  // ===== Render =====
  if (error) return <div className="ts-error">Error: {error} <button onClick={compute}>Retry</button></div>;

  return (
    <div className="ts-heatmap--Root">
      {/* Toolbar 一行紧凑均匀布局，字体缩小，间距更紧凑，与address行宽一致 */}
      <div className="ts-toolbar ts-toolbar--one">
        <div className="ts-toolbar__left">
          <div className="ts-toolbar__title">
            <span className="ts-emoji ts-emoji--sm">📅</span> {cal.monthName} Timesheet
          </div>
          <button className="ts-btn ts-btn--icon" title="Prev Month" onClick={()=>setMonth(shiftYM(month,-1))}><span className="ts-emoji ts-emoji--sm">◀</span></button>
          <input className="ts-month ts-month--compact" type="month" value={month} onChange={(e)=>setMonth(e.target.value)} />
          <button className="ts-btn ts-btn--icon" title="Next Month" onClick={()=>setMonth(shiftYM(month,1))}><span className="ts-emoji ts-emoji--sm">▶</span></button>
          <button className="ts-btn ts-btn--icon" title="This month" onClick={()=>setMonth(todayYMD().slice(0,7))}><span className="ts-emoji ts-emoji--sm">🏠</span></button>
        </div>
        <div className="ts-toolbar__right">
          <button className="ts-btn ts-btn--icon" title="Refresh" disabled={loading} onClick={compute}>
            <span className="ts-emoji ts-emoji--md">🔄</span>
          </button>
          <button className="ts-btn ts-btn--icon" title="Export CSV" onClick={exportCSV}>
            <span className="ts-emoji ts-emoji--md">⬇️</span>
          </button>
          <button className="ts-btn ts-btn--icon ts-btn--primary" title="Generate Report" onClick={generateReport}>
            <span className="ts-emoji ts-emoji--md">📄</span>
          </button>
          <button className="ts-btn ts-btn--icon" title="Toggle Review Panel" onClick={()=>setShowReview(v=>!v)}>
            <span className="ts-emoji ts-emoji--md">🧪</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="ts-counters">
        <span className="pill-soft">Week: <b>{weekTimes}</b> days</span>
        <span className="pill-soft">Month: <b>{monthTimes}</b> days</span>
        <span className="pill-soft">Total: <b>{monthTotal}</b> h</span>
      </div>

      {/* Main layout - Single column */}
      <div className="ts-main-two-col">
        {/* Calendar */}
        <div className="ts-card">
          {loading ? <div className="ts-loading">Loading...</div> : (
            <>
              <div className="calendar-header-grid">
                <span className="month-chip">{cal.monthName}</span>
                <div className="weekday-row">
                  {["M","T","W","T","F","S","S"].map((w,i)=><div key={i} className="weekday-cell">{w}</div>)}
                </div>
              </div>

              <div className="calendar-grid">
                <div className="week-labels">
                  {cal.monthWeekIndex.map((n,i)=><div key={i} className="week-chip">W{n}</div>)}
                </div>

                <div className="calendar-rows">
                  {cal.rows.map((row,ri)=>(
                    <div key={ri} className="row-7">
                      {row.map(cell=>{
                        const rec = byDay[cell.ymd] || {};
                        const v = rec.hours || 0;
                        const outline = v >= targetHours;
                        const has = v >= minHoursForHit;
                        const isToday = cell.ymd === todayYMD();
                        const heatLevel = v <= 0 ? 0 : (v < 5 ? 1 : (v <= 10 ? 2 : 3));
                        const cellClasses = [
                          'day-sq',
                          isToday ? 'day-today' : '',
                          `bg-lvl-${heatLevel}`,
                          rec.conflicts ? 'day-conflict' : (outline ? 'day-outline' : ''),
                          cell.inMonth ? (has ? '' : 'day-dim') : 'day-outmonth'
                        ].filter(Boolean).join(' ');
                        return (
                          <div
                            key={cell.ymd}
                            title={`${cell.ymd} · ${round2(v)}h${rec.conflicts ? ' (overlap)' : ''}${isToday ? ' (Today)' : ''}`}
                            onClick={()=>onCellClick(cell.ymd)}
                            onContextMenu={(e) => { e.preventDefault(); if (v > 0) deleteDayEntry(cell.ymd); }}
                            className={cellClasses}
                          >
                            <div className="day-num">{showDayNumbers ? cell.dayNum : ''}</div>
                            <div className="day-hours">{v > 0 ? round2(v) : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend 移到 calendar 内部 */}
              <div className="ts-legend">
                <div className="legend-item legend-0">0h</div>
                <div className="legend-item legend-1">&lt;5h</div>
                <div className="legend-item legend-2">&lt;=10h</div>
                <div className="legend-item legend-3">&gt;10h</div>
                <div className="legend-item legend-conflict">Overlap ⚠️</div>
              </div>
            </>
          )}
        </div>

        {/* Review Panel */}
        {showReview && (
          <div className="ts-card ts-review">
            <div className="ts-review__header">
              <div className="ts-review__title"><span className="ts-emoji ts-emoji--md ts-emoji--mr">🧪</span> Review</div>
              <div className="ts-review__actions">
                <button className="ts-btn" onClick={generateReviewReport}><span className="ts-emoji ts-emoji--sm ts-emoji--mr">📝</span> Review Report</button>
              </div>
            </div>
            <div className="ts-review__body">
              {Object.keys(byDay).filter(ymd=> (byDay[ymd]?.violations||[]).length>0).sort().map(ymd=>{
                const rec = byDay[ymd];
                const issues = rec.violations||[];
                const labelMap = {
                  "overlap": "Overlap",
                  "below-min-hours": `Below min (${reviewMinHours}h)`,
                  "above-max-hours": `Above max (${reviewMaxHours}h)`,
                  "missing-address": "Missing address",
                  "missing-start-or-finish": "Missing start/finish",
                  "time-out-of-range": `Outside ${allowedHoursRange}`
                };
                return (
                  <div key={ymd} className="ts-review__row">
                    <div className="ts-review__date">{ymd}</div>
                    <div className="ts-review__hours">{rec.hours}h</div>
                    <div className="ts-review__issues">
                      {issues.map((k,i)=> <span key={i} className="ts-tag ts-tag--warn">{labelMap[k] || k}</span>)}
                    </div>
                    <div className="ts-review__ops">
                      <button className="ts-btn" onClick={()=>openDayFile(ymd)}><span className="ts-emoji ts-emoji--sm ts-emoji--mr">🔗</span>Open</button>
                      <button className="ts-btn" onClick={()=>setReviewStatus(ymd, 'approved')}><span className="ts-emoji ts-emoji--sm ts-emoji--mr">✅</span>Approve</button>
                      <button className="ts-btn" onClick={()=>setReviewStatus(ymd, 'rejected')}><span className="ts-emoji ts-emoji--sm ts-emoji--mr">⛔</span>Reject</button>
                    </div>
                  </div>
                );
              })}
              {Object.keys(byDay).every(ymd => (byDay[ymd]?.violations||[]).length===0) && (
                <div className="ts-review__empty">No issues found for this month.</div>
              )}
            </div>
          </div>
        )}

        {/* Quick Add */}
        <div className="ts-card qa-sticky">
          <div className="ts-qa-form">
            <div className="qa-title"><span className="ts-emoji ts-emoji--md ts-emoji--mr">➕</span> Quick Add</div>
            <div className="ts-qa-fields">
              <div className="qa-field qa-field--full">
                <label>Date</label>
                <input type="date" value={qa.date} onChange={(e)=>setQA({...qa, date:e.target.value})} className="qa-input" />
              </div>
              <div className="qa-row-fields-group">
                <div className="qa-field">
                  <label>Start</label>
                  <select value={qa.start} onChange={(e)=>onStartChange(e.target.value)} className="qa-input">
                    {timeOpts.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="qa-field">
                  <label>Finish</label>
                  <select value={qa.finish} onChange={(e)=>onFinishChange(e.target.value)} className="qa-input">
                    {timeOpts.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="qa-field">
                  <label>Duration (h)</label>
                  <input placeholder="e.g. 2.5" value={qa.duration} onChange={(e)=>setQA({...qa, duration:e.target.value})} className="qa-input" />
                </div>
              </div>
              <div className="qa-field qa-field--full">
                <label>Address</label>
                <input value={qa.address} onChange={(e)=>setQA({...qa, address:e.target.value})} className="qa-input" />
              </div>
            </div>
            <div className="ts-qa-actions">
              <button className="ts-btn" disabled={saving || loading} onClick={()=>saveQuickAdd(false)}><span className="ts-emoji ts-emoji--sm ts-emoji--mr">💾</span> Save</button>
              <button className="ts-btn ts-btn--primary" disabled={saving || loading} onClick={()=>saveQuickAdd(true)}><span className="ts-emoji ts-emoji--sm ts-emoji--mr">✏️</span> Save & Open</button>
              <div className="qa-tip">Tip: Click a day to load/edit. Right-click to delete.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
