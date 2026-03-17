//---------------------------------绘制坐标系边框------------------------------------------------------------
export function drawGridOnPanel1() {
  const canvas = document.getElementById("panel1Canvas");
  if (!canvas) return;

  // --- Fix Layout: Ensure full width for static plot ---
  const wrapperLeft = canvas.closest('.wrapper-left');
  const wrapperRight = document.getElementById('panel1CanvasRightWrapper');
  
  // Clean up any Chart.js instance on this canvas to prevent it from interfering
  try {
      // Assuming Chart.js is global or accessible, but if not we can just try to clear
      // If window.Chart exists, we might want to destroy. 
      // check if a chart instance is attached to the DOM node
      const chartInstance = Chart.getChart(canvas);
      if (chartInstance) {
          chartInstance.destroy();
      }
  } catch (e) {
      console.log("No chart instance to destroy or Chart not defined");
  }

  if (wrapperLeft && wrapperRight) {
      // Hide right panel
      wrapperRight.classList.add('hidden');
      wrapperRight.classList.remove('flex-1'); // Remove flex-1 to collapse it
      
      // Make left panel full width
      wrapperLeft.classList.remove('flex-1', 'max-w-[50%]'); // Remove split-view constraints
      wrapperLeft.classList.add('w-full', 'max-w-full'); // Force full width
  }
  // ----------------------------------------------------

  const ctx = canvas.getContext("2d");
  
  // 使用 offsetWidth/offsetHeight 代替 clientWidth，确保能拿到实际物理尺寸
  // 如果这些值为 0，说明容器不可见或未布局，直接返回防止错误
  const width = canvas.parentElement.offsetWidth;
  const height = canvas.parentElement.offsetHeight;
  
  if (!width || !height) return;

  const dpi = window.devicePixelRatio || 1;

  // 设置 Canvas 分辨率
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  
  // 移除内联样式，让 CSS 生效 (w-full h-full from class)
  canvas.style.width = "";
  canvas.style.height = "";

  // 缩放逻辑坐标
  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // 网格参数
  const gridGap = 3;
  const rows = 8;
  const cols = 8;

  // 使用 90% 的区域进行绘制 (视觉上留白)
  const drawWidth = width * 0.9;
  const drawHeight = height * 0.9;
  const centerOffsetX = (width - drawWidth) / 2;
  const centerOffsetY = (height - drawHeight) / 2;

  // 计算每个小坐标系尺寸（减去缝隙）
  const cellWidth = (drawWidth - (cols - 1) * gridGap) / cols - 0.5;
  const cellHeight = (drawHeight - (rows - 1) * gridGap) / rows - 0.5;

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
      const x = centerOffsetX + col * (cellWidth + gridGap);
      const y = centerOffsetY + row * (cellHeight + gridGap);

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
  if (!canvas) return;

  // --- Fix Layout: Ensure full width for static plot ---
  const wrapperLeft = canvas.closest('.wrapper-left');
  const wrapperRight = document.getElementById('panel1CanvasRightWrapper');
  
  if (wrapperLeft && wrapperRight) {
      if (!wrapperRight.classList.contains('hidden')) {
           wrapperRight.classList.add('hidden');
           wrapperRight.classList.remove('flex-1');
      }
      if (wrapperLeft.classList.contains('max-w-[50%]')) {
           wrapperLeft.classList.remove('flex-1', 'max-w-[50%]');
           wrapperLeft.classList.add('w-full', 'max-w-full');
      }
  }
  // ----------------------------------------------------

  const ctx = canvas.getContext("2d");
  
  // 使用 offsetWidth/Height
  const width = canvas.parentElement.offsetWidth;
  const height = canvas.parentElement.offsetHeight;
  
  if (!width || !height) return;

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

  canvas.width = width * dpi;
  canvas.height = height * dpi;
  
  // 移除内联样式
  canvas.style.width = "";
  canvas.style.height = "";
  
  // 标记已有内容
  canvas.dataset.hasContent = "true";

  ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // 绘制网格边框和标题 (注意：这会重置 transform，所以先调用)
  // 为了复用代码并防止重复计算，这里我们重新内联绘制，或者修改 drawGridOnPanel1 接受参数
  // 简单起见，这里直接复用 drawGridOnPanel1 的绘制逻辑
  drawGridOnPanel1();

  // ----- 重新计算坐标参数 (与 drawGridOnPanel1 保持一致) -----
  const gridGap = 3;
  const rows = 8;
  const cols = 8;
  const drawWidth = width * 0.9;
  const drawHeight = height * 0.9;
  const centerOffsetX = (width - drawWidth) / 2;
  const centerOffsetY = (height - drawHeight) / 2;
  
  const cellWidth = (drawWidth - (cols - 1) * gridGap) / cols - 0.5;
  const cellHeight = (drawHeight - (rows - 1) * gridGap) / rows - 0.5;

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
      const x0 = centerOffsetX + col * (cellWidth + gridGap);
      const y0 = centerOffsetY + row * (cellHeight + gridGap);
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
