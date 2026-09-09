/* 政治理论排坑练习 —— 纯前端，双击 index.html 即可使用。 */
(function () {
"use strict";

/* ============ 存储 ============ */
var KEY = "gk_zhengzhi_v1";
var store = loadStore();

function loadStore() {
  var d = { stats: {}, wrong: [], star: [], sel: null, done: 0 };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) { var o = JSON.parse(raw); for (var k in d) if (o[k] !== undefined) d[k] = o[k]; }
  } catch (e) {}
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

/* ============ 题库构建 ============ */
var BANK = [], SECTIONS = [];

function parseTpl(t) {
  var parts = [], re = /\{\{([^{}]*)\}\}/g, last = 0, m;
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) parts.push({ type: "text", s: t.slice(last, m.index) });
    var seg = m[1].split("||");
    parts.push({ type: "slot", right: seg[0], wrong: seg.length > 1 ? seg[1] : null });
    last = re.lastIndex;
  }
  if (last < t.length) parts.push({ type: "text", s: t.slice(last) });
  return parts;
}

DECK.forEach(function (sec, si) {
  SECTIONS.push({ i: si, book: sec.book, part: sec.part, title: sec.title, n: sec.items.length });
  sec.items.forEach(function (it, ii) {
    var parts = parseTpl(it.t);
    var slots = parts.filter(function (p) { return p.type === "slot"; });
    var traps = slots.filter(function (p) { return p.wrong; });
    BANK.push({
      id: si + "-" + ii, si: si, book: sec.book, part: sec.part, sec: sec.title,
      no: ii + 1, parts: parts, slots: slots, traps: traps,
      bad: !!it.bad, note: it.n || "",
      isTrue: !it.bad && traps.length === 0
    });
  });
});

/* 干扰项词库 */
var POOL = [];
BANK.forEach(function (q) {
  q.slots.forEach(function (s) {
    POOL.push({ w: s.right, si: q.si, book: q.book });
    if (s.wrong) POOL.push({ w: s.wrong, si: q.si, book: q.book });
  });
});

/* ============ 文本渲染 ============ */
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* 手册原句（含坑） */
function textOriginal(q) {
  return q.parts.map(function (p) {
    return p.type === "text" ? esc(p.s) : esc(p.wrong || p.right);
  }).join("");
}
/* 正确表述，opt.mark=标红关键词，opt.mask=盖住关键词 */
function textCorrect(q, opt) {
  opt = opt || {};
  return q.parts.map(function (p) {
    if (p.type === "text") return esc(p.s);
    if (opt.mask) return '<span class="kw hide">' + esc(p.right) + "</span>";
    if (opt.mark) return '<span class="kw">' + esc(p.right) + "</span>";
    return esc(p.right);
  }).join("");
}
/* 正确表述，但指定 slot 变成空格 / 已填内容 */
function textBlank(q, slot, filled, cls) {
  return q.parts.map(function (p) {
    if (p.type === "text") return esc(p.s);
    if (p === slot) {
      return filled
        ? '<span class="' + (cls || "filled") + '">' + esc(filled) + "</span>"
        : '<span class="blank">' + "　　　　" + "</span>";
    }
    return esc(p.right);
  }).join("");
}
/* 闪卡正面：所有考点盖住 */
function textMasked(q) {
  return q.parts.map(function (p) {
    if (p.type === "text") return esc(p.s);
    return '<span class="masked">' + esc(p.right) + "</span>";
  }).join("");
}
/* 批改行：错→对 */
function corrections(q) {
  if (!q.traps.length) return "";
  return q.traps.map(function (s) {
    return '<span class="strike">' + esc(s.wrong) + "</span> → " + '<span class="kw">' + esc(s.right) + "</span>";
  }).join("　；　");
}
function textStudy(q, opt) {
  var t = textCorrect(q, opt);
  return q.bad ? '<span class="strike">' + t + "</span>" : t;
}
function srcOf(q) { return q.book + " · " + q.sec + " · 第 " + q.no + " 条"; }

/* ============ 通用工具 ============ */
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function stat(id) { return store.stats[id] || (store.stats[id] = { r: 0, w: 0, streak: 0 }); }
function accOfSection(si) {
  var r = 0, w = 0;
  BANK.forEach(function (q) {
    if (q.si !== si) return;
    var s = store.stats[q.id]; if (!s) return;
    r += s.r; w += s.w;
  });
  return r + w === 0 ? null : r / (r + w);
}

