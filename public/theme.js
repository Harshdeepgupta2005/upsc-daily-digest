// Apply the saved colour theme before first paint to avoid a flash.
(function () {
  try {
    var saved = localStorage.getItem("upsc.theme");
    var theme = saved === "dark" || saved === "light"
      ? saved
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
