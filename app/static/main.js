import * as h5wasm from "https://cdn.jsdelivr.net/npm/h5wasm@0.7.8/dist/esm/hdf5_hl.js";

import { openTab, drawAxes } from "./basic_func.js";
import {
  toNumberIfBigInt,
  dataPreprocessing,
  readH5File,
  detectPeaks,
} from "./DataProcess.js";
import { drawGridOnPanel1, plotWaveformsOnGrid } from "./Panel1_def.js";
import {
  drawGridOnPanel2,
  heatCalculate,
  drawSmoothHeatmapTransparentCorners,
  drawArrow,
} from "./Panel2_def.js";
import { originalPeakEnlargement } from "./Panel3_def.js";
import { plotAllSignals } from "./Panel4_def.js";
import { saveCanvasWithTimestamp, saveSVGWithFormat } from "./Save.js";
import { showToastById } from "./Beautify.js";

//------------------------------------DOMContentLoaded----------------------------------------------------------------

// 等页面加载完成再执行下面的逻辑
document.addEventListener("DOMContentLoaded", async () => {
  const currentDeviceId = document.body.dataset.deviceId;
  const currentDeviceName = document.body.dataset.deviceName; // 建议把名字也一并读了

  // 获取所有按钮和内容
  const tabButtons = document.querySelectorAll(".tablinks");
  const tabContents = document.querySelectorAll(".tabcontent");
  // 左侧顶端tab选择，给按钮绑定事件
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      openTab(tabName, btn, tabButtons, tabContents);
    });
  });
  // 默认打开第一个 tab
  if (tabButtons.length > 0) {
    openTab(tabButtons[0].dataset.tab, tabButtons[0], tabButtons, tabContents);
  }
  //------------------------------大板块点击变蓝----------------------------------------
  document.querySelectorAll(".grid > div").forEach((item) => {
    item.addEventListener("click", function () {
      // 移除所有选中状态
      document.querySelectorAll(".grid > div").forEach((el) => {
        el.classList.remove(
          "bg-primary/10",
          "border-2",
          "border-primary",
          "text-primary",
          "font-bold",
        );
        el.classList.add(
          "bg-white",
          "border",
          "border-gray-200",
          "text-gray-500",
        );
      });

      // 设置当前选中状态
      this.classList.remove(
        "bg-white",
        "border",
        "border-gray-200",
        "text-gray-500",
      );
      this.classList.add(
        "bg-primary/10",
        "border-2",
        "border-primary",
        "text-primary",
        "font-bold",
      );
    });
  });

  //---------------------------------------------颜色选择器-------------------------------------
  // const gradients = {
  //   color1:
  //     "linear-gradient(to right, #007b9a, #00a8cc, #66cbe9, #84d3ea, #a9deec, #d1ecf3, #fafeff, #fde4c8, #fdc999, #faab68, #f68d37, #ca5a28, #984221)",
  //   color2: "linear-gradient(to right, #88A2C7, #77B3DF, #95CB62, #FADC7E)",
  //   color3:
  //     "linear-gradient(to right, #a60026, #bf1927, #d93328, #e85337, #f57446, #fa9656, #fdb668, #fed081, #fee79a, #fff7b3, #f7fcce, #e7f6ec, #cfebf3, #b3ddeb, #97c9e0, #7ab2d4, #6095c5, #4778b6, #3c57a5, #313695)",
  //   color4:
  //     "linear-gradient(to right, #5C1877, #AA3379, #FFAA76, #FEECAF, #FFD3B6)",
  //   color5:
  //     "linear-gradient(to right, #79a6ce, #aed2e5, #f0f8dc, #fdf7b4, #ffe69a)",
  //   color6:
  //     "linear-gradient(to right, #6B95C5, #A5DEF1, #ACD7A8, #FAAD73, #FAE791)",
  //   color7:
  //     "linear-gradient(to right, #000000, #FF0000, #FF7F00, #FFD700, #FFFF00)",
  // };

  // const selectTrigger = document.getElementById("selectTrigger");
  // const selectOptions = document.getElementById("selectOptions");
  // const selectedColorPreview = document.getElementById("selectedColorPreview");
  // const body = document.body;

  // // 初始化选项预览
  // for (let i = 1; i <= 7; i++) {
  //   const preview = document.getElementById(`preview-color${i}`);
  //   if (preview) preview.style.backgroundImage = gradients[`color${i}`];
  // }

  // // 显示下拉
  // selectTrigger.addEventListener("click", (e) => {
  //   e.stopPropagation();
  //   selectOptions.classList.toggle("visible");
  //   selectTrigger.classList.toggle("active");
  // });

  // // 选项点击
  // document.querySelectorAll(".option").forEach((option) => {
  //   option.addEventListener("click", () => {
  //     const value = option.getAttribute("data-value");
  //     if (!gradients[value]) return;
  //     selectedColorPreview.style.backgroundImage = gradients[value];
  //     selectedColorPreview.style.border = "1px solid #000"; // 高亮边框
  //     body.style.backgroundImage = gradients[value];
  //     selectOptions.classList.remove("visible");
  //     selectTrigger.classList.remove("active");
  //   });
  // });

  // // 点击页面其他区域关闭下拉
  // document.addEventListener("click", () => {
  //   selectOptions.classList.remove("visible");
  //   selectTrigger.classList.remove("active");
  // });

  // // 默认显示第一个颜色
  // selectedColorPreview.style.backgroundImage = gradients.color1;
  // body.style.backgroundImage = gradients.color1;

  //----------------------------------------------------------------------------------
  // 画 panel3 和 panel4 的坐标系
  drawAxes("chart1");
  drawAxes("chart2");

  //---------------------------数据预处理-------------------------

  // 等待 h5wasm 初始化完成
  await h5wasm.ready;

  let processedData = null;

  // 绑定按钮点击事件
  document.getElementById("submitBtn").addEventListener("click", async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: "HDF5 files",
            accept: { "application/octet-stream": [".h5"] },
          },
        ],
      });
      const file = await fileHandle.getFile();

      // 先显示 toast，告诉用户文件正在加载
      showToastById("toast1", "文件加载中... ⏳", 2000);

      // 等浏览器先渲染 toast，再执行耗时操作
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // 读取 HDF5 文件
      const h5Data = await readH5File(file);
      console.log("原始 h5Data:", h5Data);

      // 转换 InfoChannel 数据
      const stream0 = h5Data.Data.Recording_0.AnalogStream.Stream_0;
      stream0.InfoChannel = stream0.InfoChannel.map((row) => ({
        ChannelID: toNumberIfBigInt(row[0]),
        RowIndex: toNumberIfBigInt(row[1]),
        GroupID: toNumberIfBigInt(row[2]),
        ElectrodeGroup: toNumberIfBigInt(row[3]),
        Label: row[4],
        RawDataType: row[5],
        Unit: row[6],
        Exponent: toNumberIfBigInt(row[7]),
        ADZero: toNumberIfBigInt(row[8]),
        Tick: toNumberIfBigInt(row[9]),
        ConversionFactor: toNumberIfBigInt(row[10]),
        ADCBits: toNumberIfBigInt(row[11]),
        HighPassFilterType: row[12],
        HighPassFilterCutOffFrequency: row[13],
      }));

      // 转置 InfoChannel
      function transposeInfoChannel(infoChannelArray) {
        const result = {};
        infoChannelArray.forEach((row) => {
          Object.entries(row).forEach(([key, value]) => {
            if (!result[key]) result[key] = [];
            result[key].push(value);
          });
        });
        return result;
      }
      stream0.InfoChannel = transposeInfoChannel(stream0.InfoChannel);
      console.log("改造后的 InfoChannel:", stream0.InfoChannel);

      // 数据预处理
      processedData = await dataPreprocessing(h5Data);

      // 更新文件名和总时长
      document.getElementById("filename").value = file.name;
      document.getElementById("total_time").value =
        processedData.rawData[0].length / processedData.fs;

      // 最终显示 toast 提示读取完成
      showToastById("toast1", "读取文件成功 ✅", 1000);
    } catch (err) {
      console.error(err);
      showToastById("toast1", "文件读取失败 ❌", 1000);
    }
  });

  //------------------------------------Panel 1,2初始化--------------------------------------------------------------------
  drawGridOnPanel1();
  drawGridOnPanel2();

  //------------------------------------Panel 1，3--------------------------------------------------------------------
  document.getElementById("plot1").addEventListener("click", () => {
    plotWaveformsOnGrid(processedData); // processedData 是你 dataPreprocessing 的结果

    if (document.getElementById("tab1").value != 0) {
      originalPeakEnlargement(processedData); // processedData 是你前面 dataPreprocessing 的结果
    }
  });

  //------------------------------------Panel 2--------------------------------------------------------------------

  // discharge_detection 按钮事件
  document
    .getElementById("discharge_detection")
    .addEventListener("click", async () => {
      try {
        // 🔹 显示“放电检测中”
        showToastById("toast2", "放电检测中... ⏳", 200); // 0 表示持续显示

        // 🔹 延迟 50ms 让浏览器先渲染 toast
        await new Promise((resolve) => setTimeout(resolve, 50));

        // 🔹 异步执行 detectPeaks
        processedData = await detectPeaks(processedData, 60, 4);

        // 🔹 更新检测结果
        document.getElementById("detection_result").value =
          processedData.peakArriveTime.length;

        const epochInput = document.getElementById("epoch");
        epochInput.disabled = false;
        epochInput.title = "请输入不可超过放电次数的正整数";
        epochInput.value = 1;
        epochInput.max = processedData.peakArriveTime.length;
        document.getElementById("time").value =
          processedData.peakBaseTimes[epochInput.value - 1];

        epochInput.addEventListener("blur", () => {
          const min = parseInt(epochInput.min, 10);
          const max = parseInt(epochInput.max, 10);
          const value = Number(epochInput.value);

          if (!Number.isInteger(value) || value < min || value > max) {
            alert(`请输入 ${min}-${max} 的整数！`);
            epochInput.value = 1;
            epochInput.focus();
            return;
          }

          document.getElementById("time").value =
            processedData.peakBaseTimes[epochInput.value - 1];
        });

        // 🔹 检测完成，显示“放电检测成功”
        showToastById("toast2", "放电检测成功 ✅", 1000); // 自动淡出
      } catch (err) {
        console.error(err);
        showToastById("toast2", "放电检测失败 ❌", 1000);
      }
    });

  let HeatMapData = null;

  document.getElementById("plot2").addEventListener("click", async () => {
    // drawElectrodeHeatmap(processedData);

    const t0Input = document.getElementById("epoch");
    let t0 = Math.round(Number(t0Input?.value) || 0);

    HeatMapData = await heatCalculate(
      processedData.peakArriveTime[t0 - 1], //减去1来对其索引
      processedData.fs,
      processedData.layout,
    );
    drawGridOnPanel2();
    drawSmoothHeatmapTransparentCorners(HeatMapData, "color1");
  });

  document.getElementById("remove2").addEventListener("click", async () => {
    // drawElectrodeHeatmap(processedData);

    const t0Input = document.getElementById("epoch");
    let t0 = Math.round(Number(t0Input?.value) || 0);

    HeatMapData = await heatCalculate(
      processedData.peakArriveTime[t0 - 1], //减去1来对其索引
      processedData.fs,
      processedData.layout,
    );
    drawGridOnPanel2();
    drawSmoothHeatmapTransparentCorners(HeatMapData, "color1");
  });

  document.getElementById("arrow").addEventListener("click", async () => {
    if (!HeatMapData) {
      alert("HeatMapData 还没有生成，请先点击 plot2 按钮！");
      return;
    }
    console.log("用来画箭头的HeatMapData:", HeatMapData);
    drawArrow(HeatMapData, 2);
  });

  // document.getElementById("plot3").addEventListener("click", async () => {
  //   // 调用封装好的函数绘制
  //   await plotAllSignals(processedData);
  // });

  document.getElementById("plot3").addEventListener("click", async () => {
    try {
      // 显示“数据计算中...”提示（持续显示）
      showToastById("toast3", "数据计算中... ⏳", 20000);

      await new Promise((r) => requestAnimationFrame(r)); // 等一帧渲染
      await new Promise((r) => setTimeout(r, 10)); // 额外缓冲
      // 调用封装好的函数绘制
      await plotAllSignals(processedData);

      // 成功后提示“放电检测成功”
      showToastById("toast3", "数据计算成功 ✅", 1000); // 自动淡出
    } catch (err) {
      console.error(err);
      // 失败提示
      showToastById("toast3", "数据计算失败 ❌", 1000);
    }
  });

  //----------------------------Save功能-----------------------------------------------------
  document.getElementById("savePanel1").addEventListener("click", () => {
    saveCanvasWithTimestamp("panel1Canvas", "Original_Peaks", "white");
  });
  document.getElementById("savePanel3").addEventListener("click", () => {
    saveCanvasWithTimestamp("canvas1", "Original_Peak_Enlargement", "white");
  });
  document.getElementById("savePanel2").addEventListener("click", () => {
    saveSVGWithFormat("panel2SVG", "Heatmap", "white");
  });
  document.getElementById("savePanel4").addEventListener("click", () => {
    saveCanvasWithTimestamp("canvas2", "Filtering Signal", "white");
  });

  //------------------------------------面板放大与还原逻辑------------------------------------

  const panels = document.querySelectorAll("main .grid > div");
  const mainGrid = document.querySelector("main .grid");

  panels.forEach((panel, index) => {
    const expandBtn = panel.querySelector(`#expandPanel${index + 1}`);
    const icon = expandBtn.querySelector("i");
    const contentWrapper = panel.querySelector("canvas, svg")?.parentElement; // 父容器

    expandBtn.addEventListener("click", () => {
      const isExpanded = panel.classList.contains("expanded");

      if (!isExpanded) {
        // 🌟 放大状态
        panels.forEach((p) => {
          if (p !== panel) p.style.display = "none";
        });
        panel.classList.add("expanded");
        mainGrid.classList.add("single-panel-mode");
        icon.classList.replace("fa-expand", "fa-compress");

        // 父容器高度适应 main
        if (contentWrapper) {
          contentWrapper.style.height = "90%";
        }
      } else {
        // 🔙 缩小状态
        panels.forEach((p) => (p.style.display = "block"));
        panel.classList.remove("expanded");
        mainGrid.classList.remove("single-panel-mode");
        icon.classList.replace("fa-compress", "fa-expand");

        // 恢复原高度
        if (contentWrapper) {
          contentWrapper.style.height = ""; // 清空，恢复 h-[350px]
        }
      }

      // 根据 index 处理内容

      // 重新绘制 canvas 或更新 SVG
      switch (index) {
        case 0:
          // requestAnimationFrame(() => requestAnimationFrame(drawGridOnPanel1));
          // if (
          //   document.getElementById("panel1Canvas").dataset.hasContent ===
          //   "true"
          // ) {
          //   requestAnimationFrame(() =>
          //     requestAnimationFrame(() => plotWaveformsOnGrid(processedData))
          //   );
          // }
          break;
        case 1:
          // // SVG 调整宽高自适应
          // requestAnimationFrame(() => requestAnimationFrame(drawGridOnPanel2));

          // // 获取 heatmapLayer
          // const heatmapLayer = document.querySelector(
          //   "#panel2SVG #heatmapLayer"
          // );
          // // 判断 heatmapLayer 是否有实际尺寸
          // if (
          //   heatmapLayer &&
          //   (heatmapLayer.getBBox().width > 0 ||
          //     heatmapLayer.getBBox().height > 0)
          // ) {
          //   // 如果有尺寸，延迟执行 drawSmoothHeatmapTransparentCorners 保证布局完成
          //   requestAnimationFrame(() =>
          //     requestAnimationFrame(() =>
          //       drawSmoothHeatmapTransparentCorners(HeatMapData, "color1")
          //     )
          //   );
          // }

          // // 获取 arrowsLayer
          // const arrowsLayer = document.querySelector("#panel2SVG #arrowsLayer");
          // // 判断 arrowsLayer 是否有实际尺寸
          // if (
          //   arrowsLayer &&
          //   (arrowsLayer.getBBox().width > 0 ||
          //     arrowsLayer.getBBox().height > 0)
          // ) {
          //   // 如果有尺寸，延迟执行 drawArrow 保证布局完成
          //   requestAnimationFrame(() =>
          //     requestAnimationFrame(() => drawArrow(HeatMapData, 2))
          //   );
          // }
          break;
        case 2:
          // 当表达式 === 值1 时执行的代码
          break;
        case 3:
          // 当表达式 === 值2 时执行的代码
          break;
        default:
        // 如果都没有匹配，执行这里的代码
      }
    });
  });

  //------------------------------------删除按键---------------------------------------------
  // 1️⃣ Panel1：重新绘制网格
  document.getElementById("refreshPanel1").addEventListener("click", () => {
    drawGridOnPanel1();
    document.getElementById("panel1Canvas").dataset.hasContent = "false";
  });

  // 2️⃣ Panel2：清空 heatmapLayer 和 arrowsLayer 内容
  document.getElementById("refreshPanel2").addEventListener("click", () => {
    const heatmapLayer = document.getElementById("heatmapLayer");
    const arrowsLayer = document.getElementById("arrowsLayer");
    if (heatmapLayer) heatmapLayer.innerHTML = "";
    if (arrowsLayer) arrowsLayer.innerHTML = "";
    drawGridOnPanel2();
  });

  // 3️⃣ Panel3：清空 canvas1 内容
  document.getElementById("refreshPanel3").addEventListener("click", () => {
    const canvas1 = document.getElementById("canvas1");
    if (canvas1) {
      const ctx = canvas1.getContext("2d");
      ctx.clearRect(0, 0, canvas1.width, canvas1.height);
    }
    canvas1.dataset.hasContent = "false";
  });

  // 4️⃣ Panel4：清空 canvas2 内容
  document.getElementById("refreshPanel4").addEventListener("click", () => {
    const canvas2 = document.getElementById("canvas2");
    if (canvas2) {
      const ctx = canvas2.getContext("2d");
      ctx.clearRect(0, 0, canvas2.width, canvas2.height);
    }
    canvas2.dataset.hasContent = "false";
  });

  /* ============================================================
   新增：实时监测模式逻辑 (Real-time Monitor Mode)
   ============================================================ */

  // // 1. 【修改点】从 body 标签的 data- 属性读取配置
  // // data-device-name 自动对应 dataset.deviceName
  // const currentDeviceName = document.body.dataset.deviceName;

  // 2. 判断是否处于“实时设备连接”状态 (如果有名字，说明是在线模式)
  // if (currentDeviceName) {
  //   console.log(`🚀 [实时模式] 已启动，正在连接设备: ${currentDeviceName}`);

  //   // 提示用户
  //   showToastById("toast1", `正在连接: ${currentDeviceName}...`, 3000);

  //   // 3. 初始化 Socket.io
  //   const socket = io();
  //   // 定义一个图表变量
  //   let realtimeChart = null;

  //   // --- 连接成功 ---
  //   socket.on("connect", () => {
  //     console.log("✅ WebSocket 连接成功！");
  //     showToastById("toast3", "设备已连接，接收数据中...", 2000);

  //     // 加入房间
  //     if (currentDeviceId) {
  //       socket.emit("join_monitor", { device_id: currentDeviceId });
  //     }

  //     // 连接成功后，初始化图表
  //     initRealtimeChart();
  //   });

  //   // --- 监听批量数据 ---
  //   socket.on("update_signal_batch", (msg) => {
  //     // msg.data 是一个二维数组 [ [ch1, ch2...], [ch1, ch2...] ... ]
  //     // msg.fs 是采样率

  //     if (realtimeChart) {
  //       updateChartBatch(realtimeChart, msg.data);
  //     }
  //   });

  //   // --- 辅助函数：初始化实时图表 ---
  //   function initRealtimeChart() {
  //     const ctx = document.getElementById("panel1Canvas");
  //     if (!ctx) {
  //       console.error("找不到 ID 为 panel1Canvas 的 Canvas，无法绘图");
  //       return;
  //     }

  //     realtimeChart = new Chart(ctx, {
  //       type: "line",
  //       data: {
  //         labels: [],
  //         datasets: [
  //           {
  //             // 【修改点】这里也换成了新变量
  //             label: `实时信号 (${currentDeviceName})`,
  //             data: [],
  //             borderColor: "#165DFF",
  //             borderWidth: 2,
  //             pointRadius: 0,
  //             tension: 0.4,
  //             fill: false,
  //           },
  //         ],
  //       },
  //       options: {
  //         responsive: true,
  //         maintainAspectRatio: false,
  //         animation: false,
  //         interaction: {
  //           intersect: false,
  //         },
  //         scales: {
  //           x: {
  //             display: false,
  //             title: { display: true, text: "Time" },
  //           },
  //           y: {
  //             beginAtZero: false,
  //             title: { display: true, text: "Voltage (μV)" },
  //           },
  //         },
  //       },
  //     });
  //   }

  //   // --- 辅助函数：更新数据，新 ---
  //   function updateChartBatch(chart, batchData) {
  //     const labels = chart.data.labels;
  //     const dataset = chart.data.datasets[0].data; // 假设只画第一条线(Dataset 0)

  //     // 遍历这个包里的所有点
  //     batchData.forEach((row, index) => {
  //       // row[0] 是第1通道，row[1] 是第2通道...
  //       // 我们只取第1通道画图
  //       const val = row[0];

  //       // 简单的自增时间轴 (或者你可以算真实时间)
  //       labels.push(""); // X轴不显示文字，推个空字符串占位
  //       dataset.push(val);
  //     });

  //     // 保持窗口长度 (比如显示最近 500 个点，也就是2秒的数据)
  //     while (labels.length > 500) {
  //       labels.shift();
  //       dataset.shift();
  //     }

  //     chart.update("none");
  //   }
  // }

  // --- 【核心配置】想看几路信号，改这里 ---
