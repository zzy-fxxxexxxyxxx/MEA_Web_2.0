//------------------绘制All Signals (完善版, 带坐标轴, 高DPI)----------------------
export async function plotAllSignals(processedData) {
  // 1️⃣ 获取用户输入
  const plotStartTime =
    parseFloat(document.getElementById("start_time3")?.value) || 1;
  const intervalTime =
    parseFloat(document.getElementById("time_interval3")?.value) || 0.1;
  const voltageRange =
    (parseFloat(document.getElementById("voltage3")?.value) || 0.0001) /
    1000000;
  const tabValue = parseInt(document.getElementById("tab3")?.value) || 44;

  const layout = processedData.layout;
  const rawData = processedData.rawData;
  const fs = processedData.fs;

  const numSamples = Math.floor(intervalTime * fs);
  const startIdx = Math.floor(plotStartTime * fs);
  const endIdx = startIdx + numSamples;

  // 2️⃣ 计算通道坐标
  const columnValue = Math.floor(tabValue / 10);
  const lineValue = tabValue % 10;
  const tabIndex = layout.indexOf(tabValue);

  if (
    (lineValue === 1 || lineValue === 8) &&
    (columnValue === 1 || columnValue === 8)
  ) {
    alert("不存在该通道");
    return;
  } else if (lineValue === 5 && columnValue === 1) {
    alert("参考电压");
    return;
  } else if (
    lineValue < 1 ||
    lineValue > 8 ||
    columnValue < 1 ||
    columnValue > 8
  ) {
    alert("不存在该通道");
    return;
  }

  // 3️⃣ 获取绘图数据
  const channelData = rawData[tabIndex].slice(startIdx, endIdx);

  // 3️⃣1️⃣ 计算绝对时间
  const t = Array.from(
    { length: channelData.length },
    (_, i) => plotStartTime + i / fs
  );

  // 4️⃣ 调用后端处理信号（Python 包计算 clean 信号和 rpeaks）
  let clean = [];
  let rpeaks = [];
  try {
    const response = await fetch("/process_signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal: channelData, fs }),
    });
    const result = await response.json();
    if (result.error) {
      alert("Error: " + result.error);
      return;
    }
    clean = result.clean;
    rpeaks = result.rpeaks.map((idx) => idx / fs + plotStartTime);
  } catch (err) {
    alert("调用后端处理失败: " + err);
    return;
  }

  // 5️⃣ 绘制到 canvas

  const canvas2 = document.getElementById("canvas2");
  // 让 canvas2 大小和 canvas1 一样
  const rect = canvas2.parentElement.getBoundingClientRect();
  if (!rect) return;

  canvas2.style.width = rect.width + "px";
  canvas2.style.height = rect.height + "px";

  const dpi = window.devicePixelRatio || 1;
  canvas2.width = rect.width * dpi;
  canvas2.height = rect.height * dpi;

  const ctx = canvas2.getContext("2d");
  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const width = rect.width;
  const height = rect.height;

  // --- 留出边距给坐标轴 ---
  const marginLeft = 50;
  const marginBottom = 40;
  const marginTop = 20;
  const marginRight = 20;

  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  // 坐标映射函数
  const mapX = (x) =>
    marginLeft + ((x - plotStartTime) / intervalTime) * plotWidth;
  const mapY = (y) =>
    marginTop +
    plotHeight -
    ((y + voltageRange) / (2 * voltageRange)) * plotHeight;

  // 5.1️⃣ 绘制原始信号 (绿色)
  ctx.beginPath();
  ctx.strokeStyle = "green";
  ctx.lineWidth = 1;
  channelData.forEach((val, i) => {
    // 限制 val 在 [-voltageRange, voltageRange]
    const clippedVal = Math.max(-voltageRange, Math.min(voltageRange, val));
    const x = mapX(t[i]);
    const y = mapY(clippedVal);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 5.2️⃣ 绘制清理后的信号 (蓝色)
  ctx.beginPath();
  ctx.strokeStyle = "blue";
  clean.forEach((val, i) => {
    const clippedVal = Math.max(-voltageRange, Math.min(voltageRange, val));
    const x = mapX(t[i]);
    const y = mapY(clippedVal);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 5.3️⃣ 绘制 R 波虚线 (红色)
  ctx.strokeStyle = "red";
  rpeaks.forEach((time) => {
    const x = mapX(time);
    ctx.beginPath();
    ctx.moveTo(x, marginTop);
    ctx.lineTo(x, marginTop + plotHeight);
    ctx.stroke();
  });

  // 6️⃣ 绘制坐标轴
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1;

  // Y 轴
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop - 5);
  ctx.lineTo(marginLeft, marginTop + plotHeight);
  ctx.stroke();

  // X 轴
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop + plotHeight);
  ctx.lineTo(marginLeft + plotWidth + 5, marginTop + plotHeight);
  ctx.stroke();

  // 7️⃣ 绘制刻度和文字
  ctx.fillStyle = "#000";
  ctx.font = "8px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Y 轴刻度
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = -voltageRange + (i * 2 * voltageRange) / yTicks;
    const yPos = mapY(yVal);
    ctx.beginPath();
    ctx.moveTo(marginLeft - 5, yPos);
    ctx.lineTo(marginLeft, yPos);
    ctx.stroke();
    ctx.fillText(`${(1000000 * yVal).toFixed(0)} μV`, marginLeft - 8, yPos);
  }

  // X 轴刻度
  const xTicks = 5;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= xTicks; i++) {
    const xVal = plotStartTime + (i * intervalTime) / xTicks;
    const xPos = mapX(xVal);
    ctx.beginPath();
    ctx.moveTo(xPos, marginTop + plotHeight);
    ctx.lineTo(xPos, marginTop + plotHeight + 5);
    ctx.stroke();
    ctx.fillText(`${xVal.toFixed(2)} s`, xPos, marginTop + plotHeight + 8);
  }

  // 坐标轴单位
  ctx.textAlign = "center";
  ctx.fillText(
    "Time (s)",
    marginLeft + plotWidth / 2,
    marginTop + plotHeight + 16
  );
  ctx.save();
  ctx.translate(marginLeft - 40, marginTop + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Voltage (μV)", 0, 0);
  ctx.restore();

  canvas2.dataset.hasContent = "true";
}

