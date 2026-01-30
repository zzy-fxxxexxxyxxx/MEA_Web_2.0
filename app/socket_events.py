# app/socket_events.py
from flask_socketio import emit, join_room
from flask_login import current_user
from flask import request  # 需要用到 request.sid
from app import socketio, db
from app.models import Device  # 导入模型
import time

# --- 内存映射表：记录哪个 SocketID 对应哪个设备 ---
# 格式: { 'sid_123': device_id_5, 'sid_456': device_id_8 }
connected_devices = {}

# --- 1. 浏览器端 (接收者) ---
@socketio.on("connect")
def handle_connect():
    if current_user.is_authenticated:
        print(f"✅ 用户 {current_user.username} 已连接 WebSocket")
        room=f"user_{current_user.id}"
        join_room(room)
        print(f"🏠 已加入房间: {room}")
    else:
        print("⚠️ 匿名连接 (可能是树莓派或未登录用户)，不加入任何房间")


@socketio.on("join_monitor")
def handle_join(data):
    """
    前端 JS 发送 'join_monitor' 事件时触发。
    data 格式: {'device_id': 1}
    """
    device_id = data.get("device_id")
    if device_id:
        # 核心：把这个用户拉进一个“房间”
        # 房间号叫 "room_device_1"
        room_name = f"room_device_{device_id}"
        join_room(room_name)
        print(f"📡 用户加入了房间: {room_name}")

        # 可选：发个欢迎消息
        emit(
            "server_log", {"msg": f"已连接到设备 {device_id} 的数据频道"}, to=room_name
        )


@socketio.on("device_login")
def handle_device_login(data):
    api_key = data.get("api_key")
    device = Device.query.filter_by(api_key=api_key).first()

    if device:
        device.status = "online"
        db.session.commit()
        connected_devices[request.sid] = device.id
        print(f"✅ 设备上线: {device.name}")

        # 【新增】广播状态变更事件
        # 这条消息发给所有人（或者只发给这个设备的主人，为了简单先发所有人）
        socketio.emit(
            "device_status_change", {"device_id": device.id,"device_name": device.name, "status": "online"}
        )




@socketio.on("disconnect")
def handle_disconnect():
    device_id = connected_devices.pop(request.sid, None)

    if device_id:
        device = Device.query.get(device_id)
        if device:
            device.status = "offline"
            db.session.commit()
            print(f"❌ 设备下线: {device.name}")

            # 【新增】广播下线通知
            socketio.emit(
                "device_status_change", {"device_id": device.id,"device_name": device.name, "status": "offline"}
            )


# --- 2. 树莓派/采集端 (发送者) ---


@socketio.on("device_push_data")
def handle_device_push(data):
    """
    data 格式改为: {'api_key': 'mea_...', 'voltage': 123.4, 'time': 10.1}
    """
    api_key = data.get("api_key")  # 获取密钥

    # 1. 拿着密钥去数据库找设备
    # 注意：这里需要导入 Device 模型
    from app.models import Device

    device = Device.query.filter_by(api_key=api_key).first()

    if device:
        # 2. 找到了！获取它的 ID，拼凑出房间名
        room_name = f"room_device_{device.id}"

        # 3. 广播数据，转发整个包
        socketio.emit(
            "update_signal_batch",
            {"data": data["data"], "fs": data.get("fs", 250)},  # 改个名，叫 batch
            to=room_name,
        )

        # 可选：更新设备状态为 online
        # device.status = 'online'
        # db.session.commit()
    else:
        print(f"⚠️ 收到非法连接，无效的 Key: {api_key}")
