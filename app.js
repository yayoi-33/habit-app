/* -------------------------
  Challenge: sheets (max5)
   - visible tabs list + hidden tabs list
   - "管理"で非表示タブを復元
   - ×のとき：非表示 or 完全削除を選択
  Diary:
   - monthly calendar -> tap day -> modal editor
   - image attachment
   - thumbnail -> full screen viewer
   - download link
  Remove extra explanations: helpText stays blank
-------------------------- */

const DAYS = 30;
const MAX_SHEETS = 5;

// challenge storage
const VISIBLE_KEY = "sheet_visible_v1";
const HIDDEN_KEY  = "sheet_hidden_v1";
const ACTIVE_KEY  = "sheet_active_v4";
const SHEET_KEY_PREFIX = "sheet_v8_";

// diary storage
const DIARY_PREFIX = "diary_v3_";

const $ = (id) => document.getElementById(id);

function pad2(n){ return String(n).padStart(2,"0"); }
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function sheetKey(id){ return SHEET_KEY_PREFIX + id; }
function diaryKey(dateISO){ return DIARY_PREFIX + dateISO; }

function clampInt(v,min,max,fallback){
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.round(n);
  return Math.max(min, Math.min(max, i));
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

/* ---------- Challenge data ---------- */

function defaultSheetState(){
  return {
    title: "30日チャレンジ",
    targets: Array.from({length:DAYS},()=> ""),
    done: Array.from({length:DAYS},()=> false),
    bgColor: "#ffffff",
  };
}
function loadSheetState(id){
  const raw = localStorage.getItem(sheetKey(id));
  if (!raw) return defaultSheetState();
  try{
    const p = JSON.parse(raw);
    const st = defaultSheetState();
    st.title = (typeof p.title === "string" && p.title.trim()) ? p.title : st.title;
    if (Array.isArray(p.targets)) for (let i=0;i<DAYS;i++) st.targets[i] = p.targets[i] ?? "";
    if (Array.isArray(p.done))    for (let i=0;i<DAYS;i++) st.done[i] = !!p.done[i];
    st.bgColor = typeof p.bgColor === "string" ? p.bgColor : st.bgColor;
    return st;
  }catch{
    return defaultSheetState();
  }
}
function saveSheetState(silent=false){
  sheetState.title = ($("challengeTitle").value || "").trim() || "30日チャレンジ";
  localStorage.setItem(sheetKey(activeSheetId), JSON.stringify(sheetState));
  renderSheetTabs();
  applySheetBg();
  if (!silent) alert("保存しました");
}

/* ---------- Visible/Hidden lists ---------- */

function loadList(key, fallback){
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try{
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : fallback;
  }catch{
    return fallback;
  }
}
function saveList(key, arr){
  localStorage.setItem(key, JSON.stringify(arr));
}
function allIds(){
  return Array.from({length:MAX_SHEETS}, (_,i)=> `s${i+1}`);
}
function newSheetId(visible, hidden){
  const used = new Set([...visible, ...hidden]);
  for (const id of allIds()){
    if (!used.has(id)) return id;
  }
  return null;
}

function getTabTitle(id){
  const st = loadSheetState(id);
  return (st.title || "").trim() || "30日チャレンジ";
}
function shorten(text,n){
  const t = (text||"").trim();
  if (!t) return "";
  return t.length<=n ? t : t.slice(0,n) + "…";
}

/* ---------- Render tabs ---------- */

function renderSheetTabs(){
  const host = $("sheetTabsHost");
  host.innerHTML = "";

  const row = document.createElement("div");
  row.className = "tabs";

  visibleTabs.forEach((id) => {
    const title = getTabTitle(id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (id===activeSheetId ? " active" : "");
    btn.title = title;

    const label = document.createElement("span");
    label.textContent = shorten(title, 10) || "（無題）";

    const x = document.createElement("button");
    x.type = "button";
    x.className = "xBtn";
    x.textContent = "×";
    x.addEventListener("click",(e)=>{
      e.stopPropagation();
      askRemoveMode(id);
    });

    btn.addEventListener("click",()=> switchSheet(id));

    btn.appendChild(label);
    btn.appendChild(x);
    row.appendChild(btn);
  });

  const addBtn = document.createElement("button");
  addBtn.type="button";
  addBtn.className="tab";
  addBtn.textContent="＋ 追加";
  addBtn.addEventListener("click", addSheetTab);
  row.appendChild(addBtn);

  const manageBtn = document.createElement("button");
  manageBtn.type="button";
  manageBtn.className="tab";
  manageBtn.textContent="管理";
  manageBtn.addEventListener("click", openTabManager);
  row.appendChild(manageBtn);

  host.appendChild(row);
}

function addSheetTab(){
  const totalUsed = visibleTabs.length + hiddenTabs.length;
  if (totalUsed >= MAX_SHEETS){
    alert("これ以上追加できません（最大5つ）");
    return;
  }
  const id = newSheetId(visibleTabs, hiddenTabs);
  if (!id) return;

  const t = prompt("タイトル", "");
  const st = defaultSheetState();
  if (t && t.trim()) st.title = t.trim();
  localStorage.setItem(sheetKey(id), JSON.stringify(st));

  visibleTabs = [...visibleTabs, id];
  saveList(VISIBLE_KEY, visibleTabs);

  activeSheetId = id;
  localStorage.setItem(ACTIVE_KEY, activeSheetId);
  sheetState = loadSheetState(activeSheetId);

  renderSheetTabs();
  renderSheet();
  applySheetBg();
  syncBgControls();
}

/* ×時の動作選択 */
function askRemoveMode(id){
  if (visibleTabs.length === 1){
    alert("最後の1つは消せません");
    return;
  }
  const choice = prompt(
    "どうする？\n1 = 非表示（あとで復元できる）\n2 = 完全削除（データも消える）",
    "1"
  );
  if (choice === null) return;

  if (choice.trim()==="1") return hideSheet(id);
  if (choice.trim()==="2") return deleteSheet(id);

  alert("1か2を入力してね");
}

function hideSheet(id){
  if (!visibleTabs.includes(id)) return;

  visibleTabs = visibleTabs.filter(x => x !== id);
  hiddenTabs  = [...hiddenTabs, id];

  saveList(VISIBLE_KEY, visibleTabs);
  saveList(HIDDEN_KEY, hiddenTabs);

  if (activeSheetId === id){
    activeSheetId = visibleTabs[0];
    localStorage.setItem(ACTIVE_KEY, activeSheetId);
    sheetState = loadSheetState(activeSheetId);
    renderSheet();
    applySheetBg();
    syncBgControls();
  }
  renderSheetTabs();
}

function deleteSheet(id){
  if (!visibleTabs.includes(id)) return;
  if (visibleTabs.length === 1){
    alert("最後の1つは消せません");
    return;
  }

  visibleTabs = visibleTabs.filter(x => x !== id);
  saveList(VISIBLE_KEY, visibleTabs);

  // データ完全削除
  localStorage.removeItem(sheetKey(id));
  // hiddenに入ってたら消す（念のため）
  hiddenTabs = hiddenTabs.filter(x => x !== id);
  saveList(HIDDEN_KEY, hiddenTabs);

  if (activeSheetId === id){
    activeSheetId = visibleTabs[0];
    localStorage.setItem(ACTIVE_KEY, activeSheetId);
    sheetState = loadSheetState(activeSheetId);
    renderSheet();
    applySheetBg();
    syncBgControls();
  }
  renderSheetTabs();
}

function switchSheet(id){
  activeSheetId = id;
  localStorage.setItem(ACTIVE_KEY, activeSheetId);
  sheetState = loadSheetState(activeSheetId);

  $("challengeTitle").value = sheetState.title;
  renderSheetTabs();
  renderSheet();
  applySheetBg();
  syncBgControls();
}

/* ---------- Tab manager ---------- */

function openTabManager(){
  renderHiddenTabsList();
  showModal("tabModal", true);
}
function renderHiddenTabsList(){
  const box = $("hiddenTabsList");
  box.innerHTML = "";

  if (hiddenTabs.length === 0){
    const empty = document.createElement("div");
    empty.className = "small";
    empty.textContent = "（なし）";
    box.appendChild(empty);
    return;
  }

  hiddenTabs.forEach((id)=>{
    const title = getTabTitle(id);

    const item = document.createElement("div");
    item.className = "listItem";

    const left = document.createElement("div");
    left.className = "listTitle";
    left.textContent = title;

    const btns = document.createElement("div");
    btns.className = "listBtns";

    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "btn btnGhost";
    restore.textContent = "復元";
    restore.addEventListener("click", ()=> restoreSheet(id));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btnGhost";
    del.textContent = "削除";
    del.addEventListener("click", ()=> {
      if (!confirm("完全削除する？（データも消える）")) return;
      localStorage.removeItem(sheetKey(id));
      hiddenTabs = hiddenTabs.filter(x=> x!==id);
      saveList(HIDDEN_KEY, hiddenTabs);
      renderHiddenTabsList();
      renderSheetTabs();
    });

    btns.appendChild(restore);
    btns.appendChild(del);

    item.appendChild(left);
    item.appendChild(btns);
    box.appendChild(item);
  });
}

function restoreSheet(id){
  if (visibleTabs.length >= MAX_SHEETS){
    alert("表示できるのは最大5つです");
    return;
  }
  hiddenTabs = hiddenTabs.filter(x => x !== id);
  visibleTabs = [...visibleTabs, id];
  saveList(HIDDEN_KEY, hiddenTabs);
  saveList(VISIBLE_KEY, visibleTabs);

  renderHiddenTabsList();
  renderSheetTabs();
}

/* ---------- Challenge grid ---------- */

function renderSheet(){
  $("challengeTitle").value = sheetState.title;

  const grid = $("grid");
  grid.innerHTML = "";

  for (let i=0;i<DAYS;i++){
    const dayNo = i+1;
    const cell = document.createElement("div");
    cell.className = "cell" + (sheetState.done[i] ? " done" : "");

    const targetText = (sheetState.targets[i] || "").trim();
    const targetClass = targetText ? "target" : "target muted";

    cell.innerHTML = `
      <div class="day">
        <div class="dayNum">DAY ${dayNo}</div>
        <button class="editBtn" type="button" data-edit="${i}">編集</button>
      </div>
      <div class="${targetClass}" id="t_${i}">${escapeHtml(targetText || "（未設定）")}</div>
      <div class="stamp">DONE</div>
    `;

    cell.addEventListener("click",(e)=>{
      if (e.target.closest("button")) return;
      sheetState.done[i] = !sheetState.done[i];
      cell.classList.toggle("done", sheetState.done[i]);
      localStorage.setItem(sheetKey(activeSheetId), JSON.stringify(sheetState));
    });

    grid.appendChild(cell);
  }

  grid.querySelectorAll("[data-edit]").forEach((btn)=>{
    btn.addEventListener("click",(e)=>{
      e.stopPropagation();
      const idx = Number(btn.dataset.edit);
      const current = sheetState.targets[idx] || "";
      const input = prompt(`DAY ${idx+1} の目標`, current);
      if (input === null) return;

      sheetState.targets[idx] = input;

      const t = $(`t_${idx}`);
      const trimmed = input.trim();
      t.textContent = trimmed || "（未設定）";
      t.className = trimmed ? "target" : "target muted";

      localStorage.setItem(sheetKey(activeSheetId), JSON.stringify(sheetState));
    });
  });
}

function applySheetBg(){
  document.documentElement.style.setProperty("--sheet-bg", sheetState.bgColor || "#ffffff");
}
function syncBgControls(){
  $("bgColor").value = sheetState.bgColor || "#ffffff";
}
function clearBg(){
  sheetState.bgColor = "#ffffff";
  localStorage.setItem(sheetKey(activeSheetId), JSON.stringify(sheetState));
  applySheetBg();
  syncBgControls();
}

/* ---------- Diary ---------- */

function defaultDiary(){
  return { weight:"", condition:3, weather:"", memo:"", image:"" };
}
function loadDiary(dateISO){
  const raw = localStorage.getItem(diaryKey(dateISO));
  if (!raw) return defaultDiary();
  try{
    const d = JSON.parse(raw);
    return {
      weight: d.weight ?? "",
      condition: clampInt(d.condition,1,5,3),
      weather: d.weather ?? "",
      memo: d.memo ?? "",
      image: typeof d.image === "string" ? d.image : "",
    };
  }catch{
    return defaultDiary();
  }
}
function hasDiary(dateISO){
  const raw = localStorage.getItem(diaryKey(dateISO));
  if (!raw) return false;
  try{
    const d = JSON.parse(raw);
    return !!(
      (d.weight && String(d.weight).trim()) ||
      (d.memo && String(d.memo).trim()) ||
      (d.weather && String(d.weather).trim()) ||
      (d.image && String(d.image).trim()) ||
      Number(d.condition) !== 3
    );
  }catch{
    return false;
  }
}
function saveDiary(dateISO){
  const data = {
    weight: $("weight").value || "",
    condition: selectedCondition,
    weather: selectedWeather || "",
    memo: $("diaryMemo").value || "",
    image: selectedImage || "",
  };
  localStorage.setItem(diaryKey(dateISO), JSON.stringify(data));
}

let monthCursor = 0;
let editingDateISO = todayISO();
let selectedWeather = "";
let selectedCondition = 3;
let selectedImage = "";

function ymFromCursor(cursor){
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + cursor);
  return { y: base.getFullYear(), m: base.getMonth()+1 };
}
function daysInMonth(y,m){
  return new Date(y, m, 0).getDate();
}
function toISO(y,m,d){
  const dt = new Date(y, m-1, d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
}

function renderCalendar(){
  const {y,m} = ymFromCursor(monthCursor);
  $("monthLabel").textContent = `${y}年${m}月`;

  const cal = $("calendar");
  cal.innerHTML = "";

  const firstDow = new Date(y, m-1, 1).getDay();
  const total = daysInMonth(y,m);

  const prevTotal = daysInMonth(y, m-1 <= 0 ? 12 : m-1);
  for (let i=0;i<firstDow;i++){
    const day = prevTotal - firstDow + 1 + i;
    cal.appendChild(makeCalCell(y, m-1, day, true));
  }

  for (let d=1; d<=total; d++){
    cal.appendChild(makeCalCell(y, m, d, false));
  }

  const currentCount = firstDow + total;
  const tail = (currentCount <= 35) ? (35 - currentCount) : (42 - currentCount);
  for (let i=1;i<=tail;i++){
    cal.appendChild(makeCalCell(y, m+1, i, true));
  }
}

function makeCalCell(y,m,d,isMuted){
  const iso = toISO(y,m,d);
  const cell = document.createElement("div");
  cell.className = "calCell" + (isMuted ? " muted" : "");
  cell.dataset.date = iso;

  const dayNum = new Date(iso).getDate();
  const mark = hasDiary(iso);

  cell.innerHTML = `
    <div class="calDay">${dayNum}</div>
    <div class="calMarks">
      <span class="dot ${mark ? "has" : ""}"></span>
    </div>
  `;

  cell.addEventListener("click", () => openDiaryModal(iso));
  return cell;
}

/* Diary modal + image */
function openDiaryModal(dateISO){
  editingDateISO = dateISO;
  $("modalDateLabel").textContent = dateISO;

  const d = loadDiary(dateISO);
  $("weight").value = d.weight;
  $("diaryMemo").value = d.memo;

  setWeather(d.weather || "");
  setCondition(d.condition || 3);
  setImage(d.image || "");

  $("diaryImage").value = "";
  showModal("modal", true);
}

function setWeather(value){
  selectedWeather = value;
  document.querySelectorAll("[data-weather]").forEach((btn)=>{
    btn.classList.toggle("selected", btn.dataset.weather === value);
  });
}
function setCondition(value){
  selectedCondition = value;
  document.querySelectorAll("[data-cond]").forEach((btn)=>{
    btn.classList.toggle("selected", Number(btn.dataset.cond) === value);
  });
}

function setImage(dataUrl){
  selectedImage = dataUrl || "";
  const wrap = $("imagePreviewWrap");
  const img = $("imagePreview");

  if (!selectedImage){
    wrap.classList.add("hidden");
    img.src = "";
    return;
  }
  img.src = selectedImage;
  wrap.classList.remove("hidden");
}

function readImageFile(file){
  if (!file) return;

  if (file.size > 1_500_000){
    alert("画像が大きすぎるかも。軽い画像で試して");
    $("diaryImage").value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => setImage(String(reader.result || ""));
  reader.readAsDataURL(file);
}

/* Full screen viewer */
function openImageViewer(){
  if (!selectedImage) return;
  $("imgFull").src = selectedImage;
  $("imgModalTitle").textContent = editingDateISO;

  // ダウンロードリンク
  const a = $("downloadImg");
  a.href = selectedImage;

  // 拡張子はざっくりjpg扱い（dataURLの中身がpngでも開ける）
  a.download = `diary-${editingDateISO}.jpg`;

  showModal("imgModal", true);
}

/* ---------- Page tabs ---------- */

function showPage(which){
  const isChallenge = which === "challenge";
  $("pageChallenge").classList.toggle("hidden", !isChallenge);
  $("pageDiary").classList.toggle("hidden", isChallenge);

  $("tabChallenge").classList.toggle("active", isChallenge);
  $("tabDiary").classList.toggle("active", !isChallenge);

  $("helpText").textContent = "";
}

/* ---------- Generic modal ---------- */

function showModal(id, open){
  const el = $(id);
  el.classList.toggle("hidden", !open);
  el.setAttribute("aria-hidden", open ? "false" : "true");
}

/* ---------- Boot / migrate old list ---------- */

let visibleTabs = loadList(VISIBLE_KEY, null);
let hiddenTabs  = loadList(HIDDEN_KEY, []);

if (!visibleTabs){
  // 旧バージョン（visibleのみ）から移行：以前のLIST_KEYが残ってたら拾う
  const old = localStorage.getItem("sheet_list_v3");
  if (old){
    try{
      const arr = JSON.parse(old);
      visibleTabs = (Array.isArray(arr) && arr.length) ? arr : ["s1"];
    }catch{
      visibleTabs = ["s1"];
    }
  }else{
    visibleTabs = ["s1"];
  }
  saveList(VISIBLE_KEY, visibleTabs);
  saveList(HIDDEN_KEY, hiddenTabs);
}

let activeSheetId = localStorage.getItem(ACTIVE_KEY) || visibleTabs[0] || "s1";
if (!visibleTabs.includes(activeSheetId)) activeSheetId = visibleTabs[0];

let sheetState = loadSheetState(activeSheetId);

/* challenge events */
$("challengeTitle").addEventListener("input", ()=>{
  sheetState.title = ($("challengeTitle").value || "").trim() || "30日チャレンジ";
  localStorage.setItem(sheetKey(activeSheetId), JSON.stringify(sheetState));
  renderSheetTabs();
});

$("saveBtn").addEventListener("click", ()=> saveSheetState(false));

$("resetBtn").addEventListener("click", ()=>{
  if (!confirm("今のシートをリセットする？")) return;

  const keepBg = confirm("背景色は残す？\nOK=残す / キャンセル=初期化");
  const bg = sheetState.bgColor;

  sheetState = defaultSheetState();
  if (keepBg) sheetState.bgColor = bg;

  localStorage.setItem(sheetKey(activeSheetId), JSON.stringify(sheetState));
  renderSheetTabs();
  renderSheet();
  applySheetBg();
  syncBgControls();
});

$("bgColor").addEventListener("input", ()=>{
  sheetState.bgColor = $("bgColor").value;
  localStorage.setItem(sheetKey(activeSheetId), JSON.stringify(sheetState));
  applySheetBg();
});
$("bgClear").addEventListener("click", clearBg);

$("tabChallenge").addEventListener("click", ()=> showPage("challenge"));
$("tabDiary").addEventListener("click", ()=> showPage("diary"));

/* tab manager events */
$("closeTabModal").addEventListener("click", ()=> showModal("tabModal", false));

/* diary events */
$("prevMonth").addEventListener("click", ()=>{ monthCursor -= 1; renderCalendar(); });
$("nextMonth").addEventListener("click", ()=>{ monthCursor += 1; renderCalendar(); });

$("closeModal").addEventListener("click", ()=> showModal("modal", false));
$("diarySaveBtn").addEventListener("click", ()=>{
  saveDiary(editingDateISO);
  showModal("modal", false);
  renderCalendar();
});

$("diaryImage").addEventListener("change", ()=>{
  const file = $("diaryImage").files?.[0];
  readImageFile(file);
});

$("removeImage").addEventListener("click", ()=>{
  setImage("");
  $("diaryImage").value = "";
});

$("openImage").addEventListener("click", openImageViewer);

$("closeImgModal").addEventListener("click", ()=> showModal("imgModal", false));

document.querySelectorAll("[data-weather]").forEach((btn)=>{
  btn.addEventListener("click", ()=> setWeather(btn.dataset.weather));
});
document.querySelectorAll("[data-cond]").forEach((btn)=>{
  btn.addEventListener("click", ()=> setCondition(Number(btn.dataset.cond)));
});

/* initial render */
renderSheetTabs();
renderSheet();
applySheetBg();
syncBgControls();

renderCalendar();
showPage("challenge");
