import {
  escapeHtml,
  formatCount,
  formatDate,
  getAssetPath,
  linkTo,
  mountFlash,
  normalizeCollection,
  pickPlantImage,
  queryParam,
  renderSiteShell,
  resolveMediaUrl,
  requestJson,
  requireAuth
} from "./common.js";

const INTERACTIVE_BUTTON_SELECTOR = [
  ".nav-links a",
  ".nav-actions a",
  ".nav-actions button",
  ".ghost-button",
  ".page-card-link",
  ".primary-button",
  ".mini-link"
].join(", ");

document.addEventListener("DOMContentLoaded", async () => {
  try {
    requireAuth();
  } catch {
    return;
  }

  renderSiteShell("public");
  initInteractiveButtons();

  const page = document.body.dataset.page;
  try {
    if (page === "home") {
      await initHome();
    } else if (page === "recognition") {
      await initRecognition();
    } else if (page === "plants") {
      await initPlants();
    } else if (page === "articles") {
      await initArticles();
    } else if (page === "article") {
      await initArticleDetail();
    } else if (page === "history") {
      await initHistory();
    }
  } catch (error) {
    renderPublicPageError(page, error);
  }
});

async function initHome() {
  const heroBox = document.querySelector("#home-hero");
  const cardsBox = document.querySelector("#home-cards");
  const plantRibbon = document.querySelector("#home-plant-ribbon");
  const scenesBox = document.querySelector("#home-scenes");
  const readingBox = document.querySelector("#home-reading");
  const disclaimerBox = document.querySelector("#home-disclaimer");
  const [home, stats, plantsPayload, articlesPayload] = await Promise.all([
    requestJson("/api/content/home"),
    requestJson("/api/dashboard/stats"),
    requestJson("/api/plants"),
    requestJson("/api/articles")
  ]);

  const plants = normalizeCollection(plantsPayload);
  const articles = sortArticlesByDate(normalizeCollection(articlesPayload));
  const daily =
    hydratePlant(home?.dailyRecommendation?.plant, plants) || plants[0] || null;
  const rankedPlants = [...plants].sort(
    (left, right) => Number(right.hotScore || 0) - Number(left.hotScore || 0)
  );
  const featuredPlants = rankedPlants.slice(0, 6);
  const featuredArticle = articles[0] || null;
  const secondaryArticles = articles.slice(1, 4);
  const scienceTips = Array.isArray(home?.scienceTips) ? home.scienceTips.slice(0, 3) : [];
  const sceneHighlights = pickSceneHighlights(
    rankedPlants.length ? rankedPlants : plants,
    3
  );
  const dailyHref = daily?.id ? linkTo("plants", `?id=${daily.id}`) : linkTo("plants");
  const featuredArticleHref = featuredArticle?.id
    ? linkTo("article", `?id=${featuredArticle.id}`)
    : linkTo("articles");
  const homeVideoSrc = buildHomeVideoEmbedUrl("BV1Jd4y117EX");
  const heroStats = [
    { label: "植物条目", value: formatCount(stats?.plantCount) },
    { label: "植物分类", value: formatCount(stats?.categoryCount) },
    { label: "场景标签", value: formatCount(stats?.sceneCount) },
    { label: "识别记录", value: formatCount(stats?.recognitionCount) }
  ];
  heroBox.innerHTML = `
    <section class="home-hero-shell">
      <article class="home-hero-spotlight">
        <div class="home-hero-media">
          <img
            src="${escapeHtml(
              daily ? pickPlantImage(daily) : getAssetPath("hero.png")
            )}"
            alt="${escapeHtml(daily?.chineseName || "今日植物推荐")}"
          />
        </div>
        <div class="home-hero-copy">
          <div class="home-hero-badges">
            <span class="eyebrow">今日推荐</span>
            <span class="home-status-pill">
              ${escapeHtml(daily?.sceneTag || daily?.category || "植物观察")}
            </span>
          </div>
          <h1>识别、浏览、了解身边植物</h1>
          <p class="panel-subtitle">
            上传照片识别植物，查看图鉴信息、场景和养护建议。
          </p>
          <section class="home-video-feature">
            <div class="home-video-head">
              <strong>植物科普视频</strong>
            </div>
            <div class="home-video-frame">
              <iframe
                src="${escapeHtml(homeVideoSrc)}"
                title="植物科普视频"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
              ></iframe>
            </div>
          </section>
          <div class="hero-actions home-hero-actions">
            <a class="page-card-link" href="${linkTo("recognition")}">开始识别</a>
            <a class="ghost-button" href="${linkTo("plants")}">浏览图鉴</a>
            <a class="ghost-button" href="${linkTo("articles")}">科普阅读</a>
          </div>
          <div class="home-hero-metrics">
            ${heroStats
              .map(
                item => `
                  <article class="home-metric-card">
                    <strong>${escapeHtml(item.value)}</strong>
                    <span>${escapeHtml(item.label)}</span>
                  </article>
                `
              )
              .join("")}
          </div>
        </div>
      </article>
      <aside class="home-hero-side">
        <article class="home-side-card home-side-card-feature">
          <div class="home-side-head">
            <span class="eyebrow">今日植物</span>
            <span class="home-side-tag">
              ${escapeHtml(daily?.lightPreference || "今日推荐")}
            </span>
          </div>
          <a class="home-side-feature" href="${dailyHref}">
            <img
              src="${escapeHtml(
                daily ? pickPlantImage(daily) : getAssetPath("hero.png")
              )}"
              alt="${escapeHtml(daily?.chineseName || "今日推荐植物")}"
            />
            <div>
              <h3>${escapeHtml(daily?.chineseName || "今日植物")}</h3>
              <p class="muted">
                ${escapeHtml(
                  summarizeText(
                    daily?.summary || daily?.sceneTag || "查看今日推荐植物档案。",
                    48
                  )
                )}
              </p>
            </div>
          </a>
        </article>
        <article class="home-side-card home-side-card-outline">
          <div class="home-side-head">
            <span class="eyebrow">热门场景</span>
            <span class="home-side-tag">快速进入</span>
          </div>
          <div class="home-focus-list">
            ${
              sceneHighlights.length
                ? sceneHighlights
                    .map(
                      item => `
                        <a
                          class="home-focus-item"
                          href="${
                            item?.id
                              ? linkTo("plants", `?id=${item.id}`)
                              : linkTo("plants")
                          }"
                        >
                          <strong>${escapeHtml(
                            item.sceneTag || item.category || "重点观察"
                          )}</strong>
                          <span>
                            ${escapeHtml(item.chineseName || "植物样本")} ·
                            ${escapeHtml(
                              summarizeText(
                                item.summary || item.category || "查看相关植物。",
                                26
                              )
                            )}
                          </span>
                        </a>
                      `
                    )
                    .join("")
                : `<div class="empty-state">暂时还没有可展示的场景焦点。</div>`
            }
          </div>
        </article>
      </aside>
    </section>
  `;

  cardsBox.innerHTML = featuredPlants.length
    ? buildHomeSilhouetteSection(featuredPlants)
    : "";

  plantRibbon.innerHTML = featuredPlants.length
    ? featuredPlants
        .map(
          (plant, index) => `
            <a
              class="home-ribbon-card"
              href="${
                plant?.id ? linkTo("plants", `?id=${plant.id}`) : linkTo("plants")
              }"
            >
                <div class="home-ribbon-media">
                  <img
                    src="${escapeHtml(pickPlantImage(plant))}"
                    alt="${escapeHtml(plant.chineseName || "热门植物")}"
                  />
                <span class="home-ribbon-badge">热度 ${index + 1}</span>
              </div>
              <div class="home-ribbon-copy">
                <strong>${escapeHtml(plant.chineseName || "植物")}</strong>
                <p class="muted">
                  ${escapeHtml(
                    summarizeText(
                      plant.summary ||
                        plant.sceneTag ||
                        plant.category ||
                        "查看植物详情。",
                      52
                    )
                  )}
                </p>
                <div class="tag-list compact-tags">
                  ${[plant.sceneTag, plant.category, plant.difficulty]
                    .filter(Boolean)
                    .slice(0, 3)
                    .map(value => `<span>${escapeHtml(value)}</span>`)
                    .join("")}
                </div>
                <span class="mini-link">查看详情</span>
              </div>
            </a>
          `
        )
        .join("")
    : `<div class="empty-state">暂无可展示的植物图鉴内容。</div>`;

  scenesBox.innerHTML = `
    <section class="panel home-section-panel">
      <div class="section-heading">
        <div>
          <h2>按生活场景浏览</h2>
        </div>
      </div>
      <div class="home-scene-list">
        ${
          sceneHighlights.length
            ? sceneHighlights
                .map(
                  item => `
                    <a
                      class="home-scene-card"
                      href="${
                        item?.id
                          ? linkTo("plants", `?id=${item.id}`)
                          : linkTo("plants")
                      }"
                    >
                      <img
                        src="${escapeHtml(pickPlantImage(item))}"
                        alt="${escapeHtml(
                          item.chineseName || item.sceneTag || "场景植物"
                        )}"
                      />
                      <div>
                        <strong>${escapeHtml(
                          item.sceneTag || item.category || "专题场景"
                        )}</strong>
                        <p class="muted">
                          ${escapeHtml(item.chineseName || "植物样本")} ·
                          ${escapeHtml(
                            summarizeText(
                              item.summary ||
                                item.category ||
                                "进入该场景查看相关植物。",
                              34
                            )
                          )}
                        </p>
                      </div>
                    </a>
                  `
                )
                .join("")
            : `<div class="empty-state">暂无场景内容。</div>`
        }
      </div>
    </section>
  `;

  readingBox.innerHTML = `
    <section class="panel home-section-panel">
      <div class="section-heading">
        <div>
          <h2>推荐阅读</h2>
        </div>
        <a class="ghost-button" href="${linkTo("articles")}">全部文章</a>
      </div>
      <div class="home-reading-lead">
        ${
          featuredArticle
            ? `
                <a class="home-reading-main" href="${featuredArticleHref}">
                  <img
                    src="${escapeHtml(
                      pickArticleImage(featuredArticle, plants)
                    )}"
                    alt="${escapeHtml(featuredArticle.title || "文章封面")}"
                  />
                  <div class="home-reading-copy">
                    <h3>${escapeHtml(featuredArticle.title || "推荐文章")}</h3>
                    <p class="muted">
                      ${escapeHtml(
                        summarizeText(
                          featuredArticle.summary ||
                            "阅读本周推荐的植物科普内容。",
                          92
                        )
                      )}
                    </p>
                    <div class="card-actions">
                      <span class="chip-button">
                        ${escapeHtml(featuredArticle.sourceName || "站内内容")}
                      </span>
                      <span class="chip-button">
                        ${escapeHtml(
                          formatDate(
                            featuredArticle.publishedAt ||
                              featuredArticle.createdAt
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </a>
              `
            : `<div class="empty-state">暂无文章内容。</div>`
        }
      </div>
      <div class="home-reading-list">
        ${
          secondaryArticles.length
            ? secondaryArticles
                .map(
                  item => `
                    <a
                      class="home-reading-item"
                      href="${
                        item?.id
                          ? linkTo("article", `?id=${item.id}`)
                          : linkTo("articles")
                      }"
                    >
                      <strong>${escapeHtml(item.title || "未命名文章")}</strong>
                      <p class="muted">
                        ${escapeHtml(
                          summarizeText(
                            item.summary ||
                              item.sourceName ||
                              "继续阅读这篇内容。",
                            68
                          )
                        )}
                      </p>
                    </a>
                  `
                )
                .join("")
            : `<div class="empty-state">暂无延伸阅读内容。</div>`
        }
      </div>
    </section>
  `;

  if (disclaimerBox) {
    disclaimerBox.innerHTML = `
      <div class="home-disclaimer">
        <p>（本网站免费仅为科普作用，如发生侵权，请联系我们的邮箱2148342613@qq.com）</p>
      </div>
    `;
  }
}

async function initRecognition() {
  const flash = document.querySelector("[data-flash]");
  const preview = document.querySelector("#preview");
  const result = document.querySelector("#result");
  const tips = document.querySelector("#recognition-tips");
  const fileInput = document.querySelector("#recognition-file");
  const form = document.querySelector("#recognition-form");
  const submitButton = form?.querySelector('button[type="submit"]');
  let currentFile = null;
  let previewUrl = "";
  let submitting = false;

  tips.innerHTML = `
    <div class="tip-card">
      <h3>提升识别准确率</h3>
      <div class="tips-list">
        <p class="muted">优先上传清晰、完整的植物照片。</p>
        <p class="muted">尽量拍到叶片、花果或整体株形等关键特征。</p>
        <p class="muted">识别完成后可直接进入对应图鉴继续查看。</p>
      </div>
    </div>
  `;

  preview.innerHTML = `<div class="empty-state">上传照片后，这里会显示预览。</div>`;

  fileInput.addEventListener("change", () => {
    currentFile = fileInput.files?.[0] || null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }

    if (!currentFile) {
      preview.innerHTML = `<div class="empty-state">请选择一张植物照片。</div>`;
      return;
    }

    if (!String(currentFile.type || "").startsWith("image/")) {
      currentFile = null;
      fileInput.value = "";
      mountFlash(flash, "请选择图片文件。", "error");
      preview.innerHTML = `<div class="empty-state">请选择一张植物照片。</div>`;
      return;
    }

    previewUrl = URL.createObjectURL(currentFile);
    preview.innerHTML = `
      <div class="recognition-drop">
        <img src="${previewUrl}" alt="待识别植物图片" />
        <strong>${escapeHtml(currentFile.name)}</strong>
        <span class="muted">${(currentFile.size / 1024 / 1024).toFixed(2)} MB</span>
      </div>
    `;
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (!currentFile) {
      mountFlash(flash, "请先选择图片。", "error");
      return;
    }

    try {
      submitting = true;
      mountFlash(flash, "");
      fileInput.disabled = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "识别中...";
      }
      result.innerHTML = `<div class="result-panel">正在识别，请稍候...</div>`;
      const data = await requestJson("/api/recognitions/identify", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.append("image", currentFile);
          return formData;
        })()
      });

      result.innerHTML = renderRecognitionResult(data);
    } catch (error) {
      mountFlash(flash, error.message || "识别失败。", "error");
      result.innerHTML = "";
    } finally {
      submitting = false;
      fileInput.disabled = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "开始识别";
      }
    }
  });
}

