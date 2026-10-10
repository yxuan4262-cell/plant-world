import {
  mountFlash,
  redirectAfterLogin,
  redirectIfAuthenticated,
  requestJson,
  saveSession
} from "./common.js";

document.addEventListener("DOMContentLoaded", () => {
  redirectIfAuthenticated();

  const page = document.body.dataset.page;
  const flash = document.querySelector("[data-flash]");
  const form = document.querySelector("form");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(form);
    const role = String(formData.get("role") || "USER");

    const payload =
      page === "register"
        ? {
            username: String(formData.get("username") || "").trim(),
            displayName: String(formData.get("displayName") || "").trim(),
            password: String(formData.get("password") || ""),
            role
          }
        : {
            username: String(formData.get("username") || "").trim(),
            password: String(formData.get("password") || ""),
            role
          };

    try {
      mountFlash(flash, "");
      const data = await requestJson(page === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: payload
      });
      saveSession({ user: data.user, savedAt: new Date().toISOString() });
      redirectAfterLogin({ user: data.user });
    } catch (error) {
      mountFlash(flash, error.message || "认证失败，请稍后重试。", "error");
    }
  });
});
