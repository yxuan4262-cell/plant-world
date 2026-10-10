import {
  adminHeaders,
  escapeHtml,
  formatCount,
  formatDate,
  getAssetPath,
  mountFlash,
  normalizeCollection,
  pickPlantImage,
  renderSiteShell,
  requestJson,
  requireAdmin,
  resolveMediaUrl
} from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
  let session;
  try {
    session = requireAdmin();
  } catch {
    return;
  }

  renderSiteShell("admin");

  const page = document.body.dataset.page;
  if (page === "adminDashboard") {
    await initDashboard(session);
  } else if (page === "adminPlants") {
    await initPlantsAdmin(session);
  } else if (page === "adminArticles") {
    await initArticlesAdmin(session);
  } else if (page === "adminMedia") {
    await initMediaAdmin(session);
  }
});

async function initDashboard(session) {
  const stats = document.querySelector("#admin-stats");
  const [plants, articles, media] = await Promise.all([
    requestJson("/api/admin/plants", { headers: adminHeaders(session) }),
    requestJson("/api/admin/articles", { headers: adminHeaders(session) }),
    requestJson("/api/admin/media", { headers: adminHeaders(session) })
  ]);

  const p = normalizeCollection(plants);
  const a = normalizeCollection(articles);
  const m = normalizeCollection(media);

  stats.innerHTML = `
    <article class="page-card"><h3>${formatCount(p.length)}</h3><p class="muted">植物条目</p></article>
    <article class="page-card"><h3>${formatCount(a.length)}</h3><p class="muted">文章条目</p></article>
    <article class="page-card"><h3>${formatCount(m.length)}</h3><p class="muted">素材条目</p></article>
  `;
}

async function initPlantsAdmin(session) {
  const flash = document.querySelector("[data-flash]");
  const list = document.querySelector("#admin-plant-list");
  const form = document.querySelector("#plant-form");
  const [plantsPayload, mediaPayload] = await Promise.all([
    requestJson("/api/admin/plants", { headers: adminHeaders(session) }),
    requestJson("/api/admin/media", { headers: adminHeaders(session) })
  ]);
  let plants = normalizeCollection(plantsPayload);
  const media = normalizeCollection(mediaPayload);
  const state = { currentId: null };

  ensureEditorTools(form, "plant", `
    <div class="admin-form-tools">
      <section class="admin-preview-card" id="plant-preview-panel"></section>
      <section class="admin-reference-card">
        <div class="admin-reference-head">
          <div>
            <h3>图库参考</h3>
            <p class="muted">点击素材可以作为封面图，也可以加入图库素材 ID。</p>
          </div>
          <button class="ghost-button" type="button" data-reset-form="plant">新建植物</button>
        </div>
        <div id="plant-media-reference" class="media-reference-grid"></div>
      </section>
    </div>
  `);

  const preview = document.querySelector("#plant-preview-panel");
  const mediaReference = document.querySelector("#plant-media-reference");
  document.querySelector('[data-reset-form="plant"]').addEventListener("click", () => resetPlantForm(form, state, preview));

  renderPlantMediaReference(mediaReference, media, form, preview);

  form.addEventListener("input", () => renderPlantPreview(preview, form, media, state.currentId));
  form.addEventListener("change", () => renderPlantPreview(preview, form, media, state.currentId));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = buildPlantPayload(formData);
    const id = String(formData.get("id") || "").trim();

    try {
      await requestJson(id ? `/api/admin/plants/${id}` : "/api/admin/plants", {
        method: id ? "PUT" : "POST",
        headers: adminHeaders(session),
        body: payload
      });
      plants = normalizeCollection(await requestJson("/api/admin/plants", { headers: adminHeaders(session) }));
      state.currentId = null;
      renderPlantList();
      resetPlantForm(form, state, preview);
      mountFlash(flash, id ? "植物已更新。" : "植物已新增。");
    } catch (error) {
      mountFlash(flash, error.message || "植物保存失败。", "error");
    }
  });

  function renderPlantList() {
    list.innerHTML = plants.length
      ? plants
          .map(
            plant => `
              <article class="admin-item ${state.currentId === plant.id ? "is-active" : ""}">
                <div class="admin-media-item">
                  <img src="${escapeHtml(pickPlantImage(plant))}" alt="${escapeHtml(plant.chineseName || "植物封面")}" />
                  <div class="admin-item-copy">
                    <div class="admin-item-head">
                      <strong>${escapeHtml(plant.chineseName || "未命名植物")}</strong>
                      <span>#${escapeHtml(String(plant.id || ""))}</span>
                    </div>
                    <p class="muted">${escapeHtml(plant.summary || plant.sceneTag || plant.category || "暂无摘要")}</p>
                    <div class="admin-item-actions">
                      <button class="ghost-button" type="button" data-edit="${plant.id}">编辑</button>
                      <button class="ghost-button danger-button" type="button" data-delete="${plant.id}">删除</button>
                    </div>
                  </div>
                </div>
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">暂无植物内容。</div>`;

    list.querySelectorAll("[data-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const plant = plants.find(item => Number(item.id) === Number(button.dataset.edit));
        state.currentId = plant?.id || null;
        fillPlantForm(form, plant);
        renderPlantPreview(preview, form, media, state.currentId);
        renderPlantList();
      });
    });

    list.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("确定删除这条植物内容吗？")) {
          return;
        }
        try {
          await requestJson(`/api/admin/plants/${button.dataset.delete}`, {
            method: "DELETE",
            headers: adminHeaders(session)
          });
          plants = plants.filter(item => Number(item.id) !== Number(button.dataset.delete));
          if (Number(button.dataset.delete) === state.currentId) {
            resetPlantForm(form, state, preview);
          }
          renderPlantList();
          mountFlash(flash, "植物已删除。");
        } catch (error) {
          mountFlash(flash, error.message || "植物删除失败。", "error");
        }
      });
    });
  }

  renderPlantPreview(preview, form, media, state.currentId);
  renderPlantList();
}

