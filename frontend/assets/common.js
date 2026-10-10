const SESSION_KEY = "plantvision.front.session";
const API_BASE_KEY = "plantvision.api.base";

export const API_BASE =
  localStorage.getItem(API_BASE_KEY) ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:8080"
    : "");

export const routes = {
  home: "index.html",
  login: "login.html",
  register: "register.html",
  recognition: "recognition.html",
  plants: "plants.html",
  articles: "articles.html",
  article: "article.html",
  history: "history.html",
  adminDashboard: "admin/dashboard.html",
  adminPlants: "admin/plants.html",
  adminArticles: "admin/articles.html",
  adminMedia: "admin/media.html"
};

export function getBasePath() {
  return document.body.dataset.basePath || "./";
}

export function linkTo(routeKey, extra = "") {
  return `${getBasePath()}${routes[routeKey]}${extra}`;
}

export function getAssetPath(fileName) {
  return `${getBasePath()}assets/${fileName}`;
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function isAdmin(session = getSession()) {
  return session?.user?.role === "ADMIN";
}

export function requireAuth() {
  const session = getSession();
  if (!session?.user) {
    location.href = linkTo("login");
    throw new Error("AUTH_REQUIRED");
  }
  return session;
}

export function requireAdmin() {
  const session = requireAuth();
  if (!isAdmin(session)) {
    location.href = linkTo("home");
    throw new Error("ADMIN_REQUIRED");
  }
  return session;
}

export function redirectAfterLogin(session) {
  location.href = isAdmin(session) ? linkTo("adminDashboard") : linkTo("home");
}

export function redirectIfAuthenticated() {
  const session = getSession();
  if (session?.user) {
    redirectAfterLogin(session);
  }
}

export async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || text || `请求失败：${response.status}`);
  }

  return data ?? text;
}

export function adminHeaders(session = getSession()) {
  return { "X-Admin-Username": session?.user?.username || "" };
}

export function renderSiteShell(mode = "public") {
  const session = getSession();
  const page = document.body.dataset.page;
  const header = document.querySelector("[data-site-header]");
  const footer = document.querySelector("[data-site-footer]");

  if (header) {
    header.innerHTML =
      mode === "admin"
        ? renderAdminHeader(page, session)
        : renderPublicHeader(page, session);
  }

  if (footer) {
    footer.innerHTML = `
      <div class="shell">
        <p>叶语识界 · 植物识别、图鉴与科普阅读平台</p>
      </div>
    `;
  }

  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => {
      clearSession();
      location.href = linkTo("login");
    });
  });
}

function renderBrandMarkup(mode = "public") {
  const logo = `<span class="brand-badge"><img src="${getAssetPath(
    "site-logo.jpg"
  )}" alt="叶语识界 Logo" /></span>`;

  if (mode === "admin") {
    return `
      ${logo}
      <span class="brand-copy">
        <strong>叶语识界后台</strong>
        <small>植物识别与内容管理平台</small>
      </span>
    `;
  }

  return `
    ${logo}
    <span class="brand-copy">
      <strong>叶语识界</strong>
      <small>植物识别与科普平台</small>
    </span>
  `;
}

function renderPublicHeader(page, session) {
  const links = [
    ["home", "首页"],
    ["recognition", "植物识别"],
    ["plants", "植物图鉴"],
    ["articles", "科普文章"],
    ["history", "识别记录"]
  ];

  const userActions = session?.user
    ? `
        <span class="chip-button">
          ${escapeHtml(session.user.displayName || session.user.username)}
        </span>
        ${
          isAdmin(session)
            ? `<a href="${linkTo("adminDashboard")}">管理后台</a>`
            : ""
        }
        <button type="button" data-logout>退出</button>
      `
    : `
        <a href="${linkTo("login")}">登录</a>
        <a href="${linkTo("register")}">注册</a>
      `;

  return `
    <div class="shell site-header-bar">
      <a class="brand" href="${linkTo("home")}">
        ${renderBrandMarkup("public")}
      </a>
      <nav class="nav-links">
        ${links
          .map(
            ([key, label]) => `
              <a href="${linkTo(key)}" class="${page === key ? "is-active" : ""}">
                ${escapeHtml(label)}
              </a>
            `
          )
          .join("")}
      </nav>
      <div class="nav-actions">${userActions}</div>
    </div>
  `;
}

function renderAdminHeader(page, session) {
  const links = [
    ["adminDashboard", "概览"],
    ["adminPlants", "植物管理"],
    ["adminArticles", "文章管理"],
    ["adminMedia", "素材管理"]
  ];

  return `
    <div class="shell site-header-bar">
      <a class="brand" href="${linkTo("adminDashboard")}">
        ${renderBrandMarkup("admin")}
      </a>
      <nav class="nav-links">
        ${links
          .map(
            ([key, label]) => `
              <a href="${linkTo(key)}" class="${page === key ? "is-active" : ""}">
                ${escapeHtml(label)}
              </a>
            `
          )
          .join("")}
        <a href="${linkTo("home")}">返回前台</a>
      </nav>
      <div class="nav-actions">
        <span class="chip-button">
          ${escapeHtml(
            session?.user?.displayName || session?.user?.username || "管理员"
          )}
        </span>
        <button type="button" data-logout>退出</button>
      </div>
    </div>
  `;
}

export function mountFlash(target, message, tone = "") {
  if (!target) {
    return;
  }
  target.innerHTML = message
    ? `<div class="flash ${tone === "error" ? "is-error" : ""}">${escapeHtml(message)}</div>`
    : "";
}

export function normalizeCollection(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.value)) {
    return payload.value;
  }
  return [];
}

export function formatDate(value, withTime = false) {
  if (!value) {
    return "时间待补充";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  });
}

export function formatCount(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value || 0));
}

export function resolveMediaUrl(value) {
  const url = String(value || "").trim();
  if (!url) {
    return "";
  }
  if (
    /^(?:https?:)?\/\//i.test(url) ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${API_BASE}${url}`;
  }
  return url;
}

export function pickPlantImage(plant) {
  return (
    resolveMediaUrl(plant?.imageUrl) ||
    resolveMediaUrl(plant?.galleryImages?.[0]?.url) ||
    getAssetPath("hero.png")
  );
}

export function queryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
