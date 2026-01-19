function $(id){ return document.getElementById(id); }

// State
let layers = [];       // [{name, order, traits:[{name, weight, isNone, file, path}]}]
let blockRules = [];
let forceRules = [
  { if:["Body Accessory","Boo Sheet"], thenRequire:[["Eyes","None"],["Face","None"],["Collar","None"],["Headwear","None"]] }
];
const expandedState = new Map(); // name -> boolean
const PRESETS = { common:60, rare:25, epic:10, legendary:5 };
let previewTimer = null;

// Hidden pickers (directory + single file)
const dirPicker = document.createElement("input");
dirPicker.type = "file";
dirPicker.multiple = true;
dirPicker.webkitdirectory = true;
dirPicker.accept = "image/png";
dirPicker.style.display = "none";
document.body.appendChild(dirPicker);

const filePicker = document.createElement("input");
filePicker.type = "file";
filePicker.accept = "image/png";
filePicker.style.display = "none";
document.body.appendChild(filePicker);

const imageCache = new WeakMap(); // File -> Promise<HTMLImageElement|ImageBitmap>

/* ---------- Helpers ---------- */
const collator = new Intl.Collator(undefined, { numeric:true, sensitivity:"base" });

function parseNameAndWeight(base) {
  const m = base.match(/^(.*?)(?:#(\d+))?$/);
  const name = (m?.[1] ?? base).trim();
  const weight = m?.[2] ? Number(m[2]) : null;
  return { name, weight };
}

function layerNameFromFolder(folder) {
  const cleaned = folder.replace(/^\d+[_\-\s]?/, "").trim();
  return cleaned || folder;
}

async function loadImageFromFile(file) {
  if (imageCache.has(file)) return imageCache.get(file);
  const promise = new Promise((resolve, reject) => {
    if (window.createImageBitmap) {
      createImageBitmap(file).then(img => resolve(img)).catch(reject);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = err => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
  imageCache.set(file, promise);
  return promise;
}

async function ensureSameSize(file, w, h) {
  const img = await loadImageFromFile(file);
  if (img.width !== w || img.height !== h) {
    throw new Error(`All images must be ${w}x${h}. ${file.name} is ${img.width}x${img.height}`);
  }
}

async function parseSingleImage(file, layerName, w, h) {
  await ensureSameSize(file, w, h);
  const base = file.name.replace(/\.png$/i, "");
  const { name, weight } = parseNameAndWeight(base);
  return {
    layer: layerName,
    name,
    file,
    path: file.webkitRelativePath || file.name,
    weight: weight ?? PRESETS.common,
    isNone: /^none$/i.test(name)
  };
}

async function parseLayersFromFiles(fileList, w, h) {
  const files = Array.from(fileList || []).filter(f => /\.png$/i.test(f.name));
  if (!files.length) throw new Error("No PNG files found in that folder.");

  const byLayer = new Map(); // folder -> File[]
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split("/");
    const folder = parts.length > 1 ? parts.at(-2) : "Layer";
    if (!byLayer.has(folder)) byLayer.set(folder, []);
    byLayer.get(folder).push(file);
  }

  const layersOut = [];
  const layerEntries = [...byLayer.entries()].sort((a,b)=>collator.compare(a[0], b[0]));
  for (let i=0; i<layerEntries.length; i++) {
    const [folder, fileArr] = layerEntries[i];
    const traits = [];
    for (const file of fileArr) {
      const trait = await parseSingleImage(file, layerNameFromFolder(folder), w, h);
      traits.push(trait);
    }
    layersOut.push({ name: layerNameFromFolder(folder), order:i, traits });
  }
  return layersOut;
}

function weightedPick(traits) {
  const total = traits.reduce((s,t)=>s+t.weight, 0);
  let r = Math.random() * total;
  for (const t of traits) { r -= t.weight; if (r <= 0) return t; }
  return traits.at(-1);
}

function violatesBlock(chosen, L, T, rules) {
  return (rules.block || []).some(({ a, b }) => {
    const [aL, aT] = a; const [bL, bT] = b;
    const case1 = (L === aL && (aT === "*" || T === aT)) && chosen[bL] && (bT === "*" || chosen[bL] === bT);
    const case2 = (L === bL && (bT === "*" || T === bT)) && chosen[aL] && (aT === "*" || chosen[aL] === aT);
    return case1 || case2;
  });
}

function narrowByForce(chosen, L, candidates, rules) {
  const must = new Map();
  for (const rule of (rules.force || [])) {
    const [tL, tT] = rule.if;
    if (chosen[tL] === tT) for (const [reqL, reqT] of rule.thenRequire) must.set(reqL, reqT);
  }
  if (!must.has(L)) return candidates;
  const need = must.get(L);
  return candidates.filter(c => need === "*" ? true : c.name === need);
}

function applyForceCorrections(chosen, traitByLayer, layersSorted, rules) {
  for (const rule of (rules.force || [])) {
    const [tL, tT] = rule.if;
    if (chosen[tL] !== tT) continue;
    for (const [reqL, reqT] of rule.thenRequire) {
      if (reqT === "*") continue;
      const L = layersSorted.find(x => x.name === reqL);
      const forced = L?.traits.find(t => t.name === reqT);
      if (!forced) throw new Error(`Force requires "${reqL}:${reqT}" but that trait doesn't exist.`);
      chosen[reqL] = reqT; traitByLayer[reqL] = forced;
    }
  }
}

async function renderComposite(traitByLayer, layersSorted, canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const L of layersSorted) {
    const trait = traitByLayer[L.name];
    if (!trait?.file) continue;
    const img = await loadImageFromFile(trait.file);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error("Canvas export failed."));
      resolve(blob);
    }, "image/png");
  });
}