async function initArticlesAdmin(session) {
  const flash = document.querySelector("[data-flash]");
  const list = document.querySelector("#admin-article-list");
  const form = document.querySelector("#article-form");
  const [articlesPayload, plantsPayload, mediaPayload] = await Promise.all([
    requestJson("/api/admin/articles", { headers: adminHeaders(session) }),
    requestJson("/api/admin/plants", { headers: adminHeaders(session) }),
    requestJson("/api/admin/media", { headers: adminHeaders(session) })
  ]);
  let articles = normalizeCollection(articlesPayload);
  const plants = normalizeCollection(plantsPayload);
  const media = normalizeCollection(mediaPayload);
  const state = { currentId: null };

  ensureEditorTools(form, "article", `
    <div class="admin-form-tools">
      <section class="admin-preview-card" id="article-preview-panel"></section>
      <section class="admin-reference-card">
        <div class="admin-reference-head">
          <div>
            <h3>封面建议</h3>
            <p class="muted">未填写文章封面时，会根据标题与正文自动匹配相关植物图。</p>
          </div>
          <button class="ghost-button" type="button" data-reset-form="article">新建文章</button>
        </div>
        <div id="article-cover-reference" class="media-reference-grid"></div>
      </section>
    </div>
  `);

  const preview = document.querySelector("#article-preview-panel");
  const coverReference = document.querySelector("#article-cover-reference");
  document.querySelector('[data-reset-form="article"]').addEventListener("click", () =>
    resetArticleForm(form, state, preview, plants)
  );

  renderArticleReference(coverReference, plants, media, form, preview);

  form.addEventListener("input", () => renderArticlePreview(preview, form, plants, media, state.currentId));
  form.addEventListener("change", () => renderArticlePreview(preview, form, plants, media, state.currentId));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(form);
    const id = String(formData.get("id") || "").trim();
    const payload = {
      title: String(formData.get("title") || "").trim(),
      summary: String(formData.get("summary") || "").trim(),
      coverImageUrl: String(formData.get("coverImageUrl") || "").trim(),
      content: String(formData.get("content") || "").trim(),
      sourceName: String(formData.get("sourceName") || "").trim(),
      sourceUrl: String(formData.get("sourceUrl") || "").trim(),
      status: String(formData.get("status") || "PUBLISHED")
    };

    try {
      await requestJson(id ? `/api/admin/articles/${id}` : "/api/admin/articles", {
        method: id ? "PUT" : "POST",
        headers: adminHeaders(session),
        body: payload
      });
      articles = normalizeCollection(await requestJson("/api/admin/articles", { headers: adminHeaders(session) }));
      state.currentId = null;
      renderArticleList();
      resetArticleForm(form, state, preview, plants);
      mountFlash(flash, id ? "文章已更新。" : "文章已新增。");
    } catch (error) {
      mountFlash(flash, error.message || "文章保存失败。", "error");
    }
  });

  function renderArticleList() {
    list.innerHTML = articles.length
      ? articles
          .map(
            article => `
              <article class="admin-item ${state.currentId === article.id ? "is-active" : ""}">
                <div class="admin-media-item">
                  <img src="${escapeHtml(pickArticleCover(article, plants))}" alt="${escapeHtml(article.title || "文章封面")}" />
                  <div class="admin-item-copy">
                    <div class="admin-item-head">
                      <strong>${escapeHtml(article.title || "未命名文章")}</strong>
                      <span>#${escapeHtml(String(article.id || ""))}</span>
                    </div>
                    <p class="muted">${escapeHtml(article.summary || article.sourceName || "暂无摘要")}</p>
                    <small class="muted">${escapeHtml(formatDate(article.publishedAt || article.createdAt))}</small>
                    <div class="admin-item-actions">
                      <button class="ghost-button" type="button" data-edit="${article.id}">编辑</button>
                      <button class="ghost-button danger-button" type="button" data-delete="${article.id}">删除</button>
                    </div>
                  </div>
                </div>
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">暂无文章内容。</div>`;

    list.querySelectorAll("[data-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const article = articles.find(item => Number(item.id) === Number(button.dataset.edit));
        state.currentId = article?.id || null;
        fillArticleForm(form, article);
        renderArticlePreview(preview, form, plants, media, state.currentId);
        renderArticleList();
      });
    });

    list.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("确定删除这篇文章吗？")) {
          return;
        }
        try {
          await requestJson(`/api/admin/articles/${button.dataset.delete}`, {
            method: "DELETE",
            headers: adminHeaders(session)
          });
          articles = articles.filter(item => Number(item.id) !== Number(button.dataset.delete));
          if (Number(button.dataset.delete) === state.currentId) {
            resetArticleForm(form, state, preview, plants);
          }
          renderArticleList();
          mountFlash(flash, "文章已删除。");
        } catch (error) {
          mountFlash(flash, error.message || "文章删除失败。", "error");
        }
      });
    });
  }

  renderArticlePreview(preview, form, plants, media, state.currentId);
  renderArticleList();
}

