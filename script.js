// アイスランド全体を収める境界（少し余白を持たせている）
const ICELAND_BOUNDS = L.latLngBounds([62.9, -25.6], [67.0, -12.8]);

const map = L.map("map", {
  zoomControl: false,
  minZoom: 6,
  maxZoom: 17,
  maxBounds: ICELAND_BOUNDS.pad(0.15),
  maxBoundsViscosity: 1.0
}).setView([64.9, -18.5], 6);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
  noWrap: true,
  bounds: ICELAND_BOUNDS.pad(0.3)
}).addTo(map);

map.setMaxBounds(ICELAND_BOUNDS.pad(0.15));

const ordered = [...PHOTOS].sort((a, b) => new Date(a.date) - new Date(b.date));

// 移動ルート（Googleタイムラインのエクスポートデータから抽出した実際のGPS軌跡。日付ごとに色分け）

const routeBounds = [];
Object.keys(ROUTES_BY_DATE).sort().forEach(date => {
  const latlngs = ROUTES_BY_DATE[date];
  const color = DATE_COLORS[date] || "#0A84FF";
  L.polyline(latlngs, {
    color,
    weight: 3.5,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map).bindTooltip(DATE_LABELS[date] || date, { sticky: true, className: "route-tooltip" });
  latlngs.forEach(ll => routeBounds.push(ll));
});

// 凡例
const legend = document.getElementById("legend");
Object.keys(DATE_COLORS).sort().forEach(date => {
  const row = document.createElement("div");
  row.className = "legend-row";
  row.innerHTML = `<span class="swatch" style="background:${DATE_COLORS[date]}"></span>${DATE_LABELS[date] || date}`;
  legend.appendChild(row);
});

const legendToggle = document.getElementById("legend-toggle");
legendToggle.addEventListener("click", () => {
  legend.classList.toggle("collapsed");
  legendToggle.classList.toggle("collapsed");
});

const markers = {}; // id -> 現在地図上にある個別マーカー（クラスター化されている間は存在しない）
const photoLayer = L.layerGroup().addTo(map);

function makeIcon(file) {
  return L.divIcon({
    className: "photo-pin-wrap",
    html: `<div class="photo-pin"><img src="${file}" loading="lazy" /></div><div class="pin-tip"></div>`,
    iconSize: [46, 54],
    iconAnchor: [23, 50],
    popupAnchor: [0, -48]
  });
}

function makeClusterIcon(file, count) {
  return L.divIcon({
    className: "photo-pin-wrap",
    html: `<div class="photo-pin cluster"><img src="${file}" loading="lazy" /></div><span class="cluster-badge">${count}</span><div class="pin-tip"></div>`,
    iconSize: [46, 54],
    iconAnchor: [23, 50]
  });
}

function bindPhotoPopup(marker, p) {
  marker.bindPopup(`
    <img src="${p.thumb}" data-id="${p.id}" class="popup-img" />
    <div class="popup-body">
      <b>${p.title}</b>
      <span class="popup-date">${p.date}</span>
    </div>
  `, { closeButton: false, offset: [0, -6] });
  marker.on("popupopen", () => {
    const img = document.querySelector(`.leaflet-popup-content img[data-id="${p.id}"]`);
    if (img) img.addEventListener("click", () => openLightbox(p.id));
    highlightCard(p.id);
    document.getElementById(`pin-${p.id}`)?.classList.add("active-pin");
  });
  marker.on("popupclose", () => {
    document.getElementById(`pin-${p.id}`)?.classList.remove("active-pin");
  });
  marker.on("click", () => highlightCard(p.id));
  marker.on("add", () => {
    const el = marker.getElement();
    if (el) el.id = `pin-${p.id}`;
  });
}

// 近い写真ピンは重なって散らかって見えるため、画面上のピクセル距離でグループ化し、
// 近接するもの同士は1つの「まとめピン」として表示する（クリックでズームして展開）
const CLUSTER_PX = 44;

function renderPhotoMarkers() {
  photoLayer.clearLayers();
  Object.keys(markers).forEach(k => delete markers[k]);

  const zoom = map.getZoom();
  const items = ordered.map(p => ({ p, pt: map.latLngToContainerPoint([p.lat, p.lng]) }));
  const used = new Array(items.length).fill(false);

  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue;
    const group = [items[i]];
    used[i] = true;
    for (let j = i + 1; j < items.length; j++) {
      if (used[j]) continue;
      const d = Math.hypot(items[i].pt.x - items[j].pt.x, items[i].pt.y - items[j].pt.y);
      if (d < CLUSTER_PX) {
        group.push(items[j]);
        used[j] = true;
      }
    }

    if (group.length === 1) {
      const p = group[0].p;
      const marker = L.marker([p.lat, p.lng], { icon: makeIcon(p.thumb), riseOnHover: true });
      bindPhotoPopup(marker, p);
      marker.addTo(photoLayer);
      markers[p.id] = marker;
    } else {
      const avgLat = group.reduce((s, g) => s + g.p.lat, 0) / group.length;
      const avgLng = group.reduce((s, g) => s + g.p.lng, 0) / group.length;
      const marker = L.marker([avgLat, avgLng], {
        icon: makeClusterIcon(group[0].p.thumb, group.length),
        riseOnHover: true
      });
      // クラスターをクリックしたら、そのまとまりに含まれる写真だけを
      // ライトボックスで拡大表示（前後めくりでグループ内を閲覧できる）。
      const groupPhotos = group.map(g => g.p);
      marker.on("click", () => openLightbox(groupPhotos[0].id, groupPhotos));
      marker.addTo(photoLayer);
    }
  }
}