function renderRecognitionResult(data) {
  const matched = data?.matchedPlant;
  const candidates = data?.candidates || [];

  return `
    <div class="result-panel">
      <h3>${escapeHtml(data?.message || "识别完成")}</h3>
      ${
        matched
          ? `
              <div class="detail-list">
                <p><strong>匹配植物：</strong>${escapeHtml(matched.chineseName || "未命名植物")}</p>
                <p class="muted">${escapeHtml(matched.summary || matched.featureText || "")}</p>
                <div class="result-actions">
                  <a
                    class="page-card-link"
                    href="${linkTo("plants", `?id=${matched.id || ""}`)}"
                  >
                    查看植物图鉴详情
                  </a>
                </div>
              </div>
            `
          : `<p class="muted">暂未匹配到明确图鉴，可先参考下面的候选结果。</p>`
      }
      <div class="candidate-list">
        ${
          candidates.length
            ? candidates
                .map(
                  item => `
                    <article class="score-row">
                      <strong>
                        <span>${escapeHtml(item.name || "未命名候选项")}</span>
                        <span>${escapeHtml(String(item.confidence || 0))}%</span>
                      </strong>
                      <div class="score-track">
                        <span style="width:${Math.min(
                          Number(item.confidence || 0),
                          100
                        )}%"></span>
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<div class="empty-state">暂无候选结果。</div>`
        }
      </div>
    </div>
  `;
}

