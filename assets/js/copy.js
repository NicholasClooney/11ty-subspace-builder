document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clipboard]");
  if (!button) return;
  const embed = button.closest(".gh-embed");
  if (!embed) return;
  const content = embed.querySelectorAll(".gh-embed__ol > li > code");
  const text = Array.from(content)
    .map((node) => node.textContent)
    .join("\n");
  if (!text) return;
  void navigator.clipboard?.writeText(text);
  const original = button.textContent;
  button.textContent = "Copied!";
  window.setTimeout(() => {
    button.textContent = original || "Copy";
  }, 1200);
});
