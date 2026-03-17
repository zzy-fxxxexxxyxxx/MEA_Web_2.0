import * as h5wasm from "https://cdn.jsdelivr.net/npm/h5wasm@0.7.8/dist/esm/hdf5_hl.js";

import { openTab, drawAxes, initRefreshButtons } from "./basic_func.js";
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
import { initSaveButtons } from "./Save.js";
import { showToastById } from "./Beautify.js";

import { initNotificationSystem } from "./FileNotification.js";
import { initRealtimeMonitor } from "./RealtimeMonitor.js";
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
  //--------------------------初始化 panel3 和 panel4 的坐标系--------------------------------------------------------
  drawAxes("canvas1");
  drawAxes("canvas2");

  //------------------------------------Panel 1，3--------------------------------------------------------------------
  document.getElementById("plot1").addEventListener("click", () => {
    // 1️⃣ 检查是否处于实时监控模式
    const deviceInfoArea = document.getElementById("deviceInfoArea");
    if (deviceInfoArea && !deviceInfoArea.classList.contains("hidden")) {
        // showToastById("toast3", "⚠️ 实时监控中，参数自动更新，无需点击 Plot", 2000);
        return;
    }

    // 2️⃣ 检查是否有静态数据
    if (!processedData) {
        showToastById("toast1", "❌ 请先上传文件", 2000);
        return;
    }

    // 3️⃣ 执行静态绘图
    plotWaveformsOnGrid(processedData); 

    if (document.getElementById("tab1").value != 0) {
      originalPeakEnlargement(processedData); 
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

  // ----------------------------Save功能-----------------------------------------------------
  initSaveButtons();

  //------------------------------------面板放大与还原逻辑------------------------------------

  const panels = document.querySelectorAll("main .grid > div");
  const mainGrid = document.querySelector("main .grid");

  panels.forEach((panel, index) => {
    const expandBtn = panel.querySelector(`#expandPanel${index + 1}`);
    const icon = expandBtn.querySelector("i");
    // Change selector to target the .panel-content div we just added
    const contentWrapper = panel.querySelector(".panel-content"); 
    // 存储原始高度类以便恢复
    const originalHeightClass = index < 2 ? "h-[350px]" : "h-[300px]";

    expandBtn.addEventListener("click", () => {
      const isExpanded = panel.classList.contains("expanded");

      if (!isExpanded) {
        // 🌟 放大状态
        // 隐藏其他面板
        panels.forEach((p) => {
          if (p !== panel) p.style.display = "none";
        });
        
        // 面板本身设置为全高、flex列布局
        panel.classList.add("expanded", "h-full", "flex", "flex-col");
        
        // 主网格设置为单列、全高
        mainGrid.classList.remove("lg:grid-cols-2");
        mainGrid.classList.add("h-full", "grid-cols-1");
        
        // 图标切换
        icon.classList.replace("fa-expand", "fa-compress");

        // 内容容器设置为 flex-1 min-h-0 (关键：自动填充剩余空间且允许内部滚动/适应)
        if (contentWrapper) {
          contentWrapper.classList.remove(originalHeightClass);
          contentWrapper.classList.add("flex-1", "min-h-0", "h-auto");
          contentWrapper.style.height = ""; // 清除可能存在的内联样式

          // 关键修正：必须清除内部 Canvas/SVG 的固定尺寸，让 CSS 生效
          const children = contentWrapper.querySelectorAll("canvas, svg");
          children.forEach(el => {
              el.style.width = "";
              el.style.height = "";
          });
        }
      } else {
        // 🔙 缩小状态
        // 显示所有面板
        panels.forEach((p) => (p.style.display = "block"));
        
        // 移除面板扩展类
        panel.classList.remove("expanded", "h-full", "flex", "flex-col");
        
        // 恢复网格布局
        mainGrid.classList.add("lg:grid-cols-2");
        mainGrid.classList.remove("h-full", "grid-cols-1");
        
        // 图标切换
        icon.classList.replace("fa-compress", "fa-expand");

        // 恢复内容容器高度
        if (contentWrapper) {
          contentWrapper.classList.remove("flex-1", "min-h-0", "h-auto");
          contentWrapper.classList.add(originalHeightClass);
          // 清除可能存在的内联样式
           contentWrapper.style.height = ""; 
           
           // 恢复 Canvas/SVG 的尺寸控制（可选，如果 CSS w-full h-full 足够强则不需要）
           const children = contentWrapper.querySelectorAll("canvas, svg");
           children.forEach(el => {
               el.style.width = "";
               el.style.height = "";
           });
        }
        
      }
    });
  });

  //------------------------------------删除按键调用---------------------------------------------
  // ✨ 调用初始化函数，并将重绘函数作为参数传进去
  initRefreshButtons(drawGridOnPanel1, drawGridOnPanel2);

  // 1. 全局 Socket 连接 (放在最外层)
  // 这样无论有没有 currentDeviceName，都能连上服务器收通知
  const socket = io();

  // 2. 初始化通知系统 (铃铛)，并且实现文件上传下载功能
  initNotificationSystem(socket);

  // 3. 初始化实时监控 (如果处于设备详情页)，并且实现实时监控
  console.log(
    "currentDeviceName:",
    currentDeviceName,
    "currentDeviceId:",
    currentDeviceId,
  );
  if (currentDeviceName) {
    initRealtimeMonitor(socket, currentDeviceName, currentDeviceId);
  }
});