async function initPlants() {
  const flash = document.querySelector("[data-flash]");
  const grid = document.querySelector("#plant-grid");
  const detail = document.querySelector("#plant-detail");
  const form = document.querySelector("#plant-filters");
  const plants = normalizeCollection(await requestJson("/api/plants"));
  const queryId = Number(queryParam("id") || 0);
  const state = { selectedId: queryId || plants[0]?.id || null };

  setupPlantFilters(form, plants);
  render();

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("reset", () => {
    window.setTimeout(render, 0);
  });

  function render() {
    try {
      mountFlash(flash, "");
      const formData = new FormData(form);
      const filters = {
        search: String(formData.get("search") || "")
          .trim()
          .toLowerCase(),
        scene: String(formData.get("scene") || ""),
        category: String(formData.get("category") || ""),
        difficulty: String(formData.get("difficulty") || ""),
        light: String(formData.get("light") || ""),
        toxicity: String(formData.get("toxicity") || ""),
        sort: String(formData.get("sort") || "hot")
      };

      const filtered = applyPlantFilters(plants, filters);
      if (!filtered.find(item => item.id === state.selectedId)) {
        state.selectedId = filtered[0]?.id || null;
      }

      grid.innerHTML = filtered.length
        ? filtered
            .map(
              plant => `
                <article class="plant-card ${
                  state.selectedId === plant.id ? "is-selected" : ""
                }">
                  <button type="button" data-plant-id="${plant.id}">
                    <img
                      src="${escapeHtml(pickPlantImage(plant))}"
                      alt="${escapeHtml(plant.chineseName || "植物图片")}"
                    />
                    <div class="card-copy">
                      <h3>${escapeHtml(plant.chineseName || "未命名植物")}</h3>
                      <p class="muted">
                        ${escapeHtml(
                          plant.summary || plant.featureText || "点击查看详情"
                        )}
                      </p>
                      <div class="tag-list">
                        ${[
                          plant.sceneTag,
                          plant.category,
                          plant.difficulty,
                          plant.lightPreference,
                          plant.toxicityLevel
                        ]
                          .filter(Boolean)
                          .slice(0, 4)
                          .map(value => `<span>${escapeHtml(value)}</span>`)
                          .join("")}
                      </div>
                    </div>
                  </button>
                </article>
              `
            )
            .join("")
        : `<div class="empty-state">没有符合当前筛选条件的植物。</div>`;

      const selected = filtered.find(item => item.id === state.selectedId) || filtered[0];
      detail.innerHTML = selected
        ? renderPlantDetail(selected)
        : `<div class="empty-state">请选择植物查看详情。</div>`;

      grid.querySelectorAll("[data-plant-id]").forEach(button => {
        button.addEventListener("click", () => {
          state.selectedId = Number(button.dataset.plantId);
          render();
        });
      });
    } catch (error) {
      mountFlash(flash, error.message || "植物数据加载失败。", "error");
    }
  }
}

