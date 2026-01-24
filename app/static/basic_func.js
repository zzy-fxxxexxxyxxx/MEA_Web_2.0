// 定义切换 tab 的函数（参数化）
export function openTab(tabName, btn, allButtons, allContents) {
  // 隐藏所有内容
  allContents.forEach((tc) => (tc.style.display = "none"));
  // 移除所有按钮 active 样式
  allButtons.forEach((b) => b.classList.remove("active"));
  // 显示当前 tab 内容
  document.getElementById(tabName).style.display = "block";
  btn.classList.add("active");
}

// 定义画坐标轴函数
export function drawAxes(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return; // 如果没有这个canvas，就跳过
  const ctx = canvas.getContext("2d");
  // 清空
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // X轴
  ctx.beginPath();
  ctx.moveTo(20, canvas.height - 20);
  ctx.lineTo(canvas.width - 20, canvas.height - 20);
  ctx.stroke();
  // Y轴
  ctx.beginPath();
  ctx.moveTo(20, canvas.height - 20);
  ctx.lineTo(20, 20);
  ctx.stroke();
}
