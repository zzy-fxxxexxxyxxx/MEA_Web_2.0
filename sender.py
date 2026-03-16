import socketio
import time
import struct
import numpy as np
import math
import random

import math
import random


# 作用：生成某一时刻的“单通道 ECG 电压值”
# 相当于：“给我一个时间点 t，我给你一个像真的心电一样的数值”
def synthetic_ecg(t, heart_rate=60):
    """
    t: 当前时间（秒）
    heart_rate: 心率 bpm
    return: ECG 幅值（近似 mV）
    """
    # 心动周期
    T = 60.0 / heart_rate
    x = (t % T) / T  # 归一化到 [0,1)

    def gauss(x, mu, sigma, amp):
        return amp * math.exp(-((x - mu) ** 2) / (2 * sigma**2))

    # P Q R S T 波（位置、宽度、幅值）
    p = gauss(x, 0.20, 0.025, 0.15)
    q = gauss(x, 0.35, 0.010, -0.15)
    r = gauss(x, 0.37, 0.008, 1.00)
    s = gauss(x, 0.40, 0.012, -0.25)
    t_ = gauss(x, 0.60, 0.050, 0.35)

    # 基线漂移 + 微噪声
    baseline = 0.02 * math.sin(2 * math.pi * 0.3 * t)
    noise = random.uniform(-0.02, 0.02)

    return p + q + r + s + t_ + baseline + noise


# ================= 配置区 =================
SERIAL_PORT = "COM5"  # 请修改为你的实际端口
BAUD_RATE = 460800  # 波特率
# SERVER_URL = "https://mea-web-2-0.onrender.com/"
# DEVICE_TOKEN = "mea_92310c10-3343-4505-a93a-be5edcfe8422"  # 请填入你的 Key

SERVER_URL = "http://127.0.0.1:5005/"
DEVICE_TOKEN = "mea_4c610d6f-1d78-4512-b78d-48875bc1a3a7"  # 请填入你的 Key

# SERVER_URL = "https://mea.fxxxexxxyxxx.duckdns.org/"
# DEVICE_TOKEN = "mea_b1a5cd4f-e856-45d9-968c-4ddb55c4deda"  # 请填入你的 Key


# 协议参数
DATA_CHANNELS = 16
BATCH_SIZE = 25
SCALE_FACTOR = 4.5 / 24 / (2**23 - 1) * 1000000
# ==========================================

sio = socketio.Client()


# --- 核心：虚拟串口类 (假装自己是硬件) ---
class MockSerial:
    def __init__(self):
        print(f"👻 [虚拟硬件] 已启动，正在模拟 {DATA_CHANNELS} 通道数据流...")
        self.t_index = 0
        self.sample_rate = 250
        self.packet_queue = bytearray()
        self.last_update = time.time()

    def read(self, size=1):
        # 模拟生成数据：根据时间流逝产生对应数量的字节
        now = time.time()
        # 应该生成多少个点？
        dt = now - self.last_update
        if dt > 0.004:  # 每4ms生成一个点
            num_new_samples = int(dt / 0.004)
            self._generate(num_new_samples)
            self.last_update += num_new_samples * 0.004

        # 如果缓冲区够了，就吐出数据
        if len(self.packet_queue) >= size:
            data = self.packet_queue[:size]
            self.packet_queue = self.packet_buffer = self.packet_queue[size:]
            return bytes(data)
        else:
            time.sleep(0.001)  # 没数据就歇会儿
            return b""

    def _generate(self, count):
        for _ in range(count):
            # 构造 57 字节包 [A0] [Flag] [Ch1..Ch16] [Pad] [C0]
            packet = bytearray()
            packet.append(0xA0)
            packet.append(self.t_index % 256)

            for ch in range(DATA_CHANNELS):
                t = self.t_index / self.sample_rate

                heart_rate = 40 + ch * 5
                ecg = synthetic_ecg(t, heart_rate)

                val = ecg * 800  # ECG → ADC 幅值

                # 转回 24bit
                raw_int = int(val / SCALE_FACTOR)
                if raw_int < 0:
                    raw_int += 0x1000000
                raw_bytes = struct.pack(">I", raw_int & 0xFFFFFF)[1:]
                packet.extend(raw_bytes)

            packet.extend(b"\x00" * 6)
            packet.append(0xC0)
            self.packet_queue.extend(packet)
            self.t_index += 1

    def write(self, data):
        pass  # 假装接收指令

    def close(self):
        print("👻 [虚拟硬件] 关闭")


# --- 作用：在process_packet中调用，把 3 字节 ADC 数据 → 有符号整数 ---
def parse_24bit_signed(byte_seq):
    val = (byte_seq[0] << 16) | (byte_seq[1] << 8) | byte_seq[2]
    if val & 0x800000:
        val -= 0x1000000
    return val

# 作用：解析硬件数据后发送至云端。把一个完整数据帧解析成多通道电压：跳过帧头，每 3 字节解析一个通道，ADC → μV
def process_packet(raw_bytes):
    channel_data = []
    start_index = 2
    for i in range(DATA_CHANNELS):
        idx = start_index + i * 3
        raw_int = parse_24bit_signed(raw_bytes[idx : idx + 3])
        channel_data.append(raw_int * SCALE_FACTOR)
    return channel_data

# 设备上线时向服务器“报到”
@sio.event
def connect():
    print(f">>> 已连接到服务器: {SERVER_URL}")
    # 【新增】连接后立刻发送登录包，告知服务器我是谁
    sio.emit("device_login", {"api_key": DEVICE_TOKEN})


def main():
    try:
        sio.connect(SERVER_URL)
    except Exception as e:
        print(f"❌ 云端连接失败: {e}")
        return

    # ⚠️ 关键点：这里不连真实串口，而是实例化 MockSerial
    ser = MockSerial()

    print("--- 开始解析数据 ---")
    buffer = []

    try:
        while True:
            # 这里的 ser.read 实际上是在调 MockSerial 的方法
            b = ser.read(1)
            if b == b"\xa0":
                rest = ser.read(56)  # 57-1
                if len(rest) == 56 and rest[-1] == 0xC0:
                    packet = b"\xa0" + rest
                    voltages = process_packet(packet)

                    # 取前8路发送
                    buffer.append(voltages[:16])

                    if len(buffer) >= BATCH_SIZE:
                        sio.emit(
                            "device_push_data",
                            {
                                "api_key": DEVICE_TOKEN,
                                "data": buffer,
                                "fs": 250,
                                "timestamp": time.time(),
                            },
                        )
                        print(f"发送数据包: {voltages[0]:.2f} μV ...")
                        buffer = []
    except KeyboardInterrupt:
        sio.disconnect()


if __name__ == "__main__":
    main()
