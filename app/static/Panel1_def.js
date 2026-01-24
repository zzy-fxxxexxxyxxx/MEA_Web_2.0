//---------------------------------绘制坐标系边框------------------------------------------------------------
export function drawGridOnPanel1() {
  // gridGap 单位：像素

  const canvas = document.getElementById("panel1Canvas");
  const ctx = canvas.getContext("2d");
  // const panel = document.getElementById("panel1");
  const rect = canvas.parentElement.getBoundingClientRect();

  const gridGap = 3;
  // 高分屏适配
  const dpi = window.devicePixelRatio || 1;

  // CSS 尺寸保持 panel1 原来的大小的 90%
  // const cssWidth = panel.clientWidth * 0.9;
  // const cssHeight = panel.clientHeight * 0.9;
  const cssWidth = rect.width * 0.9;
  const cssHeight = rect.height * 0.9;

  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";

  // Canvas 物理像素尺寸
  canvas.width = cssWidth * dpi;
  canvas.height = cssHeight * dpi;

  // 缩放逻辑坐标
  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // 网格参数
  const rows = 8;
  const cols = 8;

  // 计算每个小坐标系尺寸（减去缝隙）
  const cellWidth = (cssWidth - (cols - 1) * gridGap) / cols - 0.5;
  const cellHeight = (cssHeight - (rows - 1) * gridGap) / rows - 0.5;

  // 绘制每个小坐标系
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 排除四角
      if (
        (row === 0 && col === 0) ||
        (row === 0 && col === cols - 1) ||
        (row === rows - 1 && col === 0) ||
        (row === rows - 1 && col === cols - 1)
      )
        continue;

      // 坐标计算，考虑缝隙
      const x = col * (cellWidth + gridGap);
      const y = row * (cellHeight + gridGap);

      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;

      // 对齐物理像素，保证边框锐利
      ctx.strokeRect(
        Math.round(x) + 0.5,
        Math.round(y) + 0.5,
        Math.round(cellWidth),
        Math.round(cellHeight)
      );

      // 绘制标题数字
      let title;
      if (row === 4 && col === 0) {
        title = "Ref";
      } else {
        title = (col + 1) * 10 + (row + 1); // 数字
      }

      const textX = x + 8;
      const textY = y + 10; // 顶部上方2像素
      ctx.font = "bold 8px Arial";
      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(title, textX, textY);
    }
  }
}

//-------------------60个小图，有降采样------------------------------------------------------------------
export function plotWaveformsOnGrid(processedData) {
  const canvas = document.getElementById("panel1Canvas");
  const ctx = canvas.getContext("2d");
  // const panel = document.getElementById("panel1");
  const rect = canvas.parentElement.getBoundingClientRect();

  const plotStartTime = parseFloat(
    document.getElementById("start_time1").value
  );
  const intervalTime = parseFloat(
    document.getElementById("time_interval1").value
  );
  const fs = processedData.fs;
  const voltageRange =
    parseFloat(document.getElementById("voltage1").value) / 1000000;
  const layout = processedData.layout;
  const rawData = processedData.rawData;

  const numSamples = Math.floor(intervalTime * fs);
  const startIdx = Math.floor(plotStartTime * fs);
  const endIdx = startIdx + numSamples;

  const dpi = window.devicePixelRatio || 1;
  const cssWidth = rect.width * 0.9;
  const cssHeight = rect.height * 0.9;

  canvas.width = cssWidth * dpi;
  canvas.height = cssHeight * dpi;
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";

  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // 绘制网格边框和标题
  drawGridOnPanel1();

  const rows = 8;
  const cols = 8;
  const gridGap = 3;
  const cellWidth = (cssWidth - (cols - 1) * gridGap) / cols - 0.5;
  const cellHeight = (cssHeight - (rows - 1) * gridGap) / rows - 0.5;

  const titleHeight = 7; // 标题预留高度

  // 遍历每个小坐标系
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 排除四角
      if (
        (row === 0 && col === 0) ||
        (row === 0 && col === cols - 1) ||
        (row === rows - 1 && col === 0) ||
        (row === rows - 1 && col === cols - 1)
      )
        continue;

      const tab = (col + 1) * 10 + (row + 1);
      const tabIndex = layout.indexOf(tab);
      if (tabIndex === -1) continue;

      // 获取波形数据
      let channelData = rawData[tabIndex].slice(startIdx, endIdx);
      let t = Array.from(
        { length: channelData.length },
        (_, i) => plotStartTime + i / fs
      );

      // ⚡ 判断是否下采样
      if (intervalTime > 0.1) {
        const DOWNSAMPLE_FACTOR = 5;
        const newLength = Math.floor(channelData.length / DOWNSAMPLE_FACTOR);
        const channelDataDown = new Array(newLength);
        const tDown = new Array(newLength);
        for (let i = 0; i < newLength; i++) {
          channelDataDown[i] = channelData[i * DOWNSAMPLE_FACTOR];
          tDown[i] = t[i * DOWNSAMPLE_FACTOR];
        }
        channelData = channelDataDown;
        t = tDown;
      } else if (intervalTime > 5) {
        const DOWNSAMPLE_FACTOR = 10;
        const newLength = Math.floor(channelData.length / DOWNSAMPLE_FACTOR);
        const channelDataDown = new Array(newLength);
        const tDown = new Array(newLength);
        for (let i = 0; i < newLength; i++) {
          channelDataDown[i] = channelData[i * DOWNSAMPLE_FACTOR];
          tDown[i] = t[i * DOWNSAMPLE_FACTOR];
        }
        channelData = channelDataDown;
        t = tDown;
      }

      // 小坐标系左上角位置
      const x0 = col * (cellWidth + gridGap);
      const y0 = row * (cellHeight + gridGap);
      const rectX = Math.round(x0) + 0.5;
      const rectY = Math.round(y0) + 0.5;

      // 裁剪波形到小坐标系（避开标题区域）
      ctx.save();
      ctx.beginPath();
      ctx.rect(rectX, rectY + titleHeight, cellWidth, cellHeight - titleHeight);
      ctx.clip();

      // 坐标映射函数
      const mapX = (val) =>
        rectX + ((val - plotStartTime) / intervalTime) * cellWidth;
      const mapY = (val) =>
        rectY +
        titleHeight +
        (cellHeight - titleHeight) -
        ((val + voltageRange) / (2 * voltageRange)) *
          (cellHeight - titleHeight);

      // 绘制波形
      ctx.beginPath();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 0.5;
      channelData.forEach((v, i) => {
        const x = mapX(t[i]);
        const y = mapY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.restore();
    }
  }
  // ✅ 给 canvas 添加标签，表示有图
  canvas.dataset.hasContent = "true";
}

