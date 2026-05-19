const form = document.getElementById("aiForm");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const statusText = document.getElementById("statusText");
const chatBox = document.getElementById("chatBox");
const clearChatBtn = document.getElementById("clearChatBtn");

let messages = [];

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function normalizeMathMarkdown(text) {
  if (!text) return "";
  let out = text;
  // Support \(...\) and \[...\]
  out = out.replace(/\\\[((?:.|\n)*?)\\\]/g, "$$$$ $1 $$$$");
  out = out.replace(/\\\(((?:.|\n)*?)\\\)/g, "$$$1$$");
  // Convert standalone [ ... ] lines (often used by LLMs for block formulas) to $$ ... $$
  out = out.replace(/^\s*\[\s*([\s\S]*?)\s*\]\s*$/gm, (_, expr) => {
    return `$$\n${expr.trim()}\n$$`;
  });
  return out;
}

function addBubble(role, text, useMarkdown = false) {
  const wrap = document.createElement("div");
  wrap.className = role === "user" ? "flex justify-end" : "flex justify-start";

  const bubble = document.createElement("div");
  bubble.className =
    role === "user"
      ? "max-w-[82%] rounded-2xl rounded-br-md bg-blue-600 text-white px-4 py-2 text-sm whitespace-pre-wrap"
      : "max-w-[82%] rounded-2xl rounded-bl-md bg-white border border-gray-200 text-gray-800 px-4 py-2 text-sm prose prose-sm max-w-none";

  if (useMarkdown && role === "assistant" && window.marked) {
    const normalized = normalizeMathMarkdown(text || "");
    bubble.innerHTML = window.marked.parse(normalized);
    if (window.renderMathInElement) {
      window.renderMathInElement(bubble, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
    }
  } else {
    bubble.innerHTML = `<div class="whitespace-pre-wrap">${escapeHtml(text || "")}</div>`;
  }

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  scrollToBottom();
  return { wrap, bubble };
}

function addThinkingBubble() {
  const wrap = document.createElement("div");
  wrap.className = "flex justify-start";
  const bubble = document.createElement("div");
  bubble.className =
    "max-w-[82%] rounded-2xl rounded-bl-md bg-white border border-gray-200 text-gray-600 px-4 py-2 text-sm flex items-center gap-1";
  bubble.innerHTML = `
    <span>正在思考</span>
    <span class="thinking-dot">•</span>
    <span class="thinking-dot">•</span>
    <span class="thinking-dot">•</span>
  `;
  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

clearChatBtn.addEventListener("click", () => {
  messages = [];
  chatBox.innerHTML = '<div class="text-sm text-gray-500">对话已清空。你可以重新开始提问。</div>';
  statusText.textContent = "等待输入";
});

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  addBubble("user", prompt);
  messages.push({ role: "user", content: prompt });
  promptInput.value = "";
  sendBtn.disabled = true;
  statusText.textContent = "AI 思考中...";

  try {
    const thinkingNode = addThinkingBubble();
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "请求失败");

    const reply = (data.output || "").trim() || "模型没有返回内容。";
    thinkingNode.remove();
    addBubble("assistant", reply, true);
    messages.push({ role: "assistant", content: reply });
    statusText.textContent = "完成";
  } catch (error) {
    const last = chatBox.lastElementChild;
    if (last && last.textContent.includes("正在思考")) {
      last.remove();
    }
    addBubble("assistant", `调用失败：${error.message}`);
    statusText.textContent = "失败";
  } finally {
    sendBtn.disabled = false;
    promptInput.focus();
  }
});