async function initMediaAdmin(session) {
  const flash = document.querySelector("[data-flash]");
  const list = document.querySelector("#admin-media-list");
  const uploadForm = document.querySelector("#media-upload-form");
  const metaForm = document.querySelector("#media-meta-form");
  let media = normalizeCollection(await requestJson("/api/admin/media", { headers: adminHeaders(session) }));

  ensureEditorTools(metaForm, "media", `
    <div class="admin-form-tools">
      <section class="admin-preview-card" id="media-preview-panel"></section>
    </div>
  `);
  const preview = document.querySelector("#media-preview-panel");

  const renderList = () => {
    list.innerHTML = media.length
      ? media
          .map(
            item => `
              <article class="admin-item">
                <div class="admin-media-item">
                  <img src="${escapeHtml(resolveMediaUrl(item.url) || getAssetPath("hero.png"))}" alt="${escapeHtml(item.altText || item.originalName || "素材缩略图")}" />
                  <div class="admin-item-copy">
                    <div class="admin-item-head">
                      <strong>${escapeHtml(item.originalName || item.fileName || "未命名素材")}</strong>
                      <span>#${escapeHtml(String(item.id || ""))}</span>
                    </div>
                    <p class="muted">${escapeHtml(item.category || item.altText || item.url || "暂无描述")}</p>
                    <div class="admin-item-actions">
                      <button class="ghost-button" type="button" data-edit="${item.id}">编辑元数据</button>
                      <button class="ghost-button danger-button" type="button" data-delete="${item.id}">删除</button>
                    </div>
                  </div>
                </div>
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">暂无素材内容。</div>`;

    list.querySelectorAll("[data-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const item = media.find(entry => Number(entry.id) === Number(button.dataset.edit));
        fillMediaForm(metaForm, item);
        renderMediaPreview(preview, item);
      });
    });

    list.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("确定删除这条素材吗？")) {
          return;
        }
        try {
          await requestJson(`/api/admin/media/${button.dataset.delete}`, {
            method: "DELETE",
            headers: adminHeaders(session)
          });
          media = media.filter(item => Number(item.id) !== Number(button.dataset.delete));
          renderList();
          renderMediaPreview(preview, null);
          mountFlash(flash, "素材已删除。");
        } catch (error) {
          mountFlash(flash, error.message || "素材删除失败。", "error");
        }
      });
    });
  };

  uploadForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    try {
      await requestJson("/api/admin/media", {
        method: "POST",
        headers: adminHeaders(session),
        body: formData
      });
      media = normalizeCollection(await requestJson("/api/admin/media", { headers: adminHeaders(session) }));
      uploadForm.reset();
      renderList();
      mountFlash(flash, "素材已上传。");
    } catch (error) {
      mountFlash(flash, error.message || "素材上传失败。", "error");
    }
  });

  metaForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(metaForm);
    const id = String(formData.get("id") || "").trim();
    if (!id) {
      mountFlash(flash, "请先选择素材再编辑元数据。", "error");
      return;
    }

    try {
      await requestJson(`/api/admin/media/${id}`, {
        method: "PUT",
        headers: adminHeaders(session),
        body: {
          category: String(formData.get("category") || "").trim(),
          altText: String(formData.get("altText") || "").trim(),
          sourceName: String(formData.get("sourceName") || "").trim(),
          sourceUrl: String(formData.get("sourceUrl") || "").trim(),
          licenseName: String(formData.get("licenseName") || "").trim(),
          creatorName: String(formData.get("creatorName") || "").trim()
        }
      });
      media = normalizeCollection(await requestJson("/api/admin/media", { headers: adminHeaders(session) }));
      const current = media.find(item => Number(item.id) === Number(id)) || null;
      fillMediaForm(metaForm, current);
      renderMediaPreview(preview, current);
      renderList();
      mountFlash(flash, "素材元数据已更新。");
    } catch (error) {
      mountFlash(flash, error.message || "素材元数据保存失败。", "error");
    }
  });

  renderMediaPreview(preview, null);
  renderList();
}