async function generateZip({ layers, rules, supply, canvasSize, namePrefix, symbol, walletAddress }) {
  if (!window.JSZip) throw new Error("JSZip failed to load.");
  const zip = new JSZip();
  const imagesFolder = zip.folder("images");
  const metaFolder = zip.folder("metadata");

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize.w;
  canvas.height = canvasSize.h;
  const ctx = canvas.getContext("2d");

  const seen = new Set();
  const minted = [];
  const maxAttempts = Math.max(supply * 50, supply + 10);
  let attempts = 0;

  while (minted.length < supply && attempts < maxAttempts) {
    attempts++;
    const sorted = [...layers].sort((a,b)=>a.order-b.order);
    const chosenNames = {};
    const traitByLayer = {};

    let failed = false;
    for (const L of sorted) {
      let candidates = L.traits.slice();
      candidates = candidates.filter(t => !violatesBlock(chosenNames, L.name, t.name, rules));
      candidates = narrowByForce(chosenNames, L.name, candidates, rules);
      if (!candidates.length) { failed = true; break; }
      const pick = weightedPick(candidates);
      chosenNames[L.name] = pick.name;
      traitByLayer[L.name] = pick;
    }
    if (failed) continue;

    applyForceCorrections(chosenNames, traitByLayer, layers, rules);
    if (Object.entries(chosenNames).some(([LL,TT]) => violatesBlock(chosenNames, LL, TT, rules))) continue;

    const dna = Object.entries(chosenNames).sort(([a],[b]) => a.localeCompare(b)).map(([k,v])=>`${k}:${v}`).join("|");
    if (seen.has(dna)) continue;
    seen.add(dna);

    const edition = minted.length + 1;
    const pngBlob = await renderComposite(traitByLayer, sorted, canvas, ctx);
    const pngBuffer = await pngBlob.arrayBuffer();
    imagesFolder.file(`${edition}.png`, pngBuffer);

    const attributes = sorted.map(L => ({ trait_type: L.name, value: chosenNames[L.name] }));
    minted.push({ edition, attributes });
  }

  const traitCounts = new Map();
  for (const { attributes } of minted) {
    for (const attr of attributes) {
      const key = `${attr.trait_type}::${attr.value}`;
      traitCounts.set(key, (traitCounts.get(key) ?? 0) + 1);
    }
  }

  const rarityScoreByIndex = new Map();
  minted.forEach(({ edition, attributes }, idx) => {
    const score = attributes.reduce((acc, attr) => {
      const count = traitCounts.get(`${attr.trait_type}::${attr.value}`) || 1;
      return acc + (supply / count);
    }, 0);
    rarityScoreByIndex.set(idx, score);
  });

  const rankEntries = [...rarityScoreByIndex.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] - b[0];
  });
  const rankByIndex = new Map();
  rankEntries.forEach(([idx], position) => rankByIndex.set(idx, position + 1));

  minted.forEach(({ edition, attributes }, idx) => {
    const rank = rankByIndex.get(idx) || minted.length;
    const meta = {
      name: `${namePrefix} #${edition}`,
      symbol,
      description: "",
      image: `${edition}.png`,
      properties: {
        category: "image",
        files:[{ uri: `${edition}.png`, type: "image/png" }],
        creators:[{ address: walletAddress, share:100 }]
      },
      attributes: [...attributes, { trait_type: "Rank", value: rank }]
    };
    metaFolder.file(`${edition}.json`, JSON.stringify(meta, null, 2));
  });

  const zipBlob = await zip.generateAsync({ type:"blob" });
  return { zipBlob, minted: minted.length, requested: supply, attempts };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- UI Rendering ---------- */