// //------------------绘制All Signals----------------------------------------------------------------------
// export async function plotAllSignals(processedData) {
//   // 1️⃣ 从页面获取用户输入
//   const plotStartTime =
//     parseFloat(document.getElementById("start_time3")?.value) || 1;
//   const intervalTime =
//     parseFloat(document.getElementById("time_interval3")?.value) || 0.1;
//   const voltageRange =
//     (parseFloat(document.getElementById("voltage3")?.value) || 0.0001)/1000000;
//   const tabValue = parseInt(document.getElementById("tab3")?.value) || 44;

//   const layout = processedData.layout;
//   const Raw_data = processedData.Raw_data;
//   const fs = processedData.fs;

//   const plotEndTime = plotStartTime + intervalTime;
//   const numSamples = Math.floor(intervalTime * fs);
//   const startIdx = Math.floor(plotStartTime * fs);
//   const endIdx = startIdx + numSamples;

//   // 2️⃣ 计算通道坐标
//   const columnValue = Math.floor(tabValue / 10);
//   const lineValue = tabValue % 10;
//   const tabIndex = layout.indexOf(tabValue);

//   if (
//     (lineValue === 1 || lineValue === 8) &&
//     (columnValue === 1 || columnValue === 8)
//   ) {
//     alert("不存在该通道");
//     return;
//   } else if (lineValue === 5 && columnValue === 1) {
//     alert("参考电压");
//     return;
//   } else if (
//     lineValue < 1 ||
//     lineValue > 8 ||
//     columnValue < 1 ||
//     columnValue > 8
//   ) {
//     alert("不存在该通道");
//     return;
//   }

//   // 3️⃣ 获取绘图数据
//   const channelData = Raw_data[tabIndex].slice(startIdx, endIdx);

//   console.log({startIdx});
//   console.log({endIdx});
//   console.log({channelData});
//   console.log({fs});

//   // 3️⃣1️⃣ 计算绝对时间
//   const t = Array.from({ length: channelData.length }, (_, i) => plotStartTime + i / fs);

//   // 4️⃣ 调用后端处理信号（Python 包计算 clean 信号和 rpeaks）
//   let clean = [];
//   let rpeaks = [];
//   try {
//     const response = await fetch("/process_signal", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ signal: channelData, fs })
//     });
//     const result = await response.json();
//     if (result.error) {
//       alert("Error: " + result.error);
//       return;
//     }
//     clean = result.clean;
//     rpeaks = result.rpeaks.map(idx => idx / fs + plotStartTime);
//   } catch (err) {
//     alert("调用后端处理失败: " + err);
//     return;
//   }

//   // 5️⃣ 绘制到 canvas
//   const canvas = document.getElementById("canvas2");
//   const ctx = canvas.getContext("2d");

//   // --- 高分辨率设置 ---
//   const dpi = window.devicePixelRatio || 1;
//   const width = canvas.clientWidth;
//   const height = canvas.clientHeight;
//   canvas.width = width * dpi;
//   canvas.height = height * dpi;
//   ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

//   ctx.lineWidth = 0.5;
//   ctx.clearRect(0, 0, width, height);

//   // 坐标映射函数
//   const mapX = (x) => ((x - plotStartTime) / intervalTime) * width;
//   const mapY = (y) => height / 2 - (y / voltageRange) * (height / 2);

//   // 5.1️⃣ 绘制原始信号 (黑色)
//   ctx.beginPath();
//   ctx.strokeStyle = "green";
//   channelData.forEach((val, i) => {
//     const x = mapX(t[i]);
//     const y = mapY(val);
//     if (i === 0) ctx.moveTo(x, y);
//     else ctx.lineTo(x, y);
//   });
//   ctx.stroke();

//   // 5.2️⃣ 绘制清理后的信号 (蓝色)
//   ctx.beginPath();
//   ctx.strokeStyle = "blue";
//   clean.forEach((val, i) => {
//     const x = mapX(t[i]);
//     const y = mapY(val);
//     if (i === 0) ctx.moveTo(x, y);
//     else ctx.lineTo(x, y);
//   });
//   ctx.stroke();

//   // 5.3️⃣ 绘制 R 波虚线 (红色)
//   ctx.strokeStyle = "red";
//   rpeaks.forEach(time => {
//     const x = mapX(time);
//     ctx.beginPath();
//     ctx.moveTo(x, 0);
//     ctx.lineTo(x, height);
//     ctx.stroke();
//   });
// }