/* ============ 视图切换 ============ */
function go(name) {
  $$(".view").forEach(function (v) { v.classList.toggle("is-on", v.id === "view-" + name); });
  $$(".tab").forEach(function (t) { t.classList.toggle("is-on", t.dataset.go === name); });
  if (name === "review") renderReview();
  if (name === "browse") renderBrowse();
  if (name === "stats") renderStats();
  if (name === "setup") { renderSections(); updatePick(); }
  window.scrollTo(0, 0);
}
$$("[data-go]").forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.go); }); });

/* ============ 配置页 ============ */
var selected = {};
(function initSel() {
  if (store.sel && store.sel.length) { store.sel.forEach(function (i) { selected[i] = true; }); }
  else SECTIONS.forEach(function (s) { selected[s.i] = true; });
})();

function renderSections() {
  var host = $("#section-list"), html = "", lastKey = "";
  SECTIONS.forEach(function (s) {
    var key = s.book + "｜" + s.part;
    if (key !== lastKey) {
      if (lastKey) html += "</div>";
      html += "<div class='sec-group'><h3>" + esc(s.book + " · " + s.part) + "</h3>";
      lastKey = key;
    }
    var a = accOfSection(s.i), tag = "";
    if (a !== null) {
      var cls = a >= 0.8 ? "good" : (a < 0.6 ? "bad" : "");
      tag = "<span class='acc " + cls + "'>" + Math.round(a * 100) + "%</span>";
    }
    html += "<label class='sec-row'><input type='checkbox' data-si='" + s.i + "'" + (selected[s.i] ? " checked" : "") +
      "><span class='name'>" + esc(s.title) + "</span>" + tag + "<span class='n'>" + s.n + " 条</span></label>";
  });
  if (lastKey) html += "</div>";
  host.innerHTML = html;
  host.querySelectorAll("input[type=checkbox]").forEach(function (c) {
    c.addEventListener("change", function () { selected[c.dataset.si] = c.checked; persistSel(); updatePick(); });
  });
}
function persistSel() {
  store.sel = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
  save();
}
$$("[data-sel]").forEach(function (b) {
  b.addEventListener("click", function () {
    var m = b.dataset.sel;
    SECTIONS.forEach(function (s) {
      if (m === "all") selected[s.i] = true;
      else if (m === "none") selected[s.i] = false;
      else if (m === "xi") selected[s.i] = s.book === "习思想";
      else if (m === "ma") selected[s.i] = s.book === "马原";
      else if (m === "weak") { var a = accOfSection(s.i); selected[s.i] = (a === null || a < 0.8); }
    });
    persistSel(); renderSections(); updatePick();
  });
});
$$("#mode-list .mode").forEach(function (l) {
  l.addEventListener("click", function () {
    $$("#mode-list .mode").forEach(function (x) { x.classList.remove("is-on"); });
    l.classList.add("is-on"); updatePick();
  });
});
["#opt-size", "#opt-order", "#opt-onlywrong"].forEach(function (s) { $(s).addEventListener("change", updatePick); });

function currentMode() { return ($("input[name=mode]:checked") || {}).value || "judge"; }

function fits(q, mode) {
  if (mode === "choice" || mode === "cloze" || mode === "flash") return q.slots.length > 0;
  return true;
}
function candidatePool() {
  var mode = currentMode(), onlyWrong = $("#opt-onlywrong").checked;
  return BANK.filter(function (q) {
    if (!selected[q.si]) return false;
    if (onlyWrong && store.wrong.indexOf(q.id) < 0) return false;
    return fits(q, mode);
  });
}
function updatePick() {
  var n = candidatePool().length, size = +$("#opt-size").value;
  var take = size === 0 ? n : Math.min(size, n);
  $("#pick-note").textContent = n === 0 ? "当前条件下没有可练的题" : "本轮将抽取 " + take + " 题（可选 " + n + " 题）";
}

/* ============ 练习流程 ============ */
var run = null;