map.on("moveend", renderPhotoMarkers);
renderPhotoMarkers();

// サイドバーの一覧を生成
const list = document.getElementById("sidebar-list");
ordered.forEach((p, i) => {
  const card = document.createElement("div");
  card.className = "thumb-card";
  card.dataset.id = p.id;
  card.innerHTML = `
    <img src="${p.thumb}" alt="${p.title}" loading="lazy" />
    <div class="thumb-meta">
      <span class="num">${i + 1}</span>
      <div class="title">${p.title}</div>
      <div class="date">${p.date}</div>
    </div>
  `;
  // 一覧をクリックしたら、その写真をライトボックスで拡大表示（全写真をめくれる）
  card.addEventListener("click", () => openLightbox(p.id, ordered));
  list.appendChild(card);
});

function highlightCard(id) {
  document.querySelectorAll(".thumb-card").forEach(el => {
    const active = Number(el.dataset.id) === id;
    el.classList.toggle("active", active);
    if (active) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

// ライトボックス
// 表示中は「現在めくっている写真リスト(lightboxList)」と「その中の位置(lightboxPos)」を保持。
// クラスター由来ならそのグループ、一覧やポップアップ由来なら全写真リストを渡す。
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxTitle = document.getElementById("lightbox-title");
const lightboxDate = document.getElementById("lightbox-date");
const lightboxNote = document.getElementById("lightbox-note");
const lightboxCounter = document.getElementById("lightbox-counter");

let lightboxList = ordered;
let lightboxPos = 0;

function openLightbox(id, listOverride) {
  lightboxList = (listOverride && listOverride.length) ? listOverride : ordered;
  const pos = lightboxList.findIndex(p => p.id === id);
  showLightbox(pos < 0 ? 0 : pos);
}

function showLightbox(pos) {
  const n = lightboxList.length;
  lightboxPos = (pos + n) % n;
  const p = lightboxList[lightboxPos];
  lightboxImg.src = p.file;
  lightboxTitle.textContent = p.title;
  lightboxDate.textContent = p.date;
  lightboxNote.textContent = p.note || "";
  lightboxCounter.textContent = n > 1 ? `${lightboxPos + 1} / ${n}` : "";
  lightbox.classList.add("open");
  highlightCard(p.id);
}

document.getElementById("lightbox-close").addEventListener("click", () => {
  lightbox.classList.remove("open");
});
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.remove("open");
});
document.getElementById("lightbox-prev").addEventListener("click", () => {
  showLightbox(lightboxPos - 1);
});
document.getElementById("lightbox-next").addEventListener("click", () => {
  showLightbox(lightboxPos + 1);
});
document.addEventListener("keydown", (e) => {
  if (!lightbox.classList.contains("open")) return;
  if (e.key === "Escape") lightbox.classList.remove("open");
  if (e.key === "ArrowLeft") showLightbox(lightboxPos - 1);
  if (e.key === "ArrowRight") showLightbox(lightboxPos + 1);
});

// 全ピン・ルートが収まるようにフィット
// （レイアウト確定前にfitBoundsするとコンテナサイズを誤認するため、少し遅らせて実行）
const bounds = L.latLngBounds([
  ...ordered.map(p => [p.lat, p.lng]),
  ...routeBounds
]);
function fitToRoute() {
  map.invalidateSize();
  map.fitBounds(bounds, { padding: [50, 50] });
}
setTimeout(fitToRoute, 0);
window.addEventListener("load", fitToRoute);