// --- 配置区 ---
// --- 配置区 ---
const NUM_CHANNELS = 8;        // 通道数量
const VOLTAGE_RANGE = 100000;     // 每一路的显示范围 (例如 ±100 μV)
const WINDOW_SIZE = 500;       // 时间窗口大小

if (currentDeviceName) {
  console.log(`🚀 [实时模式] 启动: ${currentDeviceName}`);
  showToastById("toast1", `正在连接: ${currentDeviceName}...`, 3000);

  const socket = io();
  let realtimeChart = null;

  socket.on("connect", () => {
    console.log("✅ WebSocket 连接成功");
    showToastById("toast3", "连接成功，正在接收信号...", 2000);
    if (currentDeviceId)
      socket.emit("join_monitor", { device_id: currentDeviceId });
    
    initRealtimeChart();
  });

  socket.on("update_signal_batch", (msg) => {
    if (realtimeChart) updateChartBatch(realtimeChart, msg.data);
  });

  // -------------------------------------------------------
  // 核心 1: 初始化图表
  // -------------------------------------------------------
  function initRealtimeChart() {
    const ctx = document.getElementById("panel1Canvas");
    if (!ctx) return;

    const datasets = [];
    const scales = {
      x: {
        type: "category",
        display: false, // 隐藏 X 轴
        grid: { display: false },
      },
    };

    const colors = [
      "#165DFF", "#722ED1", "#F53F3F", "#00B42A",
      "#FF7D00", "#F7BA1E", "#9FDB1D", "#14C9C9",
    ];

    // 计算目标刻度值 (0.7 * 400 = 280)
    const TARGET_TICK = VOLTAGE_RANGE * 0.7;

    for (let i = 0; i < NUM_CHANNELS; i++) {
      // 1. Dataset 配置
      datasets.push({
        label: `Ch ${i + 1}`,
        data: [],
        borderColor: colors[i % colors.length], // 波形颜色
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: `y_ch${i}`, // 绑定到独立轴
        clip: 0,             // 严格剪裁
      });

      // 2. Y轴配置
      scales[`y_ch${i}`] = {
        type: "linear",
        display: true,
        position: "left",
        stack: "channelStack", // 堆叠组
        stackWeight: 1,        // 高度均分
        
        // === 保持实际物理范围不变 ===
        min: -VOLTAGE_RANGE,
        max: VOLTAGE_RANGE,

        // === 核心修改：手动指定刻度位置 ===
        // 我们只生成5个特定的刻度点，不管 autoSkip 怎么说
        afterBuildTicks: (axis) => {
            axis.ticks = [
                { value: -VOLTAGE_RANGE }, // -400 (为了画深色分割线)
                { value: -TARGET_TICK },   // -280 (为了显示标签)
                { value: 0 },              // 0    (为了画零线)
                { value: TARGET_TICK },    // +280 (为了显示标签)
                { value: VOLTAGE_RANGE }   // +400 (为了对称)
            ];
        },

        // 显式通道标题 (保持不变)
        title: {
          display: true,
          text: `CH ${i + 1}`,
          color: colors[i % colors.length],
          font: { size: 11, weight: "bold" },
          padding: { top: 0, bottom: 0 },
          align: "center",
        },

        // 网格线与分割线 (保持不变，依赖 value)
        grid: {
          drawBorder: false, 
          tickLength: 0,     
          
          color: (context) => {
            // 在底部 (-400) 画深色分割线
            // 注意：因为我们上面 afterBuildTicks 加入了 -VOLTAGE_RANGE，所以这里能检测到
            if (context.tick.value === -VOLTAGE_RANGE) return "#8b8c8e"; 
            
            // 在中间 (0) 画浅色零线
            if (context.tick.value === 0) return "rgba(0,0,0, 0.05)"; 
            
            return "transparent";
          },
          
          borderDash: (context) => {
            if (context.tick.value === 0) return [4, 4];
            return [];
          }
        },

        // === 核心修改：只显示 ±280 的标签 ===
        ticks: {
          font: { size: 9 },
          color: "#86909C", 
          // 这里不需要 stepSize 了，因为我们用了 afterBuildTicks 接管
          autoSkip: false,        
          
          callback: function (value) {
            // 只显示 ±280 (TARGET_TICK)
            // 屏蔽掉 ±400 和 0 的文字
            
            if (Math.abs(value - TARGET_TICK) < 1) return `+${TARGET_TICK}`;
            if (Math.abs(value + TARGET_TICK) < 1) return `-${TARGET_TICK}`;
            
            return "";
          },
        },
      };
    }

    realtimeChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // 核心：关闭动画提升性能
        interaction: { mode: "none", intersect: false }, // 关闭交互
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: scales,
      },
    });
  }

  // -------------------------------------------------------
  // 核心 2: 批量更新数据
  // -------------------------------------------------------
  function updateChartBatch(chart, batchData) {
    const labels = chart.data.labels;

    batchData.forEach((row) => {
      // row = [ch1_val, ch2_val, ...]
      labels.push(""); // 占位 label
      for (let i = 0; i < NUM_CHANNELS; i++) {
        const val = row[i] !== undefined ? row[i] : 0;
        chart.data.datasets[i].data.push(val);
      }
    });

    // 滑动窗口：移除旧数据
    const pointsToRemove = labels.length - WINDOW_SIZE;
    if (pointsToRemove > 0) {
      labels.splice(0, pointsToRemove);
      for (let i = 0; i < NUM_CHANNELS; i++) {
        chart.data.datasets[i].data.splice(0, pointsToRemove);
      }
    }

    chart.update("none"); // 核心：无动画更新
  }
}


});
