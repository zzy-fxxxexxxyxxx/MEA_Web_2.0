// static/Notification.js

// 该代码实现文件上传功能，文件上传后理论上无需刷新就会在通知列表中显示且有记忆性。
// 所需参数：一个socket实例
// 第一步：用loadHistory函数读取数据库中记录的该账号的所有report，
// 包括所有已读的和未读的文件
// 第二步：监听socket事件，当收到后端
// @app.route('/api/upload_report', methods=['POST'])利用socketio.emit发送的
// 'new_report_uploaded'事件时（代码在routes.py中），调用addNotification实时显示新通知
// ps：将上传的文件写入数据库的工作由routes.py中的'/api/upload_report'路由处理

export function initNotificationSystem(socket) {
  const notifyBtn = document.getElementById("notifyBtn");
  const notifyPanel = document.getElementById("notifyPanel");
  const notifyBadge = document.getElementById("notifyBadge");
  const notifyList = document.getElementById("notifyList");
  const emptyState = document.getElementById("emptyState");
  const clearBtn = document.getElementById("clearNotifyBtn");
  let unreadCount = 0;

  // ===========================================
  // ✨ 1. 新增：页面加载时，获取历史记录
  // ===========================================
  async function loadHistory() {
    try {
      const res = await fetch("/api/notifications");
      const history = await res.json();

      // 注意：后端通常返回的是最新的在最前面
      // 但我们的 addNotification 会把新元素插到最前面 (insertBefore)
      // 所以如果历史数据是 [新, 旧, 更旧]，我们需要倒序插入，或者直接按顺序插
      // 这里建议：直接遍历插入即可
      // 我们先清空一下，防止重复 (如果有的话)
      notifyList.innerHTML = "";
      notifyList.appendChild(emptyState);

      // 因为 addNotification 是插到最前面 (unshift 效果)，
      // 所以我们要把历史记录数组【翻转】一下再遍历，或者从后往前插，
      // 这样最新的才会留在最上面。
      // 假设后端返回 [最新, 次新...]

      // 策略：直接遍历
      // data 是 {filename, device, time, url}
      history
        .slice()
        .reverse()
        .forEach((data) => {
          addNotification(data, false); // false 表示这是历史记录，不需要弹窗提示
        });
    } catch (e) {
      console.error("加载历史通知失败", e);
    }
  }

  // 立即执行加载
  loadHistory();

  socket.on("new_report_uploaded", (msg) => {
    // msg 现在直接就是后端 to_dict 返回的格式，非常完美
    addNotification(msg, true); // true 表示是新消息
  });

  // 辅助：更新红点显示
  function updateBadgeUI() {
    if (unreadCount > 0) {
      notifyBadge.textContent = unreadCount;
      notifyBadge.classList.remove("hidden");
    } else {
      notifyBadge.classList.add("hidden");
    }
  }

  // 2. 绑定 UI 点击事件
  if (notifyBtn) {
    notifyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifyPanel.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!notifyPanel.contains(e.target) && !notifyBtn.contains(e.target)) {
        notifyPanel.classList.add("hidden");
      }
    });

    // 修改清空按钮：不仅清空前端，还要告诉后端清库
    clearBtn.addEventListener("click", async () => {
      // 1. 前端清空
      notifyList.innerHTML = "";
      notifyList.appendChild(emptyState);
      emptyState.style.display = "block";
      unreadCount = 0;
      notifyBadge.classList.add("hidden");

      // 2. ✨ 后端清空
      await fetch("/api/notifications/clear", { method: "POST" });
    });
  }

  function addNotification(data) {
    if (!notifyList) return;
    emptyState.style.display = "none";

    // 1. 创建容器
    const item = document.createElement("div");
    // 修改样式：改为默认光标，因为不再是点击整个卡片了
    item.className =
      "relative p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex flex-col gap-2";

    // 2. 构建 HTML 结构 (分两部分：信息区 + 按钮区)
    item.innerHTML = `
        <!-- 上半部分：文件信息 -->
        <div class="flex items-start gap-3">
            <!-- 文字信息 -->
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 break-all leading-tight">
                    ${data.filename}
                </p>
                <div class="flex justify-between items-center mt-1">
                    <span class="text-xs text-gray-500">来自: ${data.device}</span>
                    <span class="text-xs text-gray-400">${data.time}</span>
                </div>
            </div>
        </div>

        <!-- 下半部分：操作按钮组 -->
        <div class="flex justify-end gap-2 mt-1">
            <!-- 👁️ 查看按钮 -->
            <button class="btn-view px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-100 hover:text-primary transition-colors flex items-center">
                <i class="fa fa-eye mr-1"></i> 预览
            </button>

            <!-- ⬇️ 下载按钮 -->
            <button class="btn-download px-2 py-1 text-xs font-medium text-white bg-primary hover:bg-blue-600 rounded shadow-sm transition-colors flex items-center">
                <i class="fa fa-download mr-1"></i> 下载
            </button>
        </div>
    `;

    // ✨ 视觉标记：如果是未读，加个小蓝点或者背景色区分
    if (!data.is_read) {
      item.classList.add("bg-blue-50/50"); // 浅蓝色背景表示未读
      // 或者加个小圆点
      const dot = document.createElement("div");
      dot.className =
        "unread-dot absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full";
      item.appendChild(dot);
    }

    // --- 核心：点击处理函数 ---
    const handleAction = async () => {
      // 如果已经是已读，就不做处理
      if (data.is_read) return;

      // 1. 视觉变更：移除未读样式
      item.classList.remove("bg-blue-50/50");
      const dot = item.querySelector(".unread-dot");
      if (dot) dot.remove();

      // 2. 内存状态变更
      data.is_read = true; // 标记本地数据为已读

      // 3. 红点 -1
      if (unreadCount > 0) {
        unreadCount--;
        updateBadgeUI();
      }

      // 4. 告诉后端
      await fetch(`/api/notifications/${data.id}/read`, { method: "POST" });
    };

    // 4. 绑定事件 (使用 querySelector 找到刚才生成的按钮)
    // --- 绑定【预览】事件 ---
    const viewBtn = item.querySelector(".btn-view");
    viewBtn.onclick = (e) => {
      e.stopPropagation(); // 防止冒泡
      handleAction(); // ✨ 点击时触发已读逻辑
      if (data.url) {
        // 在新标签页打开，浏览器会自动判断是预览还是下载
        window.open(data.url, "_blank");
      } else {
        alert("无效的文件链接");
      }
    };

    // --- 绑定【下载】事件 ---
    const downloadBtn = item.querySelector(".btn-download");
    downloadBtn.onclick = (e) => {
      e.stopPropagation(); // 防止冒泡
      handleAction(); // ✨ 点击时触发已读逻辑
      if (data.url) {
        const link = document.createElement("a");
        link.href = data.url;
        link.download = data.filename; // 强制下载属性
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("无效的文件链接");
      }
    };

    // 4. 插入列表
    if (notifyList.firstChild) {
      notifyList.insertBefore(item, notifyList.firstChild);
    } else {
      notifyList.appendChild(item);
    }

    // 只有当消息是真正的未读状态时，才增加计数并显示红点
    if (!data.is_read) {
      unreadCount++;
      updateBadgeUI(); // 调用你已经写好的 UI 更新函数
    }
  }
}
