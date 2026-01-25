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
    data 格式改为: {'api_key': 'mea_...', 'voltage': 123.4, 'time': 10.1}
    """
    api_key = data.get('api_key') # 获取密钥
    
    # 1. 拿着密钥去数据库找设备
    # 注意：这里需要导入 Device 模型
    from app.models import Device
    device = Device.query.filter_by(api_key=api_key).first()
    
    if device:
        # 2. 找到了！获取它的 ID，拼凑出房间名
        room_name = f"room_device_{device.id}"
        
        # 3. 广播数据，转发整个包
        socketio.emit('update_signal_batch', { # 改个名，叫 batch
            'data': data['data'],
            'fs': data.get('fs', 250)
        }, to=room_name)
        
        # 可选：更新设备状态为 online
        # device.status = 'online'
        # db.session.commit()
    else:
        print(f"⚠️ 收到非法连接，无效的 Key: {api_key}")