function applyPlantFilters(plants, filters) {
  const filtered = plants.filter(plant => {
    const searchBase = [
      plant.chineseName,
      plant.aliasName,
      plant.latinName,
      plant.category,
      plant.sceneTag,
      plant.difficulty,
      plant.lightPreference,
      plant.toxicityLevel
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!filters.search || searchBase.includes(filters.search)) &&
      (!filters.scene || plant.sceneTag === filters.scene) &&
      (!filters.category || plant.category === filters.category) &&
      (!filters.difficulty || plant.difficulty === filters.difficulty) &&
      (!filters.light || plant.lightPreference === filters.light) &&
      (!filters.toxicity || plant.toxicityLevel === filters.toxicity)
    );
  });

  const sorter =
    filters.sort === "alpha"
      ? (left, right) =>
          String(left.chineseName || "").localeCompare(
            String(right.chineseName || ""),
            "zh-CN"
          )
      : (left, right) =>
          Number(right.hotScore || 0) - Number(left.hotScore || 0);

  return filtered.sort(sorter);
}

function setupPlantFilters(form, plants) {
  const configs = [
    ["scene", "sceneTag", "全部场景"],
    ["category", "category", "全部分类"],
    ["difficulty", "difficulty", "全部难度"],
    ["light", "lightPreference", "全部光照"],
    ["toxicity", "toxicityLevel", "全部毒性"]
  ];

  configs.forEach(([fieldName, plantKey, placeholder]) => {
    const select = form?.elements?.namedItem(fieldName);
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const currentValue = select.value;
    const values = [...new Set(plants.map(plant => plant?.[plantKey]).filter(Boolean))].sort(
      (left, right) => String(left).localeCompare(String(right), "zh-CN")
    );

    select.innerHTML = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    ].join("");
    select.value = values.includes(currentValue) ? currentValue : "";
  });
}

function renderPlantDetail(plant) {
  if (!plant) {
    return `<div class="empty-state">请选择植物查看详情。</div>`;
  }

  const gallery = pickGalleryImages(plant).slice(0, 4);
  const videoQuery = buildPlantVideoQuery(plant);
  const videoResources = buildPlantVideoResources(plant, videoQuery);
  const facts = [
    ["场景", plant.sceneTag],
    ["分类", plant.category],
    ["难度", plant.difficulty],
    ["浇水", plant.waterCycle],
    ["光照", plant.lightPreference],
    ["温度", plant.temperatureRange],
    ["花期", plant.bloomSeason],
    ["毒性", plant.toxicityLevel]
  ].filter(([, value]) => value);

  return `
    <article class="detail-panel">
      <img
        src="${escapeHtml(pickPlantImage(plant))}"
        alt="${escapeHtml(plant.chineseName || "植物详情")}"
      />
      ${
        gallery.length > 1
          ? `
              <div class="detail-gallery">
                ${gallery
                  .slice(1)
                  .map(
                    url => `
                      <img
                        src="${escapeHtml(url)}"
                        alt="${escapeHtml(plant.chineseName || "植物图库")}"
                      />
                    `
                  )
                  .join("")}
              </div>
            `
          : ""
      }
      <h3>${escapeHtml(plant.chineseName || "未命名植物")}</h3>
      ${plant.latinName ? `<p class="muted">${escapeHtml(plant.latinName)}</p>` : ""}
      <p>${escapeHtml(plant.summary || plant.featureText || "暂无摘要。")}</p>
      <div class="fact-grid">
        ${facts
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
      <section class="plant-video-panel">
        <div class="plant-video-head">
          <div>
            <span class="eyebrow">相关视频</span>
            <h4>${escapeHtml(plant.chineseName || "植物")} 视频讲解</h4>
          </div>
        </div>
        <div class="plant-video-card">
          <a
            class="plant-video-poster"
            href="${escapeHtml(videoResources[0].url)}"
            target="_blank"
            rel="noreferrer"
            aria-label="打开 ${escapeHtml(plant.chineseName || "植物")} 的视频讲解"
          >
            <img
              src="${escapeHtml(pickPlantImage(plant))}"
              alt="${escapeHtml(plant.chineseName || "植物")} 视频讲解封面"
            />
            <span class="plant-video-play">观看视频</span>
          </a>
          <div class="plant-video-copy">
            <strong>查看养护与识别相关视频</strong>
            <div class="plant-video-actions">
              ${videoResources
                .map(
                  resource => `
                    <a
                      class="ghost-button"
                      href="${escapeHtml(resource.url)}"
                      target="_blank"
                      rel="noreferrer"
                    >
                      ${escapeHtml(resource.label)}
                    </a>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      </section>
      <div class="detail-list">
        ${
          plant.featureText
            ? `<p><strong>识别特征：</strong>${escapeHtml(plant.featureText)}</p>`
            : ""
        }
        ${
          plant.careTips
            ? `<p><strong>养护建议：</strong>${escapeHtml(plant.careTips)}</p>`
            : ""
        }
        ${
          plant.scienceNote
            ? `<p><strong>科学笔记：</strong>${escapeHtml(plant.scienceNote)}</p>`
            : ""
        }
        ${
          plant.poemExcerpt
            ? `<p><strong>${escapeHtml(
                plant.poemTitle || "诗意摘录"
              )}：</strong>${escapeHtml(plant.poemExcerpt)}</p>`
            : ""
        }
      </div>
    </article>
  `;
}

function buildPlantVideoQuery(plant) {
  const baseName = String(plant?.chineseName || "").trim();
  const scene = String(plant?.sceneTag || "").trim();
  const category = String(plant?.category || "").trim();
  const topic = scene || category || "植物";
  return `${baseName} ${topic} 养护`;
}

function buildPlantVideoResources(plant, videoQuery) {
  const chineseQuery = encodeURIComponent(videoQuery);

  return [
    {
      label: "B站讲解",
      url: `https://search.bilibili.com/all?keyword=${chineseQuery}`
    },
    {
      label: "抖音视频",
      url: `https://www.douyin.com/search/${chineseQuery}?type=video`
    }
  ];
}