function startRun(list, mode) {
  if (!list.length) { alert("当前条件下没有可练的题，先调整范围。"); return; }
  run = { list: list, i: 0, mode: mode, right: 0, wrong: 0, answered: false };
  go("drill"); renderQ();
}
$("#start").addEventListener("click", function () {
  var mode = currentMode(), pool = candidatePool().slice(), order = $("#opt-order").value, size = +$("#opt-size").value;
  if (order === "shuffle") shuffle(pool);
  else if (order === "weak") {
    pool.sort(function (a, b) {
      var sa = store.stats[a.id] || { r: 0, w: 0 }, sb = store.stats[b.id] || { r: 0, w: 0 };
      var ra = sa.w - sa.r, rb = sb.w - sb.r;
      return rb - ra;
    });
  }
  if (size > 0) pool = pool.slice(0, size);
  startRun(pool, mode);
});

function renderQ() {
  var q = run.list[run.i];
  run.answered = false;
  $("#bar-fill").style.width = (run.i / run.list.length * 100) + "%";
  $("#progress-text").textContent = (run.i + 1) + " / " + run.list.length;
  $("#score-right").textContent = run.right;
  $("#score-wrong").textContent = run.wrong;
  $("#q-source").textContent = srcOf(q);
  $("#q-feedback").hidden = true;
  $("#q-feedback").innerHTML = "";
  $("#btn-next").hidden = true;
  var st = $("#btn-star");
  st.classList.toggle("on", store.star.indexOf(q.id) >= 0);
  st.textContent = store.star.indexOf(q.id) >= 0 ? "★ 已收藏" : "☆ 收藏";

  if (run.mode === "judge") renderJudge(q);
  else if (run.mode === "choice") renderChoice(q);
  else if (run.mode === "cloze") renderCloze(q);
  else renderFlash(q);
}

/* --- 判断改错 --- */
function renderJudge(q) {
  run.variant = null;
  var vbox = $("#opt-variant");
  if (vbox && vbox.checked && q.isTrue && q.slots.length && Math.random() < 0.5) {
    var vs = q.slots[Math.floor(Math.random() * q.slots.length)];
    var d = distractors(vs.right, vs, q, 1);
    if (d.length) run.variant = { slot: vs, word: d[0] };
  }
  $("#q-stem").innerHTML = run.variant
    ? textBlank(q, run.variant.slot, run.variant.word, "vword")
    : textOriginal(q);
  $("#q-answer").innerHTML =
    '<div class="judge-row">' +
    '<button data-v="1">表述正确<span class="k">按 1</span></button>' +
    '<button data-v="0">表述有坑<span class="k">按 2</span></button></div>';
  $("#q-hint").textContent = "1 = 正确，2 = 有坑，空格进入下一题";
  $("#q-answer").querySelectorAll("button").forEach(function (b) {
    b.addEventListener("click", function () { judgeAnswer(q, b.dataset.v === "1"); });
  });
}
function judgeAnswer(q, said) {
  if (run.answered) return;
  var v = run.variant;
  var truth = v ? false : q.isTrue;
  var ok = (said === truth);
  var fb = q.bad ? "" : '<div class="corrected">' + textCorrect(q, { mark: true }) + "</div>";
  if (v) {
    fb += '<div class="note">变式改动：<span class="strike">' + esc(v.word) + "</span> → " +
      '<span class="kw">' + esc(v.slot.right) + "</span></div>";
  } else if (q.traps.length) {
    fb += '<div class="note">改错：' + corrections(q) + "</div>";
  }
  finish(q, ok, truth ? "这句是对的。" : "这句有坑。", fb);
}

