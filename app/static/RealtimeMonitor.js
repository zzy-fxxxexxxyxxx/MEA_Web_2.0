// static/RealtimeMonitor.js
import { showToastById } from "./Beautify.js"; // 假设你需要用 toast

const NUM_CHANNELS = 8;
const MAX_TOTAL_CHANNELS = 16; // 总支持通道数
const DEFAULT_VOLTAGE = 500;

export function initRealtimeMonitor(
  socket,
  currentDeviceName,
  currentDeviceId,
) {
  if (!currentDeviceName) return;

  console.log(`🚀 [实时模式] 启动: ${currentDeviceName}`);
  showToastById("toast1", `正在连接: ${currentDeviceName}...`, 3000);

  // 1. 定义状态变量
  let isPanel1Paused = false;
  let isPanel3Paused = false; // ✨ Panel 3 独立暂停
  // 定义一个变量存采样率，默认给 250 防止第一包没收到报错

  let currentSampleRate = 250;
  // ✨✨✨ 新增：生效的时间窗口（默认 0.1 或从 DOM 读取初始值）
  let activeTimeInterval = 0.1;
  const timeInputDOM = document.getElementById("time_interval1");
  if (timeInputDOM) {
    activeTimeInterval = parseFloat(timeInputDOM.value) || 0.1;
  }

  // ✨ 当前选中的单通道 (0表示没选或无效)
  let activeTabChannel = 0;

  // 1. 设置 UI (设备名 & 停止按钮)
  setupMonitorUI(socket, currentDeviceName, currentDeviceId); // ✨ 初始化 Panel 1 UI
  setupPanel3UI(); // ✨ 初始化 Panel 3 UI

  // 2. Socket 监听
  let realtimeChartLeft = null;
  let realtimeChartRight = null;
  let singleChart = null; // ✨ Panel 3

  socket.on("connect", () => {
    console.log("✅ WebSocket 连接成功");
    showToastById("toast3", "连接成功，正在接收信号...", 2000);
    if (currentDeviceId) {
      socket.emit("join_monitor", { device_id: currentDeviceId });
    }
    // 连接成功后初始化图表
    initRealtimeChart();
    updateSingleChartInit(); // ✨ Panel 3 (根据 Tab 初始化)
  });

  socket.on("update_signal_batch", (msg) => {
    // 1. 更新采样率 (如果后端发了的话)
    if (msg.fs) {
      currentSampleRate = msg.fs;
    }
    // Updated: update both charts
    updateRealtimeCharts(msg.data);

    // 2. ✨ 更新 Panel 3 (单通道)
    if (
      singleChart &&
      activeTabChannel > 0 &&
      activeTabChannel <= MAX_TOTAL_CHANNELS
    ) {
      // 从 batch data 中提取特定列
      // msg.data 是 [ [ch1, ch2...], [ch1, ch2...] ]
      // 我们需要把它转成 [ val1, val2... ] 的单列格式
      const columnIndex = activeTabChannel - 1; // Tab 1 对应 Index 0
      const singleColumnData = msg.data.map((row) =>
        row[columnIndex] !== undefined ? row[columnIndex] : 0,
      );

      updateSingleChartBatch(singleChart, singleColumnData, isPanel3Paused);
    }
  });

  // 3. 监听电压输入框变化
  const voltageInput = document.getElementById("voltage1");
  if (voltageInput) {
    voltageInput.addEventListener("change", () => {
      console.log("电压量程改变，重绘图表...");
      // ✅ 新的写法：只更新配置，保留数据
      if (realtimeChartLeft || realtimeChartRight) {
        if (realtimeChartLeft) updateVoltageRange(realtimeChartLeft);
        if (realtimeChartRight) updateVoltageRange(realtimeChartRight);
        if (singleChart) updateVoltageRange(singleChart); // ✨ Panel 3
      } else {
        // 如果图表还没创建（比如刚进页面还没连上socket），那就初始化
        initRealtimeChart();
      }
    });
  }

  // 监听时间输入框
  const timeIntervalInput = document.getElementById("time_interval1");
  if (timeIntervalInput) {
    timeIntervalInput.addEventListener("change", () => {
      const newVal = parseFloat(timeIntervalInput.value);
      if (newVal > 0) {
        console.log(`时间窗口已确认更新为: ${newVal}s`);
        activeTimeInterval = newVal; // ✨✨✨ 核心：只有在这里才更新生效变量
      } else {
        console.log("无效的时间窗口值");
        document.getElementById("time_interval1").value = activeTimeInterval;
      }
    });
  }

  // 3. ✨ Tab 变化监听 (关键)
  const tabInput = document.getElementById("tab1");
  if (tabInput) {
    // 初始化读取
    activeTabChannel = parseInt(tabInput.value) || 0;

    tabInput.addEventListener("change", () => {
      const val = parseInt(tabInput.value);
      if (val >= 1 && val <= MAX_TOTAL_CHANNELS) {
        activeTabChannel = val;
        console.log("Tab 切换为:", activeTabChannel);
      } else {
        console.log("无效的Tab值:", val);
        document.getElementById("tab1").value = activeTabChannel;
      }

      // 重新初始化 Panel 3
      updateSingleChartInit();
    });
  }

  // --- 内部辅助函数 ---
  function getCurrentVoltageRange() {
    const input = document.getElementById("voltage1");
    if (input && input.value) {
      return parseFloat(input.value);
    }
    return DEFAULT_VOLTAGE;
  }

  function setupMonitorUI(socket, name, id) {
    const infoArea = document.getElementById("deviceInfoArea");
    const pauseBtn = document.getElementById("pauseMonitorBtn"); // 获取暂停按钮
    const statusDot = document.getElementById("statusDot"); // 获取呼吸灯

    if (infoArea) {
      infoArea.classList.remove("hidden");
      document.getElementById("monitorDeviceName").textContent = name;

      document.getElementById("monitorDeviceName").textContent = name;

      // --- 绑定暂停按钮逻辑 ---
      if (pauseBtn) {
        pauseBtn.onclick = () => {
          isPanel1Paused = !isPanel1Paused; // 切换状态

          if (isPanel1Paused) {
            // ⏸️ 切换到暂停状态 UI
            pauseBtn.innerHTML = `<i class="fa fa-play text-sm mr-1.5"></i> 继续`;
            pauseBtn.className =
              "flex items-center text-green-600 hover:text-green-700 font-semibold text-sm transition-colors";

            // 让绿灯变灰或停止闪烁，表示“冻结”
            if (statusDot) {
              statusDot.classList.remove("text-green-500", "animate-pulse");
              statusDot.classList.add("text-gray-400");
            }
          } else {
            // ▶️ 切换到运行状态 UI
            pauseBtn.innerHTML = `<i class="fa fa-pause text-sm mr-1.5"></i> 暂停`;
            pauseBtn.className =
              "flex items-center text-amber-500 hover:text-amber-700 font-semibold text-sm transition-colors";

            // 恢复绿灯
            if (statusDot) {
              statusDot.classList.remove("text-gray-400");
              statusDot.classList.add("text-green-500", "animate-pulse");
            }
            // ✨✨✨ 核心修改：点击继续时，立刻手动刷新一次 ✨✨✨
            // 这样用户会看到波形瞬间“跳”到了最新时刻，无缝衔接
            if (realtimeChartLeft) realtimeChartLeft.update("none");
            if (realtimeChartRight) realtimeChartRight.update("none");
          }
        };
      }
      document.getElementById("stopMonitorBtn").onclick = () => {
        if (confirm("确定停止监控并返回首页？")) {
          if (id) socket.emit("leave_monitor", { device_id: id });
          window.location.href = "/";
        }
      };
    }
  }

  function initRealtimeChart() {
    const ctxLeft = document.getElementById("panel1Canvas");
    const ctxRight = document.getElementById("panel1CanvasRight");

    // 1. Destroy old instances
    if (realtimeChartLeft) realtimeChartLeft.destroy();
    if (realtimeChartRight) realtimeChartRight.destroy();

    // 同时也尝试用 Chart.js 静态方法销毁关联的 chart
    const existingLeft = Chart.getChart(ctxLeft);
    if (existingLeft) existingLeft.destroy();

    if (ctxRight) {
      const existingRight = Chart.getChart(ctxRight);
      if (existingRight) existingRight.destroy();
    }

    // 2. Adjust Layout for 16 channels (8 Left + 8 Right)
    const wrapperLeft = document.querySelector(".wrapper-left");
    const wrapperRight = document.querySelector(".wrapper-right");

    if (wrapperRight && wrapperLeft) {
      wrapperRight.classList.remove("hidden");
      wrapperRight.classList.add("flex-1");

      wrapperLeft.classList.remove("w-full", "max-w-[100%]");
      wrapperLeft.classList.add("flex-1", "max-w-[50%]"); // 显式限制宽度
    }

    // 3. Create Charts
    // Left: Ch1-Ch8 (offset 0)
    if (ctxLeft) {
      realtimeChartLeft = createSubChart(ctxLeft, 0);
    }
    // Right: Ch9-Ch16 (offset 8)
    if (ctxRight) {
      realtimeChartRight = createSubChart(ctxRight, 8);
    }
  }

  // 辅助函数：创建单个Chart实例
  function createSubChart(ctx, channelOffset) {
    const currentRange = getCurrentVoltageRange();
    const TARGET_TICK = currentRange * 0.7;
    const datasets = [];
    const scales = {
      x: { type: "category", display: false, grid: { display: false } },
    };

    const colors = [
      "#165DFF",
      "#722ED1",
      "#F53F3F",
      "#00B42A",
      "#FF7D00",
      "#F7BA1E",
      "#9FDB1D",
      "#14C9C9",
    ];

    for (let i = 0; i < NUM_CHANNELS; i++) {
      datasets.push({
        label: `Ch ${channelOffset + i + 1}`, // e.g. Ch 1 or Ch 9
        data: [],
        borderColor: colors[i % colors.length],
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: `y_ch${i}`,
        clip: 0,
      });

      scales[`y_ch${i}`] = {
        type: "linear",
        display: true,
        position: "left",
        stack: "channelStack",
        stackWeight: 1,
        min: -currentRange,
        max: currentRange,
        afterBuildTicks: (axis) => {
          axis.ticks = [
            { value: -currentRange },
            { value: -TARGET_TICK },
            { value: 0 },
            { value: TARGET_TICK },
            { value: currentRange },
          ];
        },
        // 删除内建 Title，改用 Plugin 绘制，彻底解决旋转/重叠问题
        title: {
          display: false,
        },
        grid: {
          drawBorder: false,
          tickLength: 0,
          color: (ctx) => {
            if (ctx.tick.value === currentRange) return "#212121";
            if (ctx.tick.value === -currentRange) return "#212121";
            if (ctx.tick.value === 0) return "rgba(0,0,0, 0.05)";
            return "transparent";
          },
          borderDash: (ctx) => (ctx.tick.value === 0 ? [4, 4] : []),
        },
        ticks: {
          padding: 5,
          font: { size: 9 },
          color: "#86909C",
          autoSkip: false,
          callback: function (value) {
            if (Math.abs(value - TARGET_TICK) < 0.1)
              return `+${TARGET_TICK.toFixed(0)}`;
            if (Math.abs(value + TARGET_TICK) < 0.1)
              return `-${TARGET_TICK.toFixed(0)}`;
            if (Math.abs(value) < 0.1) return `0`;
            return "";
          },
        },
      };
    }

    // const labelPlugin = {
    //   id: 'channelLabels',
    //   afterDraw: (chart) => {
    //     const ctx = chart.ctx;
    //     ctx.save();
    //     ctx.font = "bold 13px Arial";
    //     ctx.textAlign = "left";
    //     ctx.textBaseline = "middle";

    //     for (let i = 0; i < NUM_CHANNELS; i++) {
    //         const yAxis = chart.scales[`y_ch${i}`];
    //         if (!yAxis) continue;

    //         // 计算垂直中心
    //         const y = (yAxis.top + yAxis.bottom) / 2;

    //         // 我们在左侧预留了 padding，这里将文字画在 padding 区域内
    //         // x = 5 表示距离 Canvas 最左边 5px
    //         ctx.fillStyle = colors[i % colors.length];
    //         ctx.fillText(`C${channelOffset + i + 1}`, 5, y);
    //     }
    //     ctx.restore();
    //   }
    // };

    const labelPlugin = {
      id: "channelLabels",
      afterDraw: (chart) => {
        const ctx = chart.ctx;

        for (let i = 0; i < NUM_CHANNELS; i++) {
          const yAxis = chart.scales[`y_ch${i}`];
          if (!yAxis) continue;

          const y = (yAxis.top + yAxis.bottom) / 2; // 垂直中心
          const x = 15; // 水平位置（距左边界）

          ctx.save();
          // 1. 将坐标系平移到 (x, y)
          ctx.translate(x, y);
          // 2. 旋转 90 度（逆时针）
          ctx.rotate(Math.PI*3 / 2);
          // 3. 设置文字样式
          ctx.font = "bold 13px Arial";
          ctx.textAlign = "center"; // 水平居中（相对于旋转后的 x 方向）
          ctx.textBaseline = "middle"; // 垂直居中（相对于旋转后的 y 方向）
          ctx.fillStyle = colors[i % colors.length];
          // 4. 在 (0, 0) 处绘制文本（因为我们已经平移到了目标点）
          ctx.fillText(`C${channelOffset + i + 1}`, 0, 0);
          ctx.restore();
        }
      },
    };

    return new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: datasets },
      plugins: [labelPlugin], // 注册插件
      options: {
        responsive: true,
        // 关键点：禁用宽高比，让 Chart.js 填充整个 Canvas 容器
        maintainAspectRatio: false,
        // 显式指定 pixelRatio，防止 CSS 拉伸导致文字模糊/变形
        devicePixelRatio: window.devicePixelRatio || 1,
        layout: {
          padding: {
            left: 20, // 预留左侧空间给 C1, C2 标签，防止重叠
          },
        },
        animation: false,
        interaction: { mode: "none", intersect: false },
        plugins: { legend: { display: false }, tooltip: { enabled: false } }, // tooltip enabled: false is key
        scales: scales,
      },
    });
  }

  // data update wrapper
  function updateRealtimeCharts(batchData) {
    if (realtimeChartLeft) updateEachChart(realtimeChartLeft, batchData, 0);
    if (realtimeChartRight) updateEachChart(realtimeChartRight, batchData, 8);
  }

  // actual update logic (replaces updateChartBatch)
  function updateEachChart(chart, batchData, offset) {
    const labels = chart.data.labels;
    batchData.forEach((row) => {
      labels.push("");
      for (let i = 0; i < NUM_CHANNELS; i++) {
        // row index = local index + offset
        // e.g. for Right Chart (offset 8), we need row[8]..row[15]
        const val = row[i + offset] !== undefined ? row[i + offset] : 0;
        chart.data.datasets[i].data.push(val);
      }
    });

    // ============================================================
    // ✨ 核心修改：动态计算窗口大小
    // ============================================================

    // 2. 获取用户设定的时间 (秒)
    // ✅ 改用变量：
    const displayTimeSeconds = activeTimeInterval;

    // 3. 计算目标点数 = 时间(s) * 采样率(Hz)
    // 例如: 0.5s * 250Hz = 125点
    const targetWindowSize = Math.floor(displayTimeSeconds * currentSampleRate);

    // 4. 滑动窗口：移除超出的数据
    const currentLength = labels.length;
    const pointsToRemove = currentLength - targetWindowSize;

    if (pointsToRemove > 0) {
      labels.splice(0, pointsToRemove);
      for (let i = 0; i < NUM_CHANNELS; i++) {
        chart.data.datasets[i].data.splice(0, pointsToRemove);
      }
    }
    // 3. ✨✨✨ 核心修改：只有在【没暂停】的时候才画图 ✨✨✨
    if (!isPanel1Paused) {
      chart.update("none");
    }
  }

  // ✨ 新增：只更新电压量程，不销毁图表
  // ✨ 改进版：通用电压量程更新（支持 Panel 1 多轴 和 Panel 3 单轴）
  function updateVoltageRange(chart) {
    if (!chart) return;

    const newRange = getCurrentVoltageRange();
    const TARGET_TICK = newRange * 0.7;

    // 1️⃣ 情况 A：Panel 1 (多通道，轴 ID 为 y_ch0, y_ch1...)
    for (let i = 0; i < NUM_CHANNELS; i++) {
      const scaleId = `y_ch${i}`;
      const scale = chart.options.scales[scaleId];
      if (scale) {
        updateScaleConfig(scale, newRange, TARGET_TICK);
      }
    }

    // 2️⃣ 情况 B：Panel 3 (单通道，轴 ID 通常为 'y')
    const singleScale = chart.options.scales["y"];
    if (singleScale) {
      updateScaleConfig(singleScale, newRange, TARGET_TICK);
    }

    // 立即更新视图，保留数据
    chart.update("none");
  }

  // ✨ 提取出来的公共函数：配置单个坐标轴
  function updateScaleConfig(scale, range, tickValue) {
    // 1. 更新范围
    scale.min = -range;
    scale.max = range;

    // 2. 更新刻度点 (afterBuildTicks)
    scale.afterBuildTicks = (axis) => {
      axis.ticks = [
        { value: -range },
        { value: -tickValue },
        { value: 0 },
        { value: tickValue },
        { value: range },
      ];
    };

    // 3. 更新刻度文字 (callback)
    if (scale.ticks) {
      scale.ticks.callback = function (value) {
        if (Math.abs(value - tickValue) < 0.1)
          return `+${tickValue.toFixed(0)}`;
        if (Math.abs(value + tickValue) < 0.1)
          return `-${tickValue.toFixed(0)}`;
        if (Math.abs(value) < 0.1) return `0`;
        return "";
      };
    }

    // 4. 更新网格颜色 (grid.color)
    if (scale.grid) {
      scale.grid.color = (context) => {
        if (context.tick.value === range) return "#212121"; // 深色顶线
        if (context.tick.value === -range) return "#212121"; // 深色底线
        if (context.tick.value === 0) return "rgba(0,0,0, 0.05)"; // 零线
        return "transparent";
      };
      // 保持虚线逻辑
      scale.grid.borderDash = (context) =>
        context.tick.value === 0 ? [4, 4] : [];
    }
  }

  // =========================================
  // ✨ Panel 3 专用逻辑区
  // =========================================

  function setupPanel3UI() {
    const ctrlArea = document.getElementById("panel3ControlArea");
    const pauseBtn = document.getElementById("pausePanel3Btn");

    if (ctrlArea && pauseBtn) {
      pauseBtn.onclick = () => {
        isPanel3Paused = !isPanel3Paused;
        if (isPanel3Paused) {
          pauseBtn.innerHTML = `<i class="fa fa-play text-sm mr-1.5"></i> 继续`;
          pauseBtn.className =
            "flex items-center text-green-600 hover:text-green-700 font-semibold text-sm transition-colors";
        } else {
          // ✅ 改为：强制刷新一次，把后台攒的数据立刻画出来
          if (singleChart) singleChart.update("none");
          pauseBtn.innerHTML = `<i class="fa fa-pause text-sm mr-1.5"></i> 暂停`;
          pauseBtn.className =
            "flex items-center text-amber-500 hover:text-amber-700 font-semibold text-sm transition-colors";
        }
      };
    }
  }

  // 根据 Tab 值决定是否创建或销毁图表
  function updateSingleChartInit() {
    const displaySpan = document.getElementById("panel3ChannelDisplay");
    const ctrlArea = document.getElementById("panel3ControlArea");
    const ctx = document.getElementById("canvas1");

    // 如果 Tab 无效 (0 或 >16)
    if (activeTabChannel < 1 || activeTabChannel > MAX_TOTAL_CHANNELS) {
      if (singleChart) {
        singleChart.destroy();
        singleChart = null;
      }
      if (ctrlArea) ctrlArea.classList.add("hidden");
      if (ctx) {
        const context = ctx.getContext("2d");
        context.clearRect(0, 0, ctx.width, ctx.height);
      }
      return;
    }

    // Tab 有效
    if (ctrlArea) ctrlArea.classList.remove("hidden");
    if (displaySpan) displaySpan.textContent = `C${activeTabChannel}`;

    // 初始化图表 (如果还没创建)
    if (!ctx) return;

    // 销毁旧的 (万一颜色变了或者之前的状态不对)
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    const currentRange = getCurrentVoltageRange();
    const TARGET_TICK = currentRange * 0.7;

    // 颜色数组 (对应 16 个通道)
    const colors = [
      "#165DFF",
      "#722ED1",
      "#F53F3F",
      "#00B42A",
      "#FF7D00",
      "#F7BA1E",
      "#9FDB1D",
      "#14C9C9",
      "#FF6699",
      "#B37FEB",
      "#FF9966",
      "#66FFCC",
      "#CCCC33",
      "#33CCFF",
      "#CC99FF",
      "#FF3333",
    ];
    // 获取对应通道颜色 (Index = Channel - 1)
    const chColor = colors[(activeTabChannel - 1) % colors.length];

    // 创建配置
    singleChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: `Ch ${activeTabChannel}`,
            data: [],
            borderColor: chColor,
            borderWidth: 2, // 单通道可以粗一点
            pointRadius: 0,
            tension: 0.4,
            clip: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "none", intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            type: "linear",
            min: -currentRange,
            max: currentRange,
            afterBuildTicks: (axis) => {
              axis.ticks = [
                { value: -currentRange },
                { value: -TARGET_TICK },
                { value: 0 },
                { value: TARGET_TICK },
                { value: currentRange },
              ];
            },
            grid: {
              color: (c) =>
                c.tick.value === -currentRange
                  ? "#212121"
                  : c.tick.value === currentRange
                    ? "#212121"
                    : c.tick.value === 0
                      ? "rgba(0,0,0,0.1)"
                      : "transparent",
              borderDash: (c) => (c.tick.value === 0 ? [4, 4] : []),
            },
            ticks: {
              font: { size: 10 },
              color: "#86909C",
              callback: (val) => {
                if (val === 0) return "0";

                if (Math.abs(val) === TARGET_TICK) {
                  return val > 0 ? `+${val}` : `${val}`;
                }

                return "";
              },
            },
          },
        },
      },
    });
  }

  // Panel 3 的数据更新逻辑 (单通道)
  function updateSingleChartBatch(chart, dataArray, isPaused) {
    const labels = chart.data.labels;
    const dataset = chart.data.datasets[0];

    // 添加数据
    dataArray.forEach((val) => {
      labels.push("");
      dataset.data.push(val);
    });

    // 裁剪数据 (使用统一的 activeTimeInterval)
    const targetSize = Math.floor(activeTimeInterval * currentSampleRate);
    const removeCount = labels.length - targetSize;

    if (removeCount > 0) {
      labels.splice(0, removeCount);
      dataset.data.splice(0, removeCount);
    }
    // 3. ✨ 只有在【没暂停】的时候才渲染视图
    if (!isPaused) {
      chart.update("none");
    }
  }
}