async function initArticles() {
  const list = document.querySelector("#article-list");
  const input = document.querySelector("#article-search");
  const [articlesPayload, plantsPayload] = await Promise.all([
    requestJson("/api/articles"),
    requestJson("/api/plants")
  ]);
  const articles = sortArticlesByDate(normalizeCollection(articlesPayload));
  const plants = normalizeCollection(plantsPayload);

  const render = () => {
    const keyword = input.value.trim().toLowerCase();
    const filtered = articles.filter(article =>
      [article.title, article.summary, article.content, article.sourceName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );

    list.innerHTML = filtered.length
      ? filtered.map(article => renderArticleCard(article, plants)).join("")
      : `<div class="empty-state">没有匹配的文章。</div>`;
  };

  input.addEventListener("input", render);
  render();
}

function renderArticleCard(article, plants) {
  const relatedPlants = findRelatedPlants(article, plants, 2);
  return `
    <article class="article-card">
      <a href="${linkTo("article", `?id=${article.id || ""}`)}">
        <img
          src="${escapeHtml(pickArticleImage(article, plants))}"
          alt="${escapeHtml(article.title || "文章封面")}"
        />
        <div class="card-copy">
          <h3>${escapeHtml(article.title || "未命名文章")}</h3>
          <p class="muted">
            ${escapeHtml(article.summary || "点击阅读完整内容。")}
          </p>
          ${
            relatedPlants.length
              ? `
                  <div class="tag-list compact-tags">
                    ${relatedPlants
                      .map(
                        plant => `
                          <span>${escapeHtml(plant.chineseName || "相关植物")}</span>
                        `
                      )
                      .join("")}
                  </div>
                `
              : ""
          }
          <div class="card-actions">
            <span class="chip-button">
              ${escapeHtml(article.sourceName || "站内内容")}
            </span>
            <span class="chip-button">
              ${escapeHtml(formatDate(article.publishedAt || article.createdAt))}
            </span>
          </div>
        </div>
      </a>
    </article>
  `;
}

async function initArticleDetail() {
  const container = document.querySelector("#article-detail");
  const id = Number(queryParam("id") || 0);
  const [articlesPayload, plantsPayload] = await Promise.all([
    requestJson("/api/articles"),
    requestJson("/api/plants")
  ]);
  const articles = sortArticlesByDate(normalizeCollection(articlesPayload));
  const plants = normalizeCollection(plantsPayload);
  const article = articles.find(item => Number(item.id) === id);

  if (!article) {
    container.innerHTML = `<div class="empty-state">没有找到对应文章。</div>`;
    return;
  }

  const relatedPlants = findRelatedPlants(article, plants, 3);
  const nextArticles = articles
    .filter(item => Number(item.id) !== id)
    .slice(0, 2);
  const paragraphs = splitArticleParagraphs(article.content);
  const highlights = buildArticleHighlights(article, paragraphs, relatedPlants);
  const leadParagraph = paragraphs[0] || article.summary || "";
  const bodyParagraphs = paragraphs.slice(1);

  container.innerHTML = `
    <section class="article-feature">
      <div class="article-feature-media">
        <img
          src="${escapeHtml(pickArticleImage(article, plants))}"
          alt="${escapeHtml(article.title || "文章封面")}"
        />
      </div>
      <div class="article-feature-copy">
        <span class="eyebrow">文章详情</span>
        <div class="article-meta-bar">
          <span class="chip-button">
            ${escapeHtml(article.sourceName || "站内内容")}
          </span>
          <span class="chip-button">
            ${escapeHtml(formatDate(article.publishedAt || article.createdAt))}
          </span>
          <span class="chip-button">
            ${escapeHtml(`${estimateReadingMinutes(article.content)} 分钟阅读`)}
          </span>
        </div>
        <h1>${escapeHtml(article.title || "未命名文章")}</h1>
        ${
          article.summary
            ? `<p class="panel-subtitle article-feature-summary">${escapeHtml(
                article.summary
              )}</p>`
            : ""
        }
        <div class="article-highlight-row">
          ${highlights
            .map(
              item => `
                <article class="article-highlight-card">
                  <strong>${escapeHtml(item.title)}</strong>
                  <p>${escapeHtml(item.text)}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    </section>
    <section class="article-story-layout">
      <article class="panel article-reading-panel">
        ${leadParagraph ? `<p class="article-lead">${escapeHtml(leadParagraph)}</p>` : ""}
        <div class="detail-list article-body">
          ${bodyParagraphs
            .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
            .join("")}
        </div>
        <div class="article-bottom-actions">
          <a class="page-card-link" href="${linkTo("articles")}">返回文章列表</a>
          ${
            article.sourceUrl
              ? `
                  <a
                    class="ghost-button"
                    href="${escapeHtml(article.sourceUrl)}"
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看原始来源
                  </a>
                `
              : ""
          }
        </div>
      </article>
      <aside class="article-side-rail">
        <section class="detail-panel article-side-panel">
          <h3>阅读导览</h3>
          <div class="article-outline-list">
            ${highlights
              .map(
                item => `
                  <div class="article-outline-item">
                    <strong>${escapeHtml(item.title)}</strong>
                    <p class="muted">${escapeHtml(item.text)}</p>
                  </div>
                `
              )
              .join("")}
          </div>
        </section>
        <section class="detail-panel article-side-panel">
          <h3>相关植物</h3>
          <div class="article-related-list">
            ${
              relatedPlants.length
                ? relatedPlants
                    .map(
                      plant => `
                        <a
                          class="article-related-card"
                          href="${linkTo("plants", `?id=${plant.id || ""}`)}"
                        >
                          <img
                            src="${escapeHtml(pickPlantImage(plant))}"
                            alt="${escapeHtml(plant.chineseName || "相关植物")}"
                          />
                          <div>
                            <strong>${escapeHtml(plant.chineseName || "相关植物")}</strong>
                            <p class="muted">
                              ${escapeHtml(
                                plant.summary || plant.sceneTag || plant.category || ""
                              )}
                            </p>
                          </div>
                        </a>
                      `
                    )
                    .join("")
                : `<div class="empty-state">暂未匹配到相关植物。</div>`
            }
          </div>
        </section>
        <section class="detail-panel article-side-panel">
          <h3>继续阅读</h3>
          <div class="article-next-list">
            ${
              nextArticles.length
                ? nextArticles
                    .map(
                      item => `
                        <a
                          class="article-next-card"
                          href="${linkTo("article", `?id=${item.id || ""}`)}"
                        >
                          <img
                            src="${escapeHtml(pickArticleImage(item, plants))}"
                            alt="${escapeHtml(item.title || "延伸阅读")}"
                          />
                          <div>
                            <strong>${escapeHtml(item.title || "未命名文章")}</strong>
                            <p class="muted">
                              ${escapeHtml(
                                item.summary || item.sourceName || "继续阅读"
                              )}
                            </p>
                          </div>
                        </a>
                      `
                    )
                    .join("")
                : `<div class="empty-state">暂无更多文章。</div>`
            }
          </div>
        </section>
      </aside>
    </section>
  `;
}

async function initHistory() {
  const container = document.querySelector("#history-list");
  const [itemsPayload, plantsPayload] = await Promise.all([
    requestJson("/api/recognitions/history"),
    requestJson("/api/plants")
  ]);
  const items = normalizeCollection(itemsPayload);
  const plants = normalizeCollection(plantsPayload);
  container.innerHTML = items.length
    ? items
        .map(
          item => {
            const matchedPlant = findPlantByRecognizedName(item, plants);
            const detailHref = matchedPlant?.id
              ? linkTo("plants", `?id=${matchedPlant.id}`)
              : linkTo("plants");

            return `
            <article class="history-card">
              <a href="${detailHref}">
                <img
                  src="${escapeHtml(
                    resolveMediaUrl(item.imageUrl) || getAssetPath("hero.png")
                  )}"
                  alt="${escapeHtml(item.recognizedName || "识别记录")}"
                />
                <div class="card-copy">
                  <h3>${escapeHtml(item.recognizedName || "待确认植物")}</h3>
                  <p class="muted">${escapeHtml(item.imageName || "上传图片")}</p>
                  <div class="card-actions">
                    <span class="chip-button">
                      ${escapeHtml(
                        item.confidence
                          ? `${item.confidence}%`
                          : item.recognitionMode || "记录"
                      )}
                    </span>
                    <span class="chip-button">
                      ${escapeHtml(formatDate(item.createdAt, true))}
                    </span>
                  </div>
                </div>
              </a>
            </article>
          `;
          }
        )
        .join("")
    : `<div class="empty-state">还没有识别记录。</div>`;
}

function initInteractiveButtons() {
  if (document.body.dataset.buttonFxReady === "true") {
    return;
  }

  document.body.dataset.buttonFxReady = "true";
  document.addEventListener("click", handleInteractiveButtonClick, true);
}

function handleInteractiveButtonClick(event) {
  if (event.defaultPrevented) {
    return;
  }

  const trigger = event.target.closest(INTERACTIVE_BUTTON_SELECTOR);
  if (!trigger) {
    return;
  }

  playInteractiveButtonEffect(trigger, event);

  if (
    trigger.tagName !== "A" ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const href = trigger.getAttribute("href");
  const target = trigger.getAttribute("target");
  if (!href || href.startsWith("#") || target === "_blank" || trigger.hasAttribute("download")) {
    return;
  }

  event.preventDefault();
  window.setTimeout(() => {
    location.href = trigger.href;
  }, 180);
}

function playInteractiveButtonEffect(trigger, event) {
  const rect = trigger.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.18;
  const ripple = document.createElement("span");
  const originX = event.clientX > 0 ? event.clientX - rect.left : rect.width / 2;
  const originY = event.clientY > 0 ? event.clientY - rect.top : rect.height / 2;

  trigger.classList.remove("is-pressed");
  void trigger.offsetWidth;
  trigger.classList.add("is-pressed");

  ripple.className = "button-ripple";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${originX - size / 2}px`;
  ripple.style.top = `${originY - size / 2}px`;
  trigger.appendChild(ripple);

  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  window.setTimeout(() => {
    trigger.classList.remove("is-pressed");
  }, 260);
}

