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
// 定义画坐标轴函数
export function drawAxes(canvasId, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return; // 如果没有这个canvas，就跳过
  
  // 获取画布上下文
  const ctx = canvas.getContext("2d");
  
  // 解析配置选项
  const {
    xMin = 0,
    xMax = 10,
    yMin = -100,
    yMax = 100,
    xLabel = "Time (s)",
    yLabel = "Voltage (μV)",
    xTicks = 5,
    yTicks = 5,
    marginLeft = 50,
    marginBottom = 40,
    marginTop = 20,
    marginRight = 20,
    axisColor = "#888",
    tickColor = "#888",
    textColor = "#000",
    fontSize = 8,
    lineWidth = 1
  } = options;
  
  // 获取画布尺寸并设置DPI适配
  const width = canvas.parentElement.offsetWidth;
  const height = canvas.parentElement.offsetHeight;
  
  if (!width || !height) return;
  
  // 移除可能存在的内联样式，交给CSS控制
  canvas.style.width = "";
  canvas.style.height = "";
  
  // 处理DPI
  const dpi = window.devicePixelRatio || 1;
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  
  // 清空画布
  ctx.clearRect(0, 0, width, height);
  
  // 计算绘图区域大小
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  
  // 坐标映射函数
  const mapX = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const mapY = (y) => marginTop + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;
  
  // 设置坐标轴样式
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = lineWidth;
  
  // 绘制Y轴
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop - 5);
  ctx.lineTo(marginLeft, marginTop + plotHeight);
  ctx.stroke();
  
  // 绘制X轴
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop + plotHeight);
  ctx.lineTo(marginLeft + plotWidth + 5, marginTop + plotHeight);
  ctx.stroke();
  
  // 设置刻度和文字样式
  ctx.fillStyle = textColor;
  ctx.font = `${fontSize}px sans-serif`;
  
  // 绘制Y轴刻度和标签
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  
  for (let i = 0; i <= yTicks; i++) {
    const yVal = yMin + (i * (yMax - yMin)) / yTicks;
    const yPos = mapY(yVal);
    
    // 绘制刻度线
    ctx.beginPath();
    ctx.moveTo(marginLeft - 5, yPos);
    ctx.lineTo(marginLeft, yPos);
    ctx.stroke();
    
    // 绘制刻度标签
    ctx.fillText(yVal.toFixed(0), marginLeft - 8, yPos);
  }
  
  // 绘制X轴刻度和标签
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  
  for (let i = 0; i <= xTicks; i++) {
    const xVal = xMin + (i * (xMax - xMin)) / xTicks;
    const xPos = mapX(xVal);
    
    // 绘制刻度线
    ctx.beginPath();
    ctx.moveTo(xPos, marginTop + plotHeight);
    ctx.lineTo(xPos, marginTop + plotHeight + 5);
    ctx.stroke();
    
    // 绘制刻度标签
    ctx.fillText(xVal.toFixed(0), xPos, marginTop + plotHeight + 8);
  }
  
  // 绘制X轴单位标签
  ctx.textAlign = "center";
  ctx.fillText(xLabel, marginLeft + plotWidth / 2, marginTop + plotHeight + 16);
  
  // 绘制Y轴单位标签（旋转）
  ctx.save();
  ctx.translate(marginLeft - 40, marginTop + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}



/**
 * 初始化所有刷新/删除按钮
 * @param {Function} onRefreshPanel1 - Panel1 的重绘网格回调
 * @param {Function} onRefreshPanel2 - Panel2 的重绘网格回调
 */
export function initRefreshButtons(onRefreshPanel1, onRefreshPanel2) {
  
  // 1️⃣ Panel1：重新绘制网格
  const btn1 = document.getElementById("refreshPanel1");
  if (btn1) {
    btn1.addEventListener("click", () => {
      // 执行传入的回调函数
      if (typeof onRefreshPanel1 === 'function') onRefreshPanel1();
      
      const canvas = document.getElementById("panel1Canvas");
      if (canvas) canvas.dataset.hasContent = "false";
    });
  }

  // 2️⃣ Panel2：清空 heatmapLayer 和 arrowsLayer
  const btn2 = document.getElementById("refreshPanel2");
  if (btn2) {
    btn2.addEventListener("click", () => {
      const heatmapLayer = document.getElementById("heatmapLayer");
      const arrowsLayer = document.getElementById("arrowsLayer");
      if (heatmapLayer) heatmapLayer.innerHTML = "";
      if (arrowsLayer) arrowsLayer.innerHTML = "";
      
      // 执行传入的回调函数
      if (typeof onRefreshPanel2 === 'function') onRefreshPanel2();
    });
  }

  // 3️⃣ Panel3：清空 canvas1
  const btn3 = document.getElementById("refreshPanel3");
  if (btn3) {
    btn3.addEventListener("click", () => {
      const canvas1 = document.getElementById("canvas1");
      if (canvas1) {
        const ctx = canvas1.getContext("2d");
        ctx.clearRect(0, 0, canvas1.width, canvas1.height);
        canvas1.dataset.hasContent = "false";
      }
    });
  }

  // 4️⃣ Panel4：清空 canvas2
  const btn4 = document.getElementById("refreshPanel4");
  if (btn4) {
    btn4.addEventListener("click", () => {
      const canvas2 = document.getElementById("canvas2");
      if (canvas2) {
        const ctx = canvas2.getContext("2d");
        ctx.clearRect(0, 0, canvas2.width, canvas2.height);
        canvas2.dataset.hasContent = "false";
      }
    });
  }
}

