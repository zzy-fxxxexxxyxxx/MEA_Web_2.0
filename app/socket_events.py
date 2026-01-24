# app/socket_events.py

from flask_socketio import emit, join_room
from flask_login import current_user
from app import socketio
import time

# --- 1. 浏览器端 (接收者) ---

@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        print(f"✅ 用户 {current_user.username} 已连接 WebSocket")
    else:
        print("⚠️ 匿名连接 (可能是树莓派或未登录用户)")

@socketio.on('join_monitor')
def handle_join(data):
    """
    前端 JS 发送 'join_monitor' 事件时触发。
    data 格式: {'device_id': 1}
    """
    device_id = data.get('device_id')
    if device_id:
        # 核心：把这个用户拉进一个“房间”
        # 房间号叫 "room_device_1"
        room_name = f"room_device_{device_id}"
        join_room(room_name)
        print(f"📡 用户加入了房间: {room_name}")
        
        # 可选：发个欢迎消息
        emit('server_log', {'msg': f'已连接到设备 {device_id} 的数据频道'}, to=room_name)

# --- 2. 树莓派/采集端 (发送者) ---

@socketio.on('device_push_data')
def handle_device_push(data):
    """
    树莓派发送 'device_push_data' 事件时触发。
    data 格式: {'device_id': 1, 'voltage': 123.4, 'time': 10.1}
    """
    device_id = data.get('device_id')
    
    if device_id:
        room_name = f"room_device_{device_id}"
        
        # 核心：把收到的数据，广播给房间里的所有人
        # 事件名 'update_signal' 必须和 main.js 里监听的一样
        socketio.emit('update_signal', {
            'value': data['voltage'],
            'time': data['time']
        }, to=room_name)
        
        # (调试用) 在服务器控制台打印一下，确定数据到了
        # print(f"收到设备 {device_id} 数据: {data['voltage']}")
