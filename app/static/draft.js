/* ============================================================
   新增：实时监测模式逻辑 (Real-time Monitor Mode)
   ============================================================ */

// 1. 读取 HTML 中定义的配置
const currentDeviceName = document.body.dataset.deviceName;
const currentDeviceId = document.body.dataset.deviceId;

// --- 【核心配置】想看几路信号，改这里 ---
const NUM_CHANNELS = 8;        // 通道数 (例如 8)
const CHANNEL_OFFSET = 200;    // 通道间距 (防止波形重叠，单位与电压一致)
const WINDOW_SIZE = 500;       // 显示多少个点 (500点 @ 250Hz = 2秒)

if (currentDeviceName) {
  console.log(`🚀 [实时模式] 已启动，连接设备: ${currentDeviceName}`);
  
  // 提示用户 (补回来了！)
  showToastById("toast1", `正在连接: ${currentDeviceName}...`, 3000);
  
  // 引入 Socket
  const socket = io();
  let realtimeChart = null;

  // --- 连接成功 ---
  socket.on("connect", () => {
    console.log("✅ WebSocket 连接成功！");
    showToastById("toast3", "设备已连接，接收数据中...", 2000);
    
    // 加入房间
    if (currentDeviceId) {
        socket.emit("join_monitor", { device_id: currentDeviceId });
    }
    
    // 初始化图表
    initRealtimeChart();
  });

  // --- 接收批量数据 (List of Lists) ---
  socket.on("update_signal_batch", (msg) => {
    // msg.data 格式: [[ch1, ch2...], [ch1, ch2...], ...]
    if (realtimeChart) {
      updateChartBatch(realtimeChart, msg.data);
    }
  });

  // -------------------------------------------------------
  // 核心函数 1: 初始化多通道图表
  // -------------------------------------------------------
  function initRealtimeChart() {
    const ctx = document.getElementById("panel1Canvas");
    if (!ctx) {
        console.error("找不到 ID 为 panel1Canvas 的 Canvas，无法绘图");
        return;
    }

    // 生成 N 条线的数据结构
    const datasets = [];
    const colors = ['#165DFF', '#722ED1', '#F53F3F', '#00B42A', '#FF7D00', '#F7BA1E', '#9FDB1D', '#14C9C9'];

    for (let i = 0; i < NUM_CHANNELS; i++) {
        datasets.push({
            label: `Ch ${i+1}`,
            data: [], // 数据先空着
            borderColor: colors[i % colors.length], // 颜色循环
            borderWidth: 1.5,
            pointRadius: 0, // 不画点，只画线
            tension: 0.4,   // 平滑曲线
            fill: false
        });
    }

    realtimeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // 关动画，保性能
        interaction: { intersect: false },
        scales: {
          x: { 
              display: false, // 隐藏X轴文字
              title: { display: true, text: 'Time (Rolling)' }
          },
          y: {
            display: false,   // 隐藏Y轴刻度 (因为我们用了偏移，刻度没意义了)
            // 自动计算 Y 轴范围，保证所有通道都能放下
            min: -100, 
            max: (NUM_CHANNELS * CHANNEL_OFFSET) + 100 
          }
        },
        plugins: {
            legend: { display: false } // 隐藏图例，太占地
        }
      }
    });
  }

  // -------------------------------------------------------
  // 核心函数 2: 批量更新数据
  // -------------------------------------------------------
  function updateChartBatch(chart, batchData) {
    const labels = chart.data.labels;
    
    // batchData 是一个大包，里面有比如 25 个时间点
    batchData.forEach((row) => {
        // row = [ch1_val, ch2_val, ..., ch8_val]
        
        // 1. 推入一个空标签 (撑开 X 轴)
        labels.push("");

        // 2. 遍历所有通道，推入数据
        for (let i = 0; i < NUM_CHANNELS; i++) {
            // 【关键算法】: 原始值 + (通道索引 * 间距)
            // 这样 Ch1 在最底下，Ch2 在上面 200 的位置，Ch3 在 400...
            // 从而实现“视觉上的分层显示”
            const val = row[i] !== undefined ? row[i] : 0;
            const offsetVal = val + (i * CHANNEL_OFFSET);
            
            chart.data.datasets[i].data.push(offsetVal);
        }
    });

    // 3. 删除旧数据 (保持窗口平移)
    // 这种写法比 splice 更快一点点
    const pointsToRemove = labels.length - WINDOW_SIZE;
    if (pointsToRemove > 0) {
        // 删 X 轴
        for(let k=0; k<pointsToRemove; k++) {
            labels.shift();
        }
        
        // 删 Y 轴 (每条线都要删)
        for (let i = 0; i < NUM_CHANNELS; i++) {
            for(let k=0; k<pointsToRemove; k++) {
                chart.data.datasets[i].data.shift();
            }
        }
    }

    // 4. 极速重绘
    chart.update('none');
  }
}