/* --- 关键词四选一 --- */
function pickSlot(q) {
  var pool = q.traps.length ? q.traps : q.slots;
  return pool[Math.floor(Math.random() * pool.length)];
}
function shapeOf(w) {
  if (/(大|中全会)$/.test(w) && w.length <= 6) return "meeting";
  if (/(年|世纪)/.test(w)) return "time";
  if (/(性|观|论)$/.test(w)) return "abstract";
  return "term";
}
function distractors(ans, slot, q, need) {
  var used = Object.create(null), out = [];
  used[ans] = 1;
  if (slot.wrong && !used[slot.wrong]) { out.push(slot.wrong); used[slot.wrong] = 1; }
  var sh = shapeOf(ans), cands = [];
  POOL.forEach(function (p) {
    if (used[p.w]) return;
    if (Math.abs(p.w.length - ans.length) > Math.max(2, ans.length * 0.5)) return;
    cands.push({
      w: p.w,
      sc: (shapeOf(p.w) === sh ? 4 : 0) + (p.si === q.si ? 2 : 0) + (p.book === q.book ? 1 : 0) + Math.random()
    });
  });
  cands.sort(function (a, b) { return b.sc - a.sc; });
  cands.forEach(function (c) {
    if (out.length >= need || used[c.w]) return;
    used[c.w] = 1; out.push(c.w);
  });
  return out;
}
function renderChoice(q) {
  var slot = pickSlot(q), ans = slot.right;
  var opts = shuffle([ans].concat(distractors(ans, slot, q, 3)));
  $("#q-stem").innerHTML = textBlank(q, slot, null);
  var labels = ["A", "B", "C", "D", "E"];
  $("#q-answer").innerHTML = '<div class="choice-list">' + opts.map(function (o, i) {
    return '<button class="choice" data-o="' + esc(o) + '"><span class="idx">' + labels[i] + "</span><span>" + esc(o) + "</span></button>";
  }).join("") + "</div>";
  $("#q-hint").textContent = "按 1–4 选择，空格进入下一题";
  $("#q-answer").querySelectorAll(".choice").forEach(function (b) {
    b.addEventListener("click", function () {
      if (run.answered) return;
      var ok = b.dataset.o === ans;
      $("#q-answer").querySelectorAll(".choice").forEach(function (x) {
        x.disabled = true;
        if (x.dataset.o === ans) x.classList.add("correct");
        else if (x === b) x.classList.add("wrong");
      });
      $("#q-stem").innerHTML = textBlank(q, slot, ans, "filled");
      finish(q, ok, ok ? "选对了。" : "选错了，正确关键词是「" + ans + "」。",
        (slot.wrong ? '<div class="note">手册原句的坑：' + '<span class="strike">' + esc(slot.wrong) + "</span> → " + '<span class="kw">' + esc(ans) + "</span></div>" : "") +
        '<div class="corrected">' + textCorrect(q, { mark: true }) + "</div>");
    });
  });
}

/* --- 默写填空 --- */
function normalize(s) { return String(s).replace(/[\s，。、；：“”‘’《》（）()"'·．.]/g, ""); }
function renderCloze(q) {
  var slot = pickSlot(q), ans = slot.right;
  $("#q-stem").innerHTML = textBlank(q, slot, null);
  $("#q-answer").innerHTML =
    '<div class="cloze-row"><input id="cloze-in" placeholder="写出横线上的关键词" autocomplete="off">' +
    '<button class="primary small" id="cloze-ok">对答案</button>' +
    '<button class="ghost" id="cloze-skip">想不起来</button></div>';
  $("#q-hint").textContent = "回车对答案，空格进入下一题";
  var input = $("#cloze-in");
  input.focus();
  function submit(skip) {
    if (run.answered) return;
    var val = input.value;
    var ok = !skip && normalize(val) === normalize(ans);
    input.disabled = true;
    $("#q-stem").innerHTML = textBlank(q, slot, ans, "filled");
    finish(q, ok,
      ok ? "写对了。" : "答案是「" + ans + "」" + (skip || !val ? "。" : "，你写的是「" + val + "」。"),
      '<div class="corrected">' + textCorrect(q, { mark: true }) + "</div>");
  }
  $("#cloze-ok").addEventListener("click", function () { submit(false); });
  $("#cloze-skip").addEventListener("click", function () { submit(true); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(false); } });
}

/* --- 闪卡 --- */
function renderFlash(q) {
  $("#q-stem").innerHTML = textMasked(q);
  $("#q-answer").innerHTML = '<div class="judge-row"><button id="flip">翻面看答案<span class="k">按空格</span></button></div>';
  $("#q-hint").textContent = "先在心里补全黑块，再翻面";
  $("#flip").addEventListener("click", flip);
  function flip() {
    if (run.answered) return;
    $("#q-stem").innerHTML = textCorrect(q, { mark: true });
    $("#q-answer").innerHTML = '<div class="judge-row">' +
      '<button data-v="1">记住了<span class="k">按 1</span></button>' +
      '<button data-v="0">还没记牢<span class="k">按 2</span></button></div>';
    $("#q-answer").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        finish(q, b.dataset.v === "1", b.dataset.v === "1" ? "记住了。" : "放进错题本，回头再看。",
          q.traps.length ? '<div class="note">手册的坑：' + corrections(q) + "</div>" : "");
      });
    });
    run.flipped = true;
  }
  run.flipped = false;
  run.flip = flip;
}