function renderPublicPageError(page, error) {
  console.error(error);
  const message = "页面加载失败，请确认后端服务已启动后再刷新。";
  const flash = document.querySelector("[data-flash]");
  mountFlash(flash, message, "error");

  if (page === "home") {
    const heroBox = document.querySelector("#home-hero");
    const cardsBox = document.querySelector("#home-cards");
    const plantRibbon = document.querySelector("#home-plant-ribbon");
    const scenesBox = document.querySelector("#home-scenes");
    const readingBox = document.querySelector("#home-reading");
    const disclaimerBox = document.querySelector("#home-disclaimer");

    if (heroBox) {
      heroBox.innerHTML = `<div class="panel empty-state">${message}</div>`;
    }

    [cardsBox, plantRibbon, scenesBox, readingBox, disclaimerBox].forEach(node => {
      if (node) {
        node.innerHTML = "";
      }
    });
    return;
  }

  const fallbackSelectors = {
    plants: ["#plant-grid", "#plant-detail"],
    articles: ["#article-list"],
    article: ["#article-detail"],
    history: ["#history-list"],
    recognition: ["#result", "#preview"]
  };

  (fallbackSelectors[page] || []).forEach((selector, index) => {
    const node = document.querySelector(selector);
    if (!node) {
      return;
    }
    node.innerHTML = index === 0 ? `<div class="empty-state">${message}</div>` : "";
  });
}