//-------------------60个小图，没有降采样------------------------------------------------------------------
// export function plotWaveformsOnGrid(processedData) {
//   const canvas = document.getElementById("panel1Canvas");
//   const ctx = canvas.getContext("2d");
//   const panel = document.getElementById("panel1");

//   const plotStartTime = parseFloat(
//     document.getElementById("start_time1").value
//   );
//   const intervalTime = parseFloat(
//     document.getElementById("time_interval1").value
//   );
//   const fs = processedData.fs;
//   const voltageRange = parseFloat(document.getElementById("voltage1").value)/1000000;
//   const layout = processedData.layout;
//   const Raw_data = processedData.Raw_data;

//   const numSamples = Math.floor(intervalTime * fs);
//   const startIdx = Math.floor(plotStartTime * fs);
//   const endIdx = startIdx + numSamples;

//   const dpi = window.devicePixelRatio || 1;
//   const cssWidth = panel.clientWidth * 0.9;
//   const cssHeight = panel.clientHeight * 0.9;

//   // 设置 canvas 物理尺寸并保持 CSS 尺寸
//   canvas.width = cssWidth * dpi;
//   canvas.height = cssHeight * dpi;
//   canvas.style.width = cssWidth + "px";
//   canvas.style.height = cssHeight + "px";

//   // 缩放到物理像素
//   ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

//   // 每次清空画布
//   ctx.clearRect(0, 0, cssWidth, cssHeight);

//   // 绘制网格边框和标题
//   drawGridOnPanel1();

//   const rows = 8;
//   const cols = 8;
//   const gridGap = 3;
//   const cellWidth = (cssWidth - (cols - 1) * gridGap) / cols - 0.5;
//   const cellHeight = (cssHeight - (rows - 1) * gridGap) / rows - 0.5;

//   const titleHeight = 7; // ⚡ 标题预留高度

//   // 遍历每个小坐标系
//   for (let row = 0; row < rows; row++) {
//     for (let col = 0; col < cols; col++) {
//       // 排除四角
//       if (
//         (row === 0 && col === 0) ||
//         (row === 0 && col === cols - 1) ||
//         (row === rows - 1 && col === 0) ||
//         (row === rows - 1 && col === cols - 1)
//       )
//         continue;

//       const tab = (col + 1) * 10 + (row + 1);
//       const tabIndex = layout.indexOf(tab);
//       if (tabIndex === -1) continue;

//       // 获取波形数据（适用于 Raw_data: numChannels × numSamples）
//       const channelData = Raw_data[tabIndex].slice(startIdx, endIdx);
//       const t = Array.from(
//         { length: channelData.length },
//         (_, i) => plotStartTime + i / fs
//       );

//       // 小坐标系左上角位置
//       const x0 = col * (cellWidth + gridGap);
//       const y0 = row * (cellHeight + gridGap);
//       const rectX = Math.round(x0) + 0.5;
//       const rectY = Math.round(y0) + 0.5;

//       // ⚡ 裁剪波形到小坐标系（避开标题区域）
//       ctx.save();
//       ctx.beginPath();
//       ctx.rect(rectX, rectY + titleHeight, cellWidth, cellHeight - titleHeight);
//       ctx.clip();

//       // 坐标映射函数（避开标题区域）
//       const mapX = (val) =>
//         rectX + ((val - plotStartTime) / intervalTime) * cellWidth;
//       const mapY = (val) =>
//         rectY +
//         titleHeight +
//         (cellHeight - titleHeight) -
//         ((val + voltageRange) / (2 * voltageRange)) *
//           (cellHeight - titleHeight);

//       // 绘制波形
//       ctx.beginPath();
//       ctx.strokeStyle = "black";
//       ctx.lineWidth = 0.5;
//       channelData.forEach((v, i) => {
//         const x = mapX(t[i]);
//         const y = mapY(v);
//         if (i === 0) ctx.moveTo(x, y);
//         else ctx.lineTo(x, y);
//       });
//       ctx.stroke();

//       // 恢复状态，取消裁剪
//       ctx.restore();
//     }
//   }
// }