/* --- 判分与推进 --- */
function finish(q, ok, verdict, extraHtml) {
  run.answered = true;
  var s = stat(q.id);
  if (ok) { s.r++; s.streak = (s.streak || 0) + 1; run.right++; }
  else { s.w++; s.streak = 0; run.wrong++; }
  var wi = store.wrong.indexOf(q.id);
  if (!ok && wi < 0) store.wrong.push(q.id);
  if (ok && wi >= 0 && s.streak >= 2) store.wrong.splice(wi, 1);
  store.done++;
  save();

  var fb = $("#q-feedback");
  fb.innerHTML = '<div class="verdict ' + (ok ? "ok" : "no") + '">' + esc(verdict) + "</div>" +
    (extraHtml || "") + (q.note ? '<div class="note">' + esc(q.note) + "</div>" : "");
  fb.hidden = false;
  $("#btn-next").hidden = false;
  $("#btn-next").textContent = run.i === run.list.length - 1 ? "看本轮结果" : "下一题";
  $("#btn-next").focus();
  $("#score-right").textContent = run.right;
  $("#score-wrong").textContent = run.wrong;
}
$("#btn-next").addEventListener("click", next);
function next() {
  if (run.i === run.list.length - 1) return summary();
  run.i++; renderQ();
}
function summary() {
  var total = run.list.length, acc = Math.round(run.right / total * 100);
  $("#bar-fill").style.width = "100%";
  $("#progress-text").textContent = total + " / " + total;
  $("#q-source").textContent = "本轮结束";
  $("#q-stem").innerHTML = "做了 " + total + " 题，对 " + run.right + " 题，正确率 " + acc + "%。";
  $("#q-answer").innerHTML = '<div class="judge-row">' +
    '<button id="again">再来一轮同样范围</button>' +
    '<button id="fixwrong">立刻重做本轮错题</button>' +
    '<button id="back">回到设置</button></div>';
  $("#q-feedback").hidden = true;
  $("#btn-next").hidden = true;
  $("#q-hint").textContent = "";
  $("#again").addEventListener("click", function () { startRun(shuffle(run.list.slice()), run.mode); });
  $("#back").addEventListener("click", function () { go("setup"); });
  $("#fixwrong").addEventListener("click", function () {
    var ids = {}; store.wrong.forEach(function (i) { ids[i] = 1; });
    var list = run.list.filter(function (q) { return ids[q.id]; });
    if (!list.length) { alert("本轮没有留下错题。"); return; }
    startRun(shuffle(list), run.mode);
  });
}
$("#btn-star").addEventListener("click", function () {
  var q = run && run.list[run.i]; if (!q) return;
  var i = store.star.indexOf(q.id);
  if (i < 0) store.star.push(q.id); else store.star.splice(i, 1);
  save();
  var on = store.star.indexOf(q.id) >= 0;
  this.classList.toggle("on", on);
  this.textContent = on ? "★ 已收藏" : "☆ 收藏";
});

/* --- 键盘 --- */
document.addEventListener("keydown", function (e) {
  if (!$("#view-drill").classList.contains("is-on")) return;
  if (e.target.tagName === "INPUT") { return; }
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (run.mode === "flash" && !run.flipped && !run.answered) return run.flip();
    if (run.answered && !$("#btn-next").hidden) next();
    return;
  }
  if (/^[1-4]$/.test(e.key)) {
    var btns = $("#q-answer").querySelectorAll("button");
    var i = +e.key - 1;
    if (btns[i] && !btns[i].disabled) btns[i].click();
  }
});