function summarizeText(value, limit = 72) {
  const text = String(value || "").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function pickSceneHighlights(plants, limit = 3) {
  const usedScenes = new Set();
  return plants
    .filter(item => item?.sceneTag)
    .filter(item => {
      if (usedScenes.has(item.sceneTag)) {
        return false;
      }
      usedScenes.add(item.sceneTag);
      return true;
    })
    .slice(0, limit);
}

function buildHomeSilhouetteSection(plants) {
  const marqueePlants = plants.length > 1 ? [...plants, ...plants] : plants;
  return `
    <section class="panel home-section-panel home-silhouette-panel">
      <div class="section-heading home-showcase-heading">
        <div>
          <h2>植物轮廓图</h2>
        </div>
      </div>
      <div class="home-silhouette-marquee">
        <div class="home-silhouette-track">
          ${marqueePlants
            .map((plant, index) =>
              buildHomeSilhouetteCard(plant, index, plants.length || 1)
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function buildHomeSilhouetteCard(plant, index, baseLength = 1) {
  const sourceIndex = baseLength > 0 ? index % baseLength : index;
  const href = plant?.id ? linkTo("plants", `?id=${plant.id}`) : linkTo("plants");
  return `
    <a class="home-silhouette-card" href="${href}">
      <div
        class="home-silhouette-figure"
        style="--silhouette-accent: ${pickHomeSilhouetteAccent(sourceIndex)};"
      >
        ${buildHomeSilhouetteSvg(plant, sourceIndex)}
      </div>
      <div class="home-silhouette-copy">
        <strong>${escapeHtml(plant?.chineseName || "植物")}</strong>
        <span>${escapeHtml(plant?.sceneTag || plant?.category || "植物图鉴")}</span>
        <p>
          ${escapeHtml(
            summarizeText(
              plant?.featureText ||
                plant?.summary ||
                plant?.careTips ||
                plant?.scienceNote ||
                plant?.category ||
                "查看植物详情。",
              36
            )
          )}
        </p>
      </div>
    </a>
  `;
}

function buildHomeSilhouetteSvg(plant, index) {
  const seed = normalizeText([plant?.chineseName, plant?.category, plant?.sceneTag]);

  if (/花|樱|桃|梅|兰|荷|海棠|杜鹃|月季|玉兰/.test(seed)) {
    return `
      <svg class="home-silhouette-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M60 30C52 38 51 48 60 55C69 48 68 38 60 30Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M90 60C82 52 72 51 65 60C72 69 82 68 90 60Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M60 90C68 82 69 72 60 65C51 72 52 82 60 90Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M30 60C38 68 48 69 55 60C48 51 38 52 30 60Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="60" cy="60" r="7" stroke="currentColor" stroke-width="3.5"/>
        <path d="M60 67V100" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M59 82C52 77 44 77 38 83" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M61 89C69 85 76 86 82 92" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
    `;
  }

  if (/多肉|仙人|景天|芦荟/.test(seed)) {
    return `
      <svg class="home-silhouette-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M60 95C61 76 56 60 48 45C61 47 71 57 72 73C73 84 68 92 60 95Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M60 95C59 76 64 60 72 45C59 47 49 57 48 73C47 84 52 92 60 95Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M60 79C60 63 58 48 52 34C63 36 70 46 70 58C70 68 66 75 60 79Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M60 79C60 63 62 48 68 34C57 36 50 46 50 58C50 68 54 75 60 79Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M43 90H77" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
    `;
  }

  if (/树|木|松|柏|槐|枫|樟|榕|银杏|梧桐/.test(seed)) {
    return `
      <svg class="home-silhouette-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M60 96V42" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 46C52 54 45 61 34 68" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 50C68 56 76 62 88 69" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 60C54 67 49 74 42 84" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 64C67 71 73 77 79 86" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="34" cy="68" r="8" stroke="currentColor" stroke-width="3.5"/>
        <circle cx="88" cy="69" r="8" stroke="currentColor" stroke-width="3.5"/>
        <circle cx="42" cy="84" r="7" stroke="currentColor" stroke-width="3.5"/>
        <circle cx="79" cy="86" r="7" stroke="currentColor" stroke-width="3.5"/>
        <circle cx="60" cy="34" r="11" stroke="currentColor" stroke-width="3.5"/>
      </svg>
    `;
  }

  if (/竹|草|蕨|禾|蒲|葱|麦/.test(seed)) {
    return `
      <svg class="home-silhouette-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M35 96C35 72 42 50 56 28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M60 96C60 68 61 47 60 22" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M85 96C85 72 78 50 64 28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M56 41C47 39 40 42 35 49" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M64 47C73 45 80 48 86 56" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M59 61C50 59 43 63 38 71" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M61 68C70 66 77 70 82 78" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
    `;
  }

  switch (index % 3) {
    case 0:
      return `
        <svg class="home-silhouette-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M29 84C31 50 52 28 92 24C89 63 67 88 29 84Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M39 73C52 62 65 49 80 34" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M58 56C52 49 46 44 39 40" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
      `;
    case 1:
      return `
        <svg class="home-silhouette-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M60 94C45 82 37 66 38 49C50 50 58 59 60 70C62 59 70 50 82 49C83 66 75 82 60 94Z" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M60 69V28" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M60 41C52 36 45 35 38 37" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M60 47C68 41 75 40 82 42" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
      `;
    default:
      return `
        <svg class="home-silhouette-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M60 97V43" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M60 44C51 53 43 61 31 67" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M60 51C69 57 77 63 89 69" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M60 61C53 69 48 77 43 87" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M60 66C67 72 73 79 78 88" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M60 30C52 22 43 21 35 25C40 35 49 40 60 41" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M60 30C68 22 77 21 85 25C80 35 71 40 60 41" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
  }
}

function pickHomeSilhouetteAccent(index) {
  const accents = ["#356b3f", "#d98d3a", "#4f7f72", "#7b8f4e", "#8b6a44", "#567a98"];
  return accents[index % accents.length];
}

