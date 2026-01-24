from flask_socketio import emit
from flask_login import current_user
from app import socketio # 导入 socketio 实例
import threading
import time
import math
import numpy as np

# 模拟数据发生器 (后台线程)
def data_generator():
    print("--- 模拟数据流已启动 ---")
    t = 0
    while True:
        val = 50 * math.sin(t * 0.1) + np.random.normal(0, 5)
        socketio.emit('update_signal', {'value': val, 'time': t})
        t += 1
        time.sleep(0.05)

# 线程控制
bg_thread = None
thread_lock = threading.Lock()

# 监听连接
@socketio.on('connect')
def handle_connect():
    # 1. 业务逻辑：打印日志
    if current_user.is_authenticated:
        print(f"用户 {current_user.username} 已连接 WebSocket")
    else:
        print("匿名用户已连接 WebSocket")
    # 2. 系统逻辑：启动后台数据发生器线程
    global bg_thread
    with thread_lock:
        if bg_thread is None:
            bg_thread = socketio.start_background_task(data_generator)
            print("--- 后台数据生成线程已启动 ---")