/* ============ 错题与收藏 ============ */
var revTab = "wrong";
$$("[data-rev]").forEach(function (b) {
  b.addEventListener("click", function () {
    revTab = b.dataset.rev;
    $$("[data-rev]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
    renderReview();
  });
});
function revList() {
  var ids = revTab === "wrong" ? store.wrong : store.star;
  return BANK.filter(function (q) { return ids.indexOf(q.id) >= 0; });
}
function renderReview() {
  $("#cnt-wrong").textContent = store.wrong.length;
  $("#cnt-star").textContent = store.star.length;
  var list = revList(), host = $("#review-list");
  if (!list.length) {
    host.innerHTML = '<div class="empty">' + (revTab === "wrong"
      ? "错题本还是空的。做错的题会自动进来，连续答对两次后自动移出。"
      : "还没有收藏。答题时点“☆ 收藏”，重点句子就留在这里。") + "</div>";
    return;
  }
  host.innerHTML = list.map(function (q) {
    var s = store.stats[q.id] || { r: 0, w: 0 };
    return '<div class="r-item"><div class="src">' + esc(srcOf(q)) + "</div>" +
      '<div class="txt">' + textStudy(q, { mark: true }) + "</div>" +
      (q.bad ? '<div class="tail">这句本身就是错的。</div>' : "") +
      (q.traps.length ? '<div class="tail">坑：' + corrections(q) + "</div>" : "") +
      (q.note ? '<div class="tail">' + esc(q.note) + "</div>" : "") +
      '<div class="tail">对 ' + s.r + " 次 · 错 " + s.w + " 次</div></div>";
  }).join("");
}
$("#drill-review").addEventListener("click", function () {
  var mode = currentMode();
  var list = revList().filter(function (q) { return fits(q, mode); });
  if (!list.length) { alert("这些题目不适用当前练法，回“开始练习”换一种练法（判断改错适用于全部题目）。"); return; }
  startRun(shuffle(list), mode);
});
$("#clear-review").addEventListener("click", function () {
  if (!confirm("确定清空当前列表？")) return;
  if (revTab === "wrong") store.wrong = []; else store.star = [];
  save(); renderReview();
});

/* ============ 通读手册 ============ */
var masked = false;
$("#toggle-mask").addEventListener("click", function () {
  masked = !masked;
  this.classList.toggle("is-on", masked);
  this.textContent = masked ? "显示关键词" : "盖住关键词";
  renderBrowse();
});
(function initFilter() {
  var sel = $("#browse-filter"), html = '<option value="all">全部章节</option>';
  SECTIONS.forEach(function (s) { html += '<option value="' + s.i + '">' + esc(s.book + " · " + s.title) + "</option>"; });
  sel.innerHTML = html;
  sel.addEventListener("change", renderBrowse);
})();
function renderBrowse() {
  var f = $("#browse-filter").value, host = $("#browse-list"), html = "";
  SECTIONS.forEach(function (s) {
    if (f !== "all" && +f !== s.i) return;
    html += '<div class="b-group"><h3>' + esc(s.book + " · " + s.title) + "</h3>";
    BANK.filter(function (q) { return q.si === s.i; }).forEach(function (q) {
      html += '<div class="r-item"><div class="txt">' + q.no + ". " +
        textStudy(q, masked ? { mask: true } : { mark: true }) + "</div>" +
        (q.bad ? '<div class="tail">这句本身就是错的。</div>' : "") +
        (q.traps.length ? '<div class="tail">坑：' + corrections(q) + "</div>" : "") +
        (q.note ? '<div class="tail">' + esc(q.note) + "</div>" : "") + "</div>";
    });
    html += "</div>";
  });
  host.innerHTML = html;
}

/* ============ 统计 ============ */
function renderStats() {
  var seen = 0, r = 0, w = 0, mastered = 0;
  BANK.forEach(function (q) {
    var s = store.stats[q.id]; if (!s) return;
    seen++; r += s.r; w += s.w;
    if ((s.streak || 0) >= 2) mastered++;
  });
  var acc = r + w ? Math.round(r / (r + w) * 100) : 0;
  $("#stat-cards").innerHTML = [
    ["<b>" + seen + "</b> / " + BANK.length, "练过的条目"],
    [acc + "%", "累计正确率"],
    [mastered, "连续答对两次（已过关）"],
    [store.wrong.length, "错题本待清"]
  ].map(function (c) {
    return '<div class="s-card"><div class="v">' + c[0] + '</div><div class="l">' + c[1] + "</div></div>";
  }).join("");

  $("#stat-table").innerHTML = SECTIONS.map(function (s) {
    var a = accOfSection(s.i);
    var pct = a === null ? 0 : Math.round(a * 100);
    return '<div class="st-row"><span class="nm">' + esc(s.book + " · " + s.title) + "</span>" +
      '<span class="track"><i style="width:' + pct + '%"></i></span>' +
      '<span class="pct">' + (a === null ? "未练" : pct + "%") + "</span></div>";
  }).join("");
}
$("#reset-all").addEventListener("click", function () {
  if (!confirm("将清空所有做题记录、错题本和收藏，确定吗？")) return;
  store = { stats: {}, wrong: [], star: [], sel: store.sel, done: 0 };
  save(); renderStats(); renderSections();
});

/* ============ 启动 ============ */
$("#bank-count").textContent = BANK.length;
renderSections();
updatePick();
})();