function buildHomeVideoEmbedUrl(bvid) {
  return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(
    bvid
  )}&page=1&autoplay=1&muted=1&danmaku=0&high_quality=1`;
}

function splitArticleParagraphs(content) {
  return String(content || "")
    .split(/\n+/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

function buildArticleHighlights(article, paragraphs, relatedPlants) {
  const items = [];

  if (article?.summary) {
    items.push({ title: "摘要", text: truncateText(article.summary, 70) });
  }
  if (paragraphs[0]) {
    items.push({ title: "开篇重点", text: truncateText(paragraphs[0], 70) });
  }
  if (relatedPlants[0]) {
    items.push({
      title: "关联植物",
      text: `${relatedPlants[0].chineseName} · ${truncateText(
        relatedPlants[0].summary || relatedPlants[0].sceneTag || "",
        44
      )}`
    });
  }

  return items.slice(0, 3);
}

function truncateText(value, limit = 80) {
  const text = String(value || "").trim();
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function estimateReadingMinutes(content) {
  const length = String(content || "").replace(/\s+/g, "").length;
  return Math.max(1, Math.round(length / 320));
}

function sortArticlesByDate(articles) {
  return [...articles].sort(
    (left, right) =>
      toTimestamp(right?.publishedAt || right?.createdAt) -
      toTimestamp(left?.publishedAt || left?.createdAt)
  );
}

function toTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function pickGalleryImages(plant) {
  const urls = [plant?.imageUrl, ...(plant?.galleryImages || []).map(item => item?.url)]
    .map(resolveMediaUrl)
    .filter(Boolean);
  return [...new Set(urls)];
}

function pickArticleImage(article, plants) {
  const matchedPlant =
    findRelatedPlants(article, plants, 1)[0] || pickFallbackPlant(article, plants);
  return (
    resolveMediaUrl(article?.coverImageUrl) ||
    pickPlantImage(matchedPlant) ||
    getAssetPath("hero.png")
  );
}

function findPlantByRecognizedName(item, plants) {
  const target = normalizeText(item?.recognizedName);
  if (!target) {
    return null;
  }

  return (
    plants.find(plant => collectPlantKeywords(plant).includes(target)) ||
    plants.find(plant => normalizeText(plant?.chineseName) === target) ||
    null
  );
}

function hydratePlant(plant, plants) {
  if (!plant) {
    return null;
  }

  const matchedPlant =
    plants.find(item => Number(item?.id) === Number(plant?.id)) ||
    plants.find(item => normalizeText(item?.chineseName) === normalizeText(plant?.chineseName));

  if (!matchedPlant) {
    return plant;
  }

  return {
    ...matchedPlant,
    ...plant,
    imageUrl: plant.imageUrl || matchedPlant.imageUrl,
    galleryImages:
      Array.isArray(plant.galleryImages) && plant.galleryImages.length
        ? plant.galleryImages
        : matchedPlant.galleryImages
  };
}

function findRelatedPlants(article, plants, limit = 3) {
  if (!article || !plants.length) {
    return [];
  }

  const articleText = normalizeText([
    article.title,
    article.summary,
    article.content,
    article.sourceName
  ]);

  return [...plants]
    .map(plant => ({ plant, score: scorePlantAgainstText(articleText, plant) }))
    .filter(item => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.plant.hotScore || 0) - Number(left.plant.hotScore || 0)
    )
    .slice(0, limit)
    .map(item => item.plant);
}

function scorePlantAgainstText(articleText, plant) {
  const keywords = collectPlantKeywords(plant);
  let score = 0;

  keywords.forEach(keyword => {
    if (!keyword || keyword.length < 2) {
      return;
    }
    if (articleText.includes(keyword)) {
      score += keyword === normalizeText(plant.chineseName) ? 8 : 4;
    }
  });

  if (plant.category && articleText.includes(normalizeText(plant.category))) {
    score += 2;
  }
  if (plant.sceneTag && articleText.includes(normalizeText(plant.sceneTag))) {
    score += 1;
  }
  if (
    articleText.includes("花") &&
    normalizeText([plant.category, plant.bloomSeason, plant.featureText]).includes("花")
  ) {
    score += 2;
  }
  if (
    articleText.includes("叶") &&
    normalizeText([plant.category, plant.featureText]).includes("叶")
  ) {
    score += 2;
  }
  if (
    articleText.includes("有毒") &&
    /有毒|刺激/.test(normalizeText(plant.toxicityLevel))
  ) {
    score += 3;
  }
  if (
    articleText.includes("安全") &&
    normalizeText(plant.toxicityLevel).includes("安全")
  ) {
    score += 2;
  }

  return score;
}

function pickFallbackPlant(article, plants) {
  if (!plants.length) {
    return null;
  }

  const articleText = normalizeText([
    article?.title,
    article?.summary,
    article?.content,
    article?.sourceName
  ]);
  const sorted = [...plants].sort(
    (left, right) => Number(right.hotScore || 0) - Number(left.hotScore || 0)
  );

  if (articleText.includes("有毒")) {
    return (
      sorted.find(plant =>
        /有毒|刺激/.test(normalizeText(plant.toxicityLevel))
      ) || sorted[0]
    );
  }
  if (articleText.includes("花")) {
    return (
      sorted.find(plant =>
        normalizeText([plant.category, plant.bloomSeason, plant.featureText]).includes(
          "花"
        )
      ) || sorted[0]
    );
  }
  if (articleText.includes("叶")) {
    return (
      sorted.find(plant =>
        normalizeText([plant.category, plant.featureText]).includes("叶")
      ) || sorted[0]
    );
  }
  return sorted[0];
}

function collectPlantKeywords(plant) {
  const tokens = [
    plant?.chineseName,
    plant?.latinName,
    plant?.aliasName,
    plant?.category,
    plant?.sceneTag
  ]
    .filter(Boolean)
    .flatMap(value => splitKeywords(value))
    .map(normalizeText)
    .filter(Boolean);

  return [...new Set(tokens)];
}

function splitKeywords(value) {
  return String(value || "")
    .split(/[\/,，、\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeText(values) {
  return (Array.isArray(values) ? values.join(" ") : String(values || ""))
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, " ")
    .trim();
}

