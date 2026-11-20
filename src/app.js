/* Disaster monitor - front end. All data arrives inline as window.MONITOR_DATA (see scripts/build.py). */
(function () {
  "use strict";
  var D = window.MONITOR_DATA || {};
  var EV = D.event || {};
  var Q = D.usgs || null;
  var AF = ((D.aftershocks && D.aftershocks.items) || []).slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  var LIVE_MS = 5 * 60 * 1000;

  // ---------- language ----------
  var T = {
    en: {
      overview: "Overview", map: "Map", aftershocks: "Aftershocks", impacts: "Impacts", updates: "Updates", sources: "Sources & methods",
      unofficial: "Unofficial situational overview", keyFigures: "Key reported figures", hazard: "Hazard", magnitude: "Magnitude",
      depth: "Depth", maxInt: "Max. intensity (MMI)", pager: "PAGER alert", fatal: "Fatality alert", econ: "Economic alert",
      tsunami: "Tsunami flag", felt: "\"Did you feel it?\" reports", yes: "Yes", no: "No", exposure: "Population exposed by shaking intensity (USGS PAGER)",
      intensity: "Intensity", people: "People", shaking: "Perceived shaking", count: "Aftershocks recorded", largest: "Largest aftershock",
      last24: "In the last 24 h", noFigures: "No curated figures yet. Add rows to data/impacts.csv or the linked Google Sheet.",
      noUpdates: "No updates yet.", latestUpdates: "Latest updates", perDay: "Aftershocks per day", latest: "Most recent",
      time: "Time (UTC)", mag: "Mag.", place: "Location", refresh: "Refresh live from USGS", liveAt: "Live data as of",
      liveFail: "Live refresh failed - showing last built data.", date: "Date", category: "Category", value: "Value", area: "Area",
      source: "Source", note: "Note", builtAt: "Page built", usgsAt: "USGS data fetched", dataSources: "Data sources",
      official: "Official sources", methods: "Notes on method", epicentre: "Epicentre", mainshock: "Mainshock",
      older: "older", recent: "last 24 h", mmiLegend: "ShakeMap intensity (MMI)", noMap: "Map library could not load (offline?).",
      local: "local", radius: "within", of: "of epicentre", minMag: "magnitude", daysAfter: "days after the event",
      m1: "Hazard data are pulled automatically from USGS (event summary, ShakeMap, PAGER, aftershocks) every time the site rebuilds.",
      m2: "Reported impacts and updates are curated by the team from official and media sources and should be read as preliminary.",
      m3: "PAGER estimates are model outputs with wide uncertainty; use them to gauge scale, not as counts."
    },
    es: {
      overview: "Resumen", map: "Mapa", aftershocks: "Réplicas", impacts: "Impactos", updates: "Actualizaciones", sources: "Fuentes y métodos",
      unofficial: "Resumen situacional no oficial", keyFigures: "Cifras clave reportadas", hazard: "Amenaza", magnitude: "Magnitud",
      depth: "Profundidad", maxInt: "Intensidad máx. (MMI)", pager: "Alerta PAGER", fatal: "Alerta de víctimas", econ: "Alerta económica",
      tsunami: "Indicador de tsunami", felt: "Reportes \"¿Lo sintió?\"", yes: "Sí", no: "No", exposure: "Población expuesta por intensidad (USGS PAGER)",
      intensity: "Intensidad", people: "Personas", shaking: "Sacudida percibida", count: "Réplicas registradas", largest: "Mayor réplica",
      last24: "Últimas 24 h", noFigures: "Aún no hay cifras. Agregue filas en data/impacts.csv o en la hoja de Google vinculada.",
      noUpdates: "Aún no hay actualizaciones.", latestUpdates: "Últimas actualizaciones", perDay: "Réplicas por día", latest: "Más recientes",
      time: "Hora (UTC)", mag: "Mag.", place: "Ubicación", refresh: "Actualizar en vivo desde USGS", liveAt: "Datos en vivo a las",
      liveFail: "Falló la actualización - se muestran los últimos datos.", date: "Fecha", category: "Categoría", value: "Valor", area: "Área",
      source: "Fuente", note: "Nota", builtAt: "Página generada", usgsAt: "Datos USGS obtenidos", dataSources: "Fuentes de datos",
      official: "Fuentes oficiales", methods: "Notas metodológicas", epicentre: "Epicentro", mainshock: "Sismo principal",
      older: "anteriores", recent: "últimas 24 h", mmiLegend: "Intensidad ShakeMap (MMI)", noMap: "No se pudo cargar el mapa (¿sin conexión?).",
      local: "local", radius: "a menos de", of: "del epicentro", minMag: "magnitud", daysAfter: "días después del evento",
      m1: "Los datos de amenaza se obtienen automáticamente de USGS (resumen, ShakeMap, PAGER, réplicas) cada vez que se regenera el sitio.",
      m2: "Los impactos y actualizaciones son recopilados por el equipo de fuentes oficiales y de medios, y son preliminares.",
      m3: "Las estimaciones PAGER son resultados de modelos con alta incertidumbre; sirven para dimensionar, no como conteos."
    }
  };
  var langs = (EV.languages && EV.languages.length ? EV.languages : ["en"]).filter(function (l) { return T[l]; });
  if (!langs.length) langs = ["en"];
  var lang = langs[0];
  try { var saved = localStorage.getItem("monitor-lang"); if (saved && langs.indexOf(saved) >= 0) lang = saved; } catch (e) { /* storage blocked */ }
  function t(k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }
  function pick(obj) { return obj && typeof obj === "object" ? (obj[lang] || obj[langs[0]] || "") : (obj || ""); }

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function link(text, url) { var u = safeUrl(url); return u ? "<a href=\"" + esc(u) + "\" target=\"_blank\" rel=\"noopener\">" + esc(text || u) + "</a>" : esc(text); }
  function num(v) { var n = Number(String(v).replace(/[, ]/g, "")); return isFinite(n) && String(v).trim() !== "" ? n : null; }
  function fmtNum(v) { var n = num(v); return n === null ? esc(v) : n.toLocaleString(lang === "es" ? "es" : "en"); }
  function fmtTime(iso, tz) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    var o = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false };
    try { if (tz) o.timeZone = tz; return d.toLocaleString(lang, o); } catch (e) { o.timeZone = "UTC"; return d.toLocaleString(lang, o); }
  }
  function utc(iso) { return fmtTime(iso, "UTC") + " UTC"; }
  var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  var MMI_COLOR = ["#ffffff", "#ffffff", "#bfccff", "#a0e6ff", "#80ffff", "#7aff93", "#ffff00", "#ffc800", "#ff9100", "#ff0000", "#c80000"];
  var MMI_FEEL = {
    en: ["", "Not felt", "Weak", "Weak", "Light", "Moderate", "Strong", "Very strong", "Severe", "Violent", "Extreme"],
    es: ["", "No sentido", "Débil", "Débil", "Leve", "Moderado", "Fuerte", "Muy fuerte", "Severo", "Violento", "Extremo"]
  };
  function badge(level) { var l = (level || "").toLowerCase(); return l ? "<span class=\"badge " + esc(l) + "\">" + esc(l) + "</span>" : "<span class=\"badge none\">n/a</span>"; }

  // ---------- header, tabs ----------
  var TABS = ["overview", "map", "aftershocks", "impacts", "updates", "sources"];
  var current = "overview";
  try { var h = (location.hash || "").slice(1); if (TABS.indexOf(h) >= 0) current = h; } catch (e) { /* ignore */ }

  function renderHeader() {
    document.documentElement.lang = lang;
    $("eyebrow").textContent = t("unofficial") + (EV.country ? " · " + EV.country : "");
    $("title").textContent = pick(EV.title) || (Q && Q.title) || "Disaster monitor";
    var bits = [];
    if (Q) {
      if (Q.place) bits.push(esc(Q.place));
      if (Q.time_utc) {
        bits.push(utc(Q.time_utc) + (EV.local_timezone ? " (" + fmtTime(Q.time_utc, EV.local_timezone) + " " + t("local") + ")" : ""));
      }
    }
    $("subtitle").innerHTML = bits.join(" · ");
    $("alert-badge").innerHTML = Q ? t("pager") + " " + badge(Q.alert) : "";
    $("lang-switch").innerHTML = langs.length > 1 ? langs.map(function (l) {
      return "<button data-lang=\"" + l + "\" class=\"" + (l === lang ? "on" : "") + "\">" + l.toUpperCase() + "</button>";
    }).join("") : "";
    $("tabs").innerHTML = TABS.filter(function (k) { return k !== "aftershocks" || Q; }).map(function (k) {
      return "<button data-tab=\"" + k + "\" class=\"" + (k === current ? "on" : "") + "\">" + t(k) + "</button>";
    }).join("");
  }

  function show(tab) {
    current = tab;
    TABS.forEach(function (k) { var el = $("tab-" + k); if (el) el.classList.toggle("on", k === tab); });
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === tab); });
    try { history.replaceState(null, "", "#" + tab); } catch (e) { /* ignore */ }
    if (tab === "map") initMap();
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-tab")) show(b.getAttribute("data-tab"));
    if (b.hasAttribute("data-lang")) {
      lang = b.getAttribute("data-lang");
      try { localStorage.setItem("monitor-lang", lang); } catch (err) { /* ignore */ }
      renderAll();
    }
    if (b.id === "live-btn") liveRefresh();
  });

  // ---------- overview ----------
  function headlineFigures() {
    // latest row (by date) per category becomes a headline figure
    var by = {};
    (D.impacts || []).forEach(function (r) {
      var c = r.category; if (!c) return;
      if (!by[c] || (r.date || "") >= (by[c].date || "")) by[c] = r;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }

  function aftershockStats(items) {
    var now = Date.now(), last24 = 0, max = null;
    items.forEach(function (a) {
      if (now - new Date(a[0]).getTime() < 864e5) last24++;
      if (!max || a[1] > max[1]) max = a;
    });
    return { n: items.length, last24: last24, max: max };
  }

  function renderOverview() {
    var html = "<h2>" + t("keyFigures") + "</h2>";
    var figs = headlineFigures();
    html += figs.length ? "<div class=\"figs\">" + figs.map(function (r) {
      return "<div class=\"card fig\"><div class=\"v\">" + fmtNum(r.value) + "</div><div class=\"k\">" + esc(r.category) +
        (r.area ? " · " + esc(r.area) : "") + "</div><div class=\"s\">" + esc(r.date) + " · " + link(r.source, r.url) + "</div></div>";
    }).join("") + "</div>" : "<p class=\"empty card\">" + t("noFigures") + "</p>";

    html += "<div class=\"grid\">";
    if (Q) {
      var pg = Q.pager || {};
      html += "<div class=\"card\"><h3>" + t("hazard") + "</h3><dl class=\"kv\">" +
        "<dt>" + t("magnitude") + "</dt><dd>" + esc(Q.mag) + " " + esc(Q.mag_type || "") + "</dd>" +
        "<dt>" + t("depth") + "</dt><dd>" + (Q.depth_km != null ? Math.round(Q.depth_km) + " km" : "n/a") + "</dd>" +
        "<dt>" + t("maxInt") + "</dt><dd>" + (Q.max_mmi ? ROMAN[Math.round(Q.max_mmi)] + " (" + Number(Q.max_mmi).toFixed(1) + ")" : "n/a") + "</dd>" +
        "<dt>" + t("pager") + "</dt><dd>" + badge(Q.alert) + "</dd>" +
        (pg.fatality_alert ? "<dt>" + t("fatal") + "</dt><dd>" + badge(pg.fatality_alert) + "</dd>" : "") +
        (pg.economic_alert ? "<dt>" + t("econ") + "</dt><dd>" + badge(pg.economic_alert) + "</dd>" : "") +
        "<dt>" + t("tsunami") + "</dt><dd>" + (Q.tsunami ? t("yes") : t("no")) + "</dd>" +
        (Q.felt ? "<dt>" + t("felt") + "</dt><dd>" + fmtNum(Q.felt) + "</dd>" : "") +
        "</dl></div>";
      var s = aftershockStats(AF);
      html += "<div class=\"card\"><h3>" + t("aftershocks") + "</h3><dl class=\"kv\">" +
        "<dt>" + t("count") + "</dt><dd>" + fmtNum(s.n) + "</dd>" +
        "<dt>" + t("last24") + "</dt><dd>" + fmtNum(s.last24) + "</dd>" +
        (s.max ? "<dt>" + t("largest") + "</dt><dd>M" + esc(s.max[1]) + " · " + utc(s.max[0]) + "</dd>" : "") +
        "</dl></div>";
    }
    var ups = (D.updates || []).slice().sort(function (a, b) { return (b.time_utc || "").localeCompare(a.time_utc || ""); }).slice(0, 4);
    html += "<div class=\"card\"><h3>" + t("latestUpdates") + "</h3>" + (ups.length ? "<ul class=\"timeline\">" + ups.map(updateItem).join("") + "</ul>" : "<p class=\"empty\">" + t("noUpdates") + "</p>") + "</div>";
    html += "</div>";

    if (Q && Q.pager && Q.pager.exposure) {
      var rows = Q.pager.exposure.filter(function (r) { return r.mmi >= 4 && r.population > 0; }).reverse();
      if (rows.length) {
        html += "<div class=\"card\"><h3>" + t("exposure") + "</h3><table><thead><tr><th>" + t("intensity") + "</th><th>" + t("shaking") +
          "</th><th class=\"num\">" + t("people") + "</th></tr></thead><tbody>" + rows.map(function (r) {
            return "<tr><td><span class=\"sw\" style=\"background:" + MMI_COLOR[r.mmi] + "\"></span>" + ROMAN[r.mmi] + "</td><td>" +
              (MMI_FEEL[lang] || MMI_FEEL.en)[r.mmi] + "</td><td class=\"num\">" + fmtNum(r.population) + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }
    }
    $("tab-overview").innerHTML = html;
  }

  function updateItem(u) {
    return "<li><div class=\"t\">" + utc(u.time_utc) + (u.source ? " · " + link(u.source, u.url) : "") + "</div>" + esc(u.text) + "</li>";
  }

  // ---------- map ----------
  var map = null, quakeLayer = null;
  function initMap() {
    if (map) { setTimeout(function () { map.invalidateSize(); }, 50); return; }
    if (typeof L === "undefined") { $("map").innerHTML = "<p class=\"empty\" style=\"padding:20px\">" + t("noMap") + "</p>"; return; }
    var center = Q ? [Q.lat, Q.lon] : [0, 0];
    map = L.map("map", { scrollWheelZoom: true }).setView(center, Q ? 7 : 2);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 18, attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }).addTo(map);

    if (D.shakemap && D.shakemap.features) {
      var sm = L.geoJSON(D.shakemap, {
        style: function (f) {
          var v = Math.round((f.properties && (f.properties.value || f.properties.mmi)) || 0);
          return { color: (f.properties && f.properties.color) || MMI_COLOR[v] || "#888", weight: 2, opacity: 0.9 };
        },
        onEachFeature: function (f, l) { var v = f.properties && (f.properties.value || f.properties.mmi); if (v) l.bindTooltip("MMI " + v); }
      }).addTo(map);
      try { map.fitBounds(sm.getBounds(), { padding: [20, 20] }); } catch (e) { /* ignore */ }
    }
    quakeLayer = L.layerGroup().addTo(map);
    drawQuakes();
    if (Q) {
      L.marker([Q.lat, Q.lon], { title: t("epicentre") }).addTo(map)
        .bindPopup("<b>" + t("mainshock") + "</b><br>M" + esc(Q.mag) + " · " + utc(Q.time_utc) + "<br>" + link("USGS", Q.url));
    }
    $("map-legend").innerHTML = "<span><b>" + t("mmiLegend") + ":</b></span>" + [4, 5, 6, 7, 8, 9].map(function (i) {
      return "<span><span class=\"sw\" style=\"background:" + MMI_COLOR[i] + "\"></span>" + ROMAN[i] + "</span>";
    }).join("") + "<span><span class=\"sw dot\" style=\"background:#d7301f\"></span>" + t("aftershocks") + " (" + t("recent") + ")</span>" +
      "<span><span class=\"sw dot\" style=\"background:#6b8fb3\"></span>" + t("aftershocks") + " (" + t("older") + ")</span>";
  }

  function drawQuakes() {
    if (!map || !quakeLayer) return;
    quakeLayer.clearLayers();
    var now = Date.now();
    AF.forEach(function (a) {
      var recent = now - new Date(a[0]).getTime() < 864e5;
      L.circleMarker([a[2], a[3]], {
        radius: Math.max(2, (a[1] || 0) * 1.6), weight: 1, color: "#333", fillOpacity: 0.6,
        fillColor: recent ? "#d7301f" : "#6b8fb3"
      }).bindTooltip("M" + a[1] + " · " + utc(a[0]) + "<br>" + esc(a[5])).addTo(quakeLayer);
    });
  }

  // ---------- aftershocks ----------
  var liveNote = "";
  function renderAftershocks() {
    if (!Q) { $("tab-aftershocks").innerHTML = ""; return; }
    var a = (D.aftershocks && D.aftershocks.query) || EV.aftershocks || {};
    var html = "<div class=\"row\"><button class=\"btn\" id=\"live-btn\">" + t("refresh") + "</button><span class=\"note\" id=\"live-note\">" + liveNote + "</span></div>";
    html += "<p class=\"note\">USGS: " + t("minMag") + " ≥ " + esc(a.min_magnitude) + ", " + t("radius") + " " + esc(a.radius_km) + " km " + t("of") + ", " + esc(a.days) + " " + t("daysAfter") + ".</p>";
    html += "<div class=\"card chart\"><h3>" + t("perDay") + "</h3>" + dailyChart(AF) + "</div><br>";
    var latest = AF.slice(-100).reverse();
    html += "<h3>" + t("latest") + "</h3><div class=\"tablewrap\"><table><thead><tr><th>" + t("time") + "</th><th class=\"num\">" + t("mag") +
      "</th><th class=\"num\">" + t("depth") + "</th><th>" + t("place") + "</th></tr></thead><tbody>" + latest.map(function (q) {
        return "<tr><td>" + utc(q[0]) + "</td><td class=\"num\">" + esc(q[1]) + "</td><td class=\"num\">" + esc(q[4]) + " km</td><td>" +
          link(q[5], "https://earthquake.usgs.gov/earthquakes/eventpage/" + encodeURIComponent(q[6])) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    $("tab-aftershocks").innerHTML = html;
  }

  function dailyChart(items) {
    if (!items.length || !Q) return "<p class=\"empty\">-</p>";
    var start = new Date(Q.time_utc.slice(0, 10) + "T00:00:00Z").getTime();
    var counts = [];
    items.forEach(function (a) { var d = Math.floor((new Date(a[0]).getTime() - start) / 864e5); if (d >= 0) counts[d] = (counts[d] || 0) + 1; });
    for (var i = 0; i < counts.length; i++) counts[i] = counts[i] || 0;
    var W = 800, H = 220, pad = 30, max = Math.max.apply(null, counts) || 1, bw = (W - pad * 2) / counts.length;
    var bars = counts.map(function (c, i) {
      var h = (H - pad * 2) * c / max, x = pad + i * bw, y = H - pad - h;
      var day = new Date(start + i * 864e5).toISOString().slice(0, 10);
      return "<rect class=\"bar\" x=\"" + (x + 1).toFixed(1) + "\" y=\"" + y.toFixed(1) + "\" width=\"" + Math.max(1, bw - 2).toFixed(1) + "\" height=\"" + h.toFixed(1) + "\"><title>" + day + ": " + c + "</title></rect>";
    }).join("");
    var step = Math.ceil(counts.length / 8);
    var labels = counts.map(function (c, i) {
      if (i % step) return "";
      return "<text class=\"axis\" x=\"" + (pad + i * bw + bw / 2).toFixed(1) + "\" y=\"" + (H - 10) + "\" text-anchor=\"middle\">" + new Date(start + i * 864e5).toISOString().slice(5, 10) + "</text>";
    }).join("");
    return "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"" + t("perDay") + "\">" +
      "<text class=\"axis\" x=\"" + pad + "\" y=\"" + (pad - 10) + "\">max " + max + "</text>" + bars + labels + "</svg>";
  }

  function liveRefresh() {
    if (!Q) return;
    var btn = $("live-btn"); if (btn) btn.disabled = true;
    var a = (D.aftershocks && D.aftershocks.query) || EV.aftershocks || {};
    var start = new Date(Q.time_utc), end = new Date(Math.min(Date.now(), start.getTime() + (a.days || 30) * 864e5));
    var url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time-asc" +
      "&starttime=" + start.toISOString().slice(0, 19) + "&endtime=" + end.toISOString().slice(0, 19) +
      "&latitude=" + Q.lat + "&longitude=" + Q.lon + "&maxradiuskm=" + (a.radius_km || 250) + "&minmagnitude=" + (a.min_magnitude || 3);
    fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      AF = j.features.filter(function (f) { return f.id !== Q.id; }).map(function (f) {
        var c = f.geometry.coordinates;
        return [new Date(f.properties.time).toISOString().slice(0, 19) + "Z", f.properties.mag, c[1], c[0], Math.round((c[2] || 0) * 10) / 10, f.properties.place, f.id];
      });
      liveNote = t("liveAt") + " " + utc(new Date().toISOString());
      renderOverview(); renderAftershocks(); drawQuakes();
    }).catch(function () {
      liveNote = t("liveFail");
      var n = $("live-note"); if (n) n.textContent = liveNote;
      var b = $("live-btn"); if (b) b.disabled = false;
    });
  }

  // ---------- impacts, updates, sources ----------
  function renderImpacts() {
    var rows = (D.impacts || []).slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    $("tab-impacts").innerHTML = rows.length ? "<div class=\"tablewrap\"><table><thead><tr><th>" + t("date") + "</th><th>" + t("category") +
      "</th><th class=\"num\">" + t("value") + "</th><th>" + t("area") + "</th><th>" + t("source") + "</th><th>" + t("note") + "</th></tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.category) + "</td><td class=\"num\">" + fmtNum(r.value) + "</td><td>" + esc(r.area) +
          "</td><td>" + link(r.source, r.url) + "</td><td>" + esc(r.note) + "</td></tr>";
      }).join("") + "</tbody></table></div>" : "<p class=\"empty card\">" + t("noFigures") + "</p>";
  }

  function renderUpdates() {
    var ups = (D.updates || []).slice().sort(function (a, b) { return (b.time_utc || "").localeCompare(a.time_utc || ""); });
    $("tab-updates").innerHTML = ups.length ? "<ul class=\"timeline\">" + ups.map(updateItem).join("") + "</ul>" : "<p class=\"empty card\">" + t("noUpdates") + "</p>";
  }

  function renderSources() {
    var html = "<div class=\"grid\"><div class=\"card\"><h3>" + t("dataSources") + "</h3><ul>";
    if (Q) {
      var base = "https://earthquake.usgs.gov/earthquakes/eventpage/" + encodeURIComponent(Q.id);
      html += "<li>" + link("USGS event page", base) + "</li><li>" + link("USGS ShakeMap", base + "/shakemap") + "</li><li>" +
        link("USGS PAGER", base + "/pager") + "</li><li>" + link("USGS aftershock catalogue (FDSN)", "https://earthquake.usgs.gov/fdsnws/event/1/") + "</li>";
    }
    html += "</ul></div><div class=\"card\"><h3>" + t("official") + "</h3><ul>" + (EV.official_sources || []).map(function (s) {
      return "<li>" + link(s.name, s.url) + "</li>";
    }).join("") + "</ul></div></div>";
    html += "<div class=\"card\"><h3>" + t("methods") + "</h3><p>" + esc(pick(EV.disclaimer)) + "</p><ul><li>" + t("m1") + "</li><li>" + t("m2") + "</li>" +
      (Q ? "<li>" + t("m3") + "</li>" : "") + "</ul></div>";
    $("tab-sources").innerHTML = html;
  }

  function renderFooter() {
    $("footer").innerHTML = esc(EV.team || "") + (EV.contact ? " · " + esc(EV.contact) : "") + " · " + t("builtAt") + ": " + utc(D.built_at) +
      (Q && Q.fetched_at ? " · " + t("usgsAt") + ": " + utc(Q.fetched_at) : "") + "<br>" + esc(pick(EV.disclaimer));
  }

  function renderAll() {
    renderHeader(); renderOverview(); renderAftershocks(); renderImpacts(); renderUpdates(); renderSources(); renderFooter();
    show(current);
  }

  renderAll();
  if (Q) setInterval(function () { if (!document.hidden) liveRefresh(); }, LIVE_MS);
})();