function ensureEditorTools(form, marker, html) {
  if (!form || form.parentElement?.querySelector(`[data-editor-tools="${marker}"]`)) {
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.dataset.editorTools = marker;
  wrapper.innerHTML = html;
  form.insertAdjacentElement("afterend", wrapper);
}

function renderPlantMediaReference(target, media, form, preview) {
  const items = media.filter(item => item.category === "PLANT").slice(0, 12);
  target.innerHTML = items
    .map(
      item => `
        <button class="reference-thumb" type="button" data-media-id="${item.id}" data-url="${escapeHtml(resolveMediaUrl(item.url) || "")}">
          <img src="${escapeHtml(resolveMediaUrl(item.url) || getAssetPath("hero.png"))}" alt="${escapeHtml(item.altText || item.originalName || "植物素材")}" />
          <span>#${escapeHtml(String(item.id || ""))}</span>
        </button>
      `
    )
    .join("");

  target.querySelectorAll("[data-media-id]").forEach(button => {
    button.addEventListener("click", () => {
      const imageField = form.elements.namedItem("imageUrl");
      const galleryField = form.elements.namedItem("galleryAssetIds");
      const mediaId = String(button.dataset.mediaId || "");
      if (imageField && !imageField.value.trim()) {
        imageField.value = button.dataset.url || "";
      }
      if (galleryField) {
        const values = String(galleryField.value || "")
          .split(/[,\s，]+/)
          .map(value => value.trim())
          .filter(Boolean);
        if (!values.includes(mediaId)) {
          values.push(mediaId);
        }
        galleryField.value = values.join(", ");
      }
      renderPlantPreview(preview, form, media, null);
    });
  });
}

function renderPlantPreview(target, form, media, currentId) {
  const draft = buildPlantPayload(new FormData(form));
  const galleryIds = draft.galleryAssetIds || [];
  const gallery = galleryIds
    .map(id => media.find(item => Number(item.id) === Number(id)))
    .filter(Boolean)
    .map(item => resolveMediaUrl(item.url))
    .filter(Boolean);
  const cover = resolveMediaUrl(draft.imageUrl) || gallery[0] || getAssetPath("hero.png");

  target.innerHTML = `
    <div class="admin-preview-head">
      <div>
        <span class="eyebrow">${currentId ? "编辑中" : "植物预览"}</span>
        <h3>${escapeHtml(draft.chineseName || "未命名植物")}</h3>
      </div>
      ${currentId ? `<span class="chip-button">#${escapeHtml(String(currentId))}</span>` : ""}
    </div>
    <img class="admin-preview-image" src="${escapeHtml(cover)}" alt="${escapeHtml(draft.chineseName || "植物预览")}" />
    <p class="muted">${escapeHtml(draft.summary || "这里会实时预览植物卡片摘要和封面图。")}</p>
    <div class="fact-grid">
      ${[
        ["分类", draft.category],
        ["场景", draft.sceneTag],
        ["难度", draft.difficulty],
        ["光照", draft.lightPreference]
      ]
        .filter(([, value]) => value)
        .map(
          ([label, value]) => `
            <div class="fact-item">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
    ${
      gallery.length
        ? `
          <div class="detail-gallery">
            ${gallery.map(url => `<img src="${escapeHtml(url)}" alt="${escapeHtml(draft.chineseName || "植物图库")}" />`).join("")}
          </div>
        `
        : ""
    }
  `;
}

function resetPlantForm(form, state, preview) {
  form.reset();
  state.currentId = null;
  renderPlantPreview(preview, form, [], null);
}

function renderArticleReference(target, plants, media, form, preview) {
  const items = [...plants]
    .sort((left, right) => Number(right.hotScore || 0) - Number(left.hotScore || 0))
    .slice(0, 8);

  target.innerHTML = items
    .map(
      plant => `
        <button class="reference-thumb" type="button" data-cover-url="${escapeHtml(pickPlantImage(plant))}">
          <img src="${escapeHtml(pickPlantImage(plant))}" alt="${escapeHtml(plant.chineseName || "植物封面建议")}" />
          <span>${escapeHtml(plant.chineseName || "植物")}</span>
        </button>
      `
    )
    .join("");

  target.querySelectorAll("[data-cover-url]").forEach(button => {
    button.addEventListener("click", () => {
      const coverField = form.elements.namedItem("coverImageUrl");
      if (coverField) {
        coverField.value = button.dataset.coverUrl || "";
      }
      renderArticlePreview(preview, form, plants, media, null);
    });
  });
}

function renderArticlePreview(target, form, plants, media, currentId) {
  const draft = {
    title: String(form.elements.namedItem("title")?.value || "").trim(),
    summary: String(form.elements.namedItem("summary")?.value || "").trim(),
    coverImageUrl: String(form.elements.namedItem("coverImageUrl")?.value || "").trim(),
    content: String(form.elements.namedItem("content")?.value || "").trim(),
    sourceName: String(form.elements.namedItem("sourceName")?.value || "").trim(),
    sourceUrl: String(form.elements.namedItem("sourceUrl")?.value || "").trim(),
    status: String(form.elements.namedItem("status")?.value || "PUBLISHED").trim()
  };
  const cover = pickArticleCover(draft, plants);
  const relatedPlants = findRelatedPlants(draft, plants, 3);

  target.innerHTML = `
    <div class="admin-preview-head">
      <div>
        <span class="eyebrow">${currentId ? "编辑中" : "文章预览"}</span>
        <h3>${escapeHtml(draft.title || "未命名文章")}</h3>
      </div>
      <span class="chip-button">${escapeHtml(draft.status || "PUBLISHED")}</span>
    </div>
    <img class="admin-preview-image" src="${escapeHtml(cover)}" alt="${escapeHtml(draft.title || "文章封面预览")}" />
    <p class="muted">${escapeHtml(draft.summary || "封面为空时，会自动使用相关植物图片作为文章封面。")}</p>
    <div class="tag-list compact-tags">
      ${relatedPlants.map(plant => `<span>${escapeHtml(plant.chineseName || "相关植物")}</span>`).join("")}
    </div>
    <div class="admin-helper-list">
      <p><strong>来源：</strong>${escapeHtml(draft.sourceName || "站内内容")}</p>
      <p><strong>正文长度：</strong>${escapeHtml(String(draft.content.length || 0))} 字符</p>
      <p><strong>封面来源：</strong>${escapeHtml(resolveMediaUrl(draft.coverImageUrl) ? "手动填写" : relatedPlants[0]?.chineseName ? `自动匹配 ${relatedPlants[0].chineseName}` : "默认站点图片")}</p>
    </div>
  `;
}

function resetArticleForm(form, state, preview, plants) {
  form.reset();
  state.currentId = null;
  renderArticlePreview(preview, form, plants, [], null);
}

function renderMediaPreview(target, item) {
  if (!item) {
    target.innerHTML = `
      <div class="admin-preview-head">
        <div>
          <span class="eyebrow">素材预览</span>
          <h3>选择素材查看详情</h3>
        </div>
      </div>
      <p class="muted">在右侧点击任意素材后，这里会显示大图和元数据摘要。</p>
    `;
    return;
  }

  target.innerHTML = `
    <div class="admin-preview-head">
      <div>
        <span class="eyebrow">素材预览</span>
        <h3>${escapeHtml(item.originalName || item.fileName || "未命名素材")}</h3>
      </div>
      <span class="chip-button">#${escapeHtml(String(item.id || ""))}</span>
    </div>
    <img class="admin-preview-image" src="${escapeHtml(resolveMediaUrl(item.url) || getAssetPath("hero.png"))}" alt="${escapeHtml(item.altText || item.originalName || "素材预览")}" />
    <div class="admin-helper-list">
      <p><strong>分类：</strong>${escapeHtml(item.category || "-")}</p>
      <p><strong>ALT：</strong>${escapeHtml(item.altText || "-")}</p>
      <p><strong>来源：</strong>${escapeHtml(item.sourceName || "-")}</p>
      <p><strong>授权：</strong>${escapeHtml(item.licenseName || "-")}</p>
    </div>
  `;
}

function buildPlantPayload(formData) {
  return {
    chineseName: String(formData.get("chineseName") || "").trim(),
    latinName: String(formData.get("latinName") || "").trim(),
    aliasName: String(formData.get("aliasName") || "").trim(),
    imageUrl: String(formData.get("imageUrl") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    sceneTag: String(formData.get("sceneTag") || "").trim(),
    difficulty: String(formData.get("difficulty") || "").trim(),
    waterCycle: String(formData.get("waterCycle") || "").trim(),
    lightPreference: String(formData.get("lightPreference") || "").trim(),
    temperatureRange: String(formData.get("temperatureRange") || "").trim(),
    bloomSeason: String(formData.get("bloomSeason") || "").trim(),
    toxicityLevel: String(formData.get("toxicityLevel") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    featureText: String(formData.get("featureText") || "").trim(),
    careTips: String(formData.get("careTips") || "").trim(),
    scienceNote: String(formData.get("scienceNote") || "").trim(),
    poemTitle: String(formData.get("poemTitle") || "").trim(),
    poemAuthor: String(formData.get("poemAuthor") || "").trim(),
    poemExcerpt: String(formData.get("poemExcerpt") || "").trim(),
    galleryAssetIds: String(formData.get("galleryAssetIds") || "")
      .split(/[,\s，]+/)
      .map(value => Number(value.trim()))
      .filter(value => Number.isFinite(value) && value > 0),
    hotScore: Number(formData.get("hotScore") || 0) || null
  };
}

function fillPlantForm(form, plant) {
  form.reset();
  if (!plant) {
    return;
  }

  const values = {
    id: plant.id,
    chineseName: plant.chineseName,
    latinName: plant.latinName,
    aliasName: plant.aliasName,
    imageUrl: resolveMediaUrl(plant.imageUrl),
    category: plant.category,
    sceneTag: plant.sceneTag,
    difficulty: plant.difficulty,
    waterCycle: plant.waterCycle,
    lightPreference: plant.lightPreference,
    temperatureRange: plant.temperatureRange,
    bloomSeason: plant.bloomSeason,
    toxicityLevel: plant.toxicityLevel,
    summary: plant.summary,
    featureText: plant.featureText,
    careTips: plant.careTips,
    scienceNote: plant.scienceNote,
    poemTitle: plant.poemTitle,
    poemAuthor: plant.poemAuthor,
    poemExcerpt: plant.poemExcerpt,
    hotScore: plant.hotScore,
    galleryAssetIds: (plant.galleryImages || []).map(item => item.id).filter(Boolean).join(", ")
  };

  Object.entries(values).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) {
      field.value = value ?? "";
    }
  });
}

function fillArticleForm(form, article) {
  form.reset();
  if (!article) {
    return;
  }
  ["id", "title", "summary", "content", "sourceName", "sourceUrl", "status"].forEach(key => {
    const field = form.elements.namedItem(key);
    if (field) {
      field.value = article[key] ?? "";
    }
  });
  const coverField = form.elements.namedItem("coverImageUrl");
  if (coverField) {
    coverField.value = resolveMediaUrl(article.coverImageUrl);
  }
}

function fillMediaForm(form, media) {
  form.reset();
  if (!media) {
    return;
  }
  ["id", "category", "altText", "sourceName", "sourceUrl", "licenseName", "creatorName"].forEach(key => {
    const field = form.elements.namedItem(key);
    if (field) {
      field.value = media[key] ?? "";
    }
  });
}

function pickArticleCover(article, plants) {
  const matchedPlant = findRelatedPlants(article, plants, 1)[0] || pickFallbackPlant(article, plants);
  return resolveMediaUrl(article?.coverImageUrl) || pickPlantImage(matchedPlant) || getAssetPath("hero.png");
}

function findRelatedPlants(article, plants, limit = 3) {
  if (!article || !plants.length) {
    return [];
  }

  const articleText = normalizeText([article.title, article.summary, article.content, article.sourceName]);

  return [...plants]
    .map(plant => ({ plant, score: scorePlantAgainstText(articleText, plant) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || Number(right.plant.hotScore || 0) - Number(left.plant.hotScore || 0))
    .slice(0, limit)
    .map(item => item.plant);
}

function scorePlantAgainstText(articleText, plant) {
  const keywords = [
    plant?.chineseName,
    plant?.latinName,
    plant?.aliasName,
    plant?.category,
    plant?.sceneTag
  ]
    .filter(Boolean)
    .flatMap(value => String(value).split(/[\/,，、·|\s]+/))
    .map(normalizeText)
    .filter(Boolean);

  let score = 0;
  keywords.forEach(keyword => {
    if (keyword.length >= 2 && articleText.includes(keyword)) {
      score += keyword === normalizeText(plant.chineseName) ? 8 : 4;
    }
  });

  if (articleText.includes("花") && normalizeText([plant.category, plant.bloomSeason]).includes("花")) {
    score += 2;
  }
  if (articleText.includes("叶") && normalizeText([plant.category, plant.featureText]).includes("叶")) {
    score += 2;
  }
  if (articleText.includes("有毒") && /毒|刺激/.test(normalizeText(plant.toxicityLevel))) {
    score += 3;
  }
  if (articleText.includes("安全") && normalizeText(plant.toxicityLevel).includes("安全")) {
    score += 2;
  }

  return score;
}

function pickFallbackPlant(article, plants) {
  if (!plants.length) {
    return null;
  }

  const articleText = normalizeText([article?.title, article?.summary, article?.content, article?.sourceName]);
  const sorted = [...plants].sort((left, right) => Number(right.hotScore || 0) - Number(left.hotScore || 0));

  if (articleText.includes("有毒")) {
    return sorted.find(plant => /毒|刺激/.test(normalizeText(plant.toxicityLevel))) || sorted[0];
  }
  if (articleText.includes("花")) {
    return sorted.find(plant => normalizeText([plant.category, plant.bloomSeason]).includes("花")) || sorted[0];
  }
  if (articleText.includes("叶")) {
    return sorted.find(plant => normalizeText([plant.category, plant.featureText]).includes("叶")) || sorted[0];
  }
  return sorted[0];
}

function normalizeText(values) {
  return (Array.isArray(values) ? values.join(" ") : String(values || ""))
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, " ")
    .trim();
}