function refreshExpectedCounts() {
  const supply = Math.max(0, +$("supply")?.value || 0);
  layers.forEach(L => {
    const total = L.traits.reduce((sum, trait) => sum + (Number(trait.weight) || 0), 0);
    const denom = total > 0 ? total : 0;
    L.traits.forEach(t => {
      const expected = denom ? Math.round(((Number(t.weight) || 0) / denom) * supply) : 0;
      document.querySelectorAll(`td[data-expected-layer="${CSS.escape(L.name)}"][data-expected-trait="${CSS.escape(t.name)}"]`)
        .forEach(cell => { cell.textContent = expected; });
    });
  });
}

function renderLayers(){
  const cont = $("layersContainer");
  cont.innerHTML = "";
  const sorted = [...layers].sort((a,b)=>a.order-b.order);

  sorted.forEach((L,i)=>{
    if (!expandedState.has(L.name)) expandedState.set(L.name, i < 3);

    const box = document.createElement("div");
    box.className = "layer-row " + (expandedState.get(L.name) ? "expanded" : "");
    box.innerHTML = `
      <div class="layer-head">
        <button class="up">↑</button>
        <button class="down">↓</button>
        <button class="toggle">${expandedState.get(L.name) ? "▾" : "▸"}</button>
        <strong>${L.name}</strong>
        <button class="add-trait">+ Add Image</button>
        <span class="muted">${L.traits.length} traits</span>
      </div>
      <div class="layer-body">
        <table class="table">
          <thead>
            <tr>
              <th style="width:35%">Trait</th>
              <th style="width:35%">Weight</th>
              <th style="width:15%">Preset</th>
              <th style="width:15%">≈ Count</th>
            </tr>
          </thead>
          <tbody id="tbody-${CSS.escape(L.name)}"></tbody>
        </table>
      </div>
    `;
    cont.appendChild(box);

    box.querySelector(".up").onclick   = ()=> { if(i>0){ [sorted[i-1].order,sorted[i].order]=[sorted[i].order,sorted[i-1].order]; layers = sorted; renderLayers(); } };
    box.querySelector(".down").onclick = ()=> { if(i<sorted.length-1){ [sorted[i+1].order,sorted[i].order]=[sorted[i].order,sorted[i+1].order]; layers = sorted; renderLayers(); } };

    box.querySelector(".toggle").onclick = ()=>{
      const now = !(expandedState.get(L.name));
      expandedState.set(L.name, now);
      renderLayers();
    };

    const addButton = box.querySelector(".add-trait");
    addButton.onclick = async () => {
      filePicker.value = "";
      filePicker.onchange = async () => {
        const file = filePicker.files?.[0];
        if (!file) return;
        const w = +$("w").value || 1024;
        const h = +$("h").value || 1024;
        try {
          const trait = await parseSingleImage(file, L.name, w, h);
          const target = layers.find(layer => layer.name === L.name);
          if (!target) throw new Error("Layer no longer exists.");
          const duplicate = target.traits.some(t => t.name === trait.name);
          if (duplicate) {
            const go = window.confirm(`Trait "${trait.name}" already exists in ${L.name}. Add another copy?`);
            if (!go) return;
          }
          target.traits.push(trait);
          expandedState.set(L.name, true);
          renderLayers();
          $("status").textContent = `Added ${trait.name} to ${L.name}.`;
        } catch (err) {
          console.error(err);
          alert("Couldn't add image: " + (err?.message || err));
        }
      };
      filePicker.click();
    };

    if (expandedState.get(L.name)) {
      const tbody = box.querySelector(`#tbody-${CSS.escape(L.name)}`);
      const supply = Math.max(0, +$("supply")?.value || 0);
      const totalWeight = L.traits.reduce((sum, trait) => sum + (Number(trait.weight) || 0), 0);
      L.traits.forEach(t=>{
        if (typeof t.weight !== "number" || Number.isNaN(t.weight)) t.weight = t.isNone ? 0 : 60;
        const expected = totalWeight ? Math.round(((Number(t.weight) || 0) / totalWeight) * supply) : 0;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.name}${t.isNone ? " <span class='small'>(None)</span>":""}</td>
          <td>
            <div class="weight-wrap">
              <input type="range" min="0" max="100" step="1" value="${t.weight}" data-layer="${L.name}" data-trait="${t.name}">
              <input type="number" class="weight-num" min="0" max="100" step="1" value="${t.weight}" data-num="${L.name}:${t.name}">
            </div>
          </td>
          <td>
            <select data-preset="${L.name}:${t.name}">
              <option value="">—</option>
              <option value="common">Common (60)</option>
              <option value="rare">Rare (25)</option>
              <option value="epic">Epic (10)</option>
              <option value="legendary">Legendary (5)</option>
            </select>
          </td>
          <td class="expected">${expected}</td>
        `;
        tbody.appendChild(tr);
        const expectedCell = tr.querySelector(".expected");
        if (expectedCell) {
          expectedCell.dataset.expectedLayer = L.name;
          expectedCell.dataset.expectedTrait = t.name;
        }
      });

      box.querySelectorAll('input[type="range"][data-layer]').forEach(sl=>{
        sl.addEventListener("input", e=>{
          const layerName = e.target.getAttribute("data-layer");
          const traitName = e.target.getAttribute("data-trait");
          const v = Math.max(0, Math.min(100, +e.target.value));
          const Lref = layers.find(x=>x.name===layerName);
          const T = Lref?.traits.find(tt=>tt.name===traitName);
          if (T) T.weight = v;
          const num = box.querySelector(`input[data-num="${CSS.escape(layerName+':'+traitName)}"]`);
          if (num) num.value = v;
          refreshExpectedCounts();
          schedulePreview("weights updated");
        });
      });
      box.querySelectorAll('input[type="number"][data-num]').forEach(num=>{
        num.addEventListener("change", e=>{
          const [layerName, traitName] = e.target.getAttribute("data-num").split(":");
          const v = Math.max(0, Math.min(100, +e.target.value));
          const Lref = layers.find(x=>x.name===layerName);
          const T = Lref?.traits.find(tt=>tt.name===traitName);
          if (T) T.weight = v;
          const range = box.querySelector(`input[type="range"][data-layer="${CSS.escape(layerName)}"][data-trait="${CSS.escape(traitName)}"]`);
          if (range) range.value = v;
          refreshExpectedCounts();
          schedulePreview("weights updated");
        });
      });
      box.querySelectorAll('select[data-preset]').forEach(sel=>{
        sel.addEventListener("change", e=>{
          const [layerName, traitName] = e.target.getAttribute("data-preset").split(":");
          const Lref = layers.find(x=>x.name===layerName);
          const T = Lref?.traits.find(tt=>tt.name===traitName);
          if (!T) return;
          const preset = e.target.value;
          if (preset && PRESETS[preset] != null) {
            T.weight = PRESETS[preset];
            const range = box.querySelector(`input[type="range"][data-layer="${CSS.escape(layerName)}"][data-trait="${CSS.escape(traitName)}"]`);
            const num = box.querySelector(`input[data-num="${CSS.escape(layerName+':'+traitName)}"]`);
            if (range) range.value = T.weight;
            if (num) num.value = T.weight;
            refreshExpectedCounts();
            schedulePreview("weights updated");
          }
        });
      });
    }
  });

  renderRules();
  refreshExpectedCounts();
}

function layerOptionsHTML(){ return layers.map(L=>`<option>${L.name}</option>`).join(""); }
function traitOptionsHTML(layerName, includeAny=false){
  const L = layers.find(x=>x.name===layerName);
  const items = (L?.traits || []).map(t=>`<option>${t.name}</option>`).join("");
  return includeAny ? `<option>*</option>${items}` : items;
}

/* ---------- Block Rules ---------- */
function renderBlockRules(){
  const el = $("blockRules"); if (!el) return;
  el.innerHTML = "";
  blockRules.forEach((r,i)=>{
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `
      <div>A</div>
      <select data-ba-layer="${i}">${layerOptionsHTML()}</select>
      <select data-ba-trait="${i}">${traitOptionsHTML(r.a[0], true)}</select>
      <div>B</div>
      <select data-bb-layer="${i}">${layerOptionsHTML()}</select>
      <select data-bb-trait="${i}">${traitOptionsHTML(r.b[0], true)}</select>
      <button data-b-remove="${i}">Remove</button>
    `;
    el.appendChild(row);

    row.querySelector(`[data-ba-layer="${i}"]`).value = r.a[0];
    row.querySelector(`[data-ba-trait="${i}"]`).value = r.a[1];
    row.querySelector(`[data-bb-layer="${i}"]`).value = r.b[0];
    row.querySelector(`[data-bb-trait="${i}"]`).value = r.b[1];

    row.querySelector(`[data-b-remove="${i}"]`).onclick = ()=>{
      blockRules = blockRules.filter((_,k)=>k!==i);
      renderBlockRules();
    };

    row.querySelector(`[data-ba-layer="${i}"]`).onchange = (e)=>{
      blockRules[i].a[0] = e.target.value;
      blockRules[i].a[1] = "*";
      renderBlockRules();
    };
    row.querySelector(`[data-bb-layer="${i}"]`).onchange = (e)=>{
      blockRules[i].b[0] = e.target.value;
      blockRules[i].b[1] = "*";
      renderBlockRules();
    };
    row.querySelector(`[data-ba-trait="${i}"]`).onchange = (e)=> blockRules[i].a[1] = e.target.value;
    row.querySelector(`[data-bb-trait="${i}"]`).onchange = (e)=> blockRules[i].b[1] = e.target.value;
  });
}

/* ---------- Force Rules ---------- */
function renderForceRules(){
  const el = $("forceRules"); if (!el) return;
  el.innerHTML = "";
  forceRules.forEach((r,i)=>{
    const wrap = document.createElement("div");
    wrap.className = "force-card";
    wrap.innerHTML = `
      <div class="force-head">
        <div>IF</div>
        <select data-f-if-layer="${i}">${layerOptionsHTML()}</select>
        <select data-f-if-trait="${i}">${traitOptionsHTML(r.if[0], false)}</select>
        <button data-f-remove="${i}">Remove</button>
      </div>
      <div id="f-then-${i}"></div>
      <button data-f-then-add="${i}">+ Add THEN require</button>
    `;
    el.appendChild(wrap);

    wrap.querySelector(`[data-f-if-layer="${i}"]`).value = r.if[0];
    wrap.querySelector(`[data-f-if-trait="${i}"]`).value = r.if[1];

    wrap.querySelector(`[data-f-remove="${i}"]`).onclick = ()=>{
      forceRules = forceRules.filter((_,k)=>k!==i);
      renderForceRules();
    };

    wrap.querySelector(`[data-f-if-layer="${i}"]`).onchange = (e)=>{
      forceRules[i].if[0] = e.target.value;
      const first = (layers.find(L=>L.name===e.target.value)?.traits?.[0]?.name) || "None";
      forceRules[i].if[1] = first;
      renderForceRules();
    };
    wrap.querySelector(`[data-f-if-trait="${i}"]`).onchange = (e)=> forceRules[i].if[1] = e.target.value;

    const thenDiv = wrap.querySelector(`#f-then-${i}`);
    r.thenRequire.forEach((pair,k)=>{
      const row = document.createElement("div");
      row.className = "force-then-row";
      row.innerHTML = `
        <div>THEN</div>
        <select data-f-then-layer="${i}:${k}">${layerOptionsHTML()}</select>
        <select data-f-then-trait="${i}:${k}">
          <option>*</option>${traitOptionsHTML(pair[0], false)}
        </select>
        <button data-f-then-remove="${i}:${k}">Remove</button>
      `;
      thenDiv.appendChild(row);

      row.querySelector(`[data-f-then-layer="${i}:${k}"]`).value = pair[0];
      row.querySelector(`[data-f-then-trait="${i}:${k}"]`).value = pair[1];

      row.querySelector(`[data-f-then-remove="${i}:${k}"]`).onclick = ()=>{
        forceRules[i].thenRequire.splice(k,1);
        renderForceRules();
      };

      row.querySelector(`[data-f-then-layer="${i}:${k}"]`).onchange = (e)=>{
        const [ii,kk] = e.target.getAttribute("data-f-then-layer").split(":").map(Number);
        forceRules[ii].thenRequire[kk][0] = e.target.value;
        forceRules[ii].thenRequire[kk][1] = "None";
        renderForceRules();
      };
      row.querySelector(`[data-f-then-trait="${i}:${k}"]`).onchange = (e)=>{
        const [ii,kk] = e.target.getAttribute("data-f-then-trait").split(":").map(Number);
        forceRules[ii].thenRequire[kk][1] = e.target.value;
      };
    });

    wrap.querySelector(`[data-f-then-add="${i}"]`).onclick = ()=>{
      forceRules[i].thenRequire.push([layers[0]?.name || "Layer", "None"]);
      renderForceRules();
    };
  });
}

function renderRules(){ renderBlockRules(); renderForceRules(); schedulePreview("rules updated"); }

/* ---------- Live Preview ---------- */
async function buildPreviewSelection(sorted, rules) {
  const maxAttempts = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const chosenNames = {};
    const traitByLayer = {};
    let failed = false;
    for (const L of sorted) {
      let candidates = L.traits.slice();
      candidates = candidates.filter(t => !violatesBlock(chosenNames, L.name, t.name, rules));
      candidates = narrowByForce(chosenNames, L.name, candidates, rules);
      if (!candidates.length) { failed = true; break; }
      const pick = weightedPick(candidates);
      chosenNames[L.name] = pick.name;
      traitByLayer[L.name] = pick;
    }
    if (failed) continue;
    applyForceCorrections(chosenNames, traitByLayer, sorted, rules);
    if (Object.entries(chosenNames).some(([LL,TT]) => violatesBlock(chosenNames, LL, TT, rules))) continue;
    return traitByLayer;
  }
  return null;
}

function schedulePreview(reason) {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => updatePreview(reason), 120);
}

async function updatePreview(reason) {
  const canvas = $("previewCanvas");
  const status = $("previewStatus");
  if (!canvas || !status) return;
  if (!layers.length) {
    status.textContent = "Load layers to start.";
    return;
  }

  const w = +$("w").value || 1024;
  const h = +$("h").value || 1024;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const sorted = [...layers].sort((a,b)=>a.order-b.order);
  status.textContent = "Rendering preview...";
  try {
    const traitByLayer = await buildPreviewSelection(sorted, { block: blockRules, force: forceRules });
    if (!traitByLayer) {
      status.textContent = "No valid preview combination found.";
      return;
    }
    const ctx = canvas.getContext("2d");
    await renderComposite(traitByLayer, sorted, canvas, ctx);
    status.textContent = reason ? `Preview updated (${reason}).` : "Preview updated.";
  } catch (err) {
    console.error(err);
    status.textContent = "Preview failed to render.";
  }
}

/* ---------- App wiring ---------- */
window.addEventListener("DOMContentLoaded", ()=>{
  $("btnLayers").onclick = async () => {
    dirPicker.value = "";
    dirPicker.onchange = async () => {
      const files = dirPicker.files;
      if (!files?.length) { alert("Folder selection was canceled or empty."); return; }
      $("layersPath").textContent = files[0].webkitRelativePath?.split("/")[0] || "(selected)";
      $("status").textContent = "Scanning images…";
      try {
        const w = +$("w").value || 1024;
        const h = +$("h").value || 1024;
        const parsed = await parseLayersFromFiles(files, w, h);
        parsed.forEach((L,i)=> L.order = i);
        parsed.forEach(L=>L.traits.forEach(t=>{
          if (typeof t.weight !== "number" || Number.isNaN(t.weight)) t.weight = t.isNone ? 0 : 60;
        }));
        layers = parsed;
        renderLayers();
        $("status").textContent = "Ready.";
        schedulePreview("layers loaded");
      } catch (e) {
        console.error(e);
        alert("Parse error: " + (e?.message || e));
        $("status").textContent = "Error.";
      }
    };
    dirPicker.click();
  };

  $("addBlock").onclick = ()=>{
    if (!layers.length) return alert("Load layers first.");
    const L0 = layers[0]?.name || "Layer";
    const L1 = layers[1]?.name || L0;
    blockRules.push({ a:[L0, "*"], b:[L1, "*"] });
    renderBlockRules();
  };

  $("addForce").onclick = ()=>{
    if (!layers.length) return alert("Load layers first.");
    const L0 = layers[0]?.name || "Layer";
    const firstTrait = layers[0]?.traits?.[0]?.name || "None";
    forceRules.push({ if:[L0, firstTrait], thenRequire:[[L0, "None"]] });
    renderForceRules();
  };

  $("expandAll").onclick = ()=>{
    layers.forEach(L=>expandedState.set(L.name, true));
    renderLayers();
  };
  $("collapseAll").onclick = ()=>{
    layers.forEach(L=>expandedState.set(L.name, false));
    renderLayers();
  };

  const previewBtn = $("previewRandomize");
  if (previewBtn) {
    previewBtn.addEventListener("click", () => updatePreview("randomized"));
  }

  $("btnGenerate").onclick = async () => {
    if (!layers.length) return alert("Pick an input folder first.");
    const w = +$("w").value || 1024;
    const h = +$("h").value || 1024;
    const supply = +$("supply").value || 100;
    const namePrefix = $("namePrefix").value || "FANG";
    const symbol = $("symbol").value || "FANG";
    const walletAddress = ($("wallet").value || "").trim() || "YOUR_WALLET";
    $("status").textContent = "Generating…";
    try {
      const result = await generateZip({
        layers,
        rules: { block: blockRules, force: forceRules },
        supply,
        canvasSize: { w, h },
        namePrefix,
        symbol,
        walletAddress
      });
      const minted = result?.minted ?? supply;
      const requested = result?.requested ?? supply;
      downloadBlob(result.zipBlob, "fang-output.zip");
      if (minted < requested) {
        $("status").textContent = `Done! Zipped ${minted}/${requested} unique images & metadata (download started).`;
        console.warn("Generation finished early – not enough unique combinations to satisfy supply.");
      } else {
        $("status").textContent = `Done! Zipped ${minted} images & metadata (download started).`;
      }
    } catch (e) {
      console.error(e);
      alert("Generate error: " + (e?.message || e));
      $("status").textContent = "Error.";
    }
  };

  $("supply").addEventListener("input", refreshExpectedCounts);
  $("supply").addEventListener("change", refreshExpectedCounts);

  $("w").addEventListener("change", () => schedulePreview("canvas size"));
  $("h").addEventListener("change", () => schedulePreview("canvas size"));
});
