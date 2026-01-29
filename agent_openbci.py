# import serial
# import socketio
# import time
# import struct
# import numpy as np

# # ================= 配置区 =================
# SERIAL_PORT = 'COM5'  # 请修改为你的实际端口
# BAUD_RATE = 460800    # 波特率
# # SERVER_URL = 'https://mea-web-2-0.onrender.com/' 
# # DEVICE_TOKEN = "mea_92310c10-3343-4505-a93a-be5edcfe8422" # 请填入你的 Key

# SERVER_URL = "http://127.0.0.1:5000/"
# DEVICE_TOKEN = "mea_3eede2cc-1ea6-4ed5-ad1b-a6dee2bb8437" 

# # 包定义
# PACKET_LEN = 57       # 根据你的C代码推算的长度
# DATA_CHANNELS = 16    # 2片芯片 x 8通道 = 16通道
# BATCH_SIZE = 25       # 打包发送数量
# SCALE_FACTOR = 4.5 / 24 / (2**23 - 1) * 1000000 # 转换为 μV
# # ==========================================

# sio = socketio.Client()
# ser = None

# def parse_24bit_signed(byte_seq):
#     """3字节转有符号整数"""
#     val = (byte_seq[0] << 16) | (byte_seq[1] << 8) | byte_seq[2]
#     if val & 0x800000:
#         val -= 0x1000000
#     return val

# def process_packet(raw_bytes):
#     """
#     解析 57 字节自定义包
#     格式: [A0] [Flag] [Chip1_24B] [Chip2_24B] [Pad_6B] [C0]
#     """
#     channel_data = []
    
#     # 解析数据区 (从索引 2 开始，共 48 字节 = 16通道 * 3)
#     # 你的代码里: 
#     # Chip1: base+2 ~ base+25
#     # Chip2: base+26 ~ base+49
    
#     start_index = 2
    
#     for i in range(DATA_CHANNELS): # 0~15
#         idx = start_index + i * 3
#         # 提取3个字节
#         b_seq = raw_bytes[idx : idx+3]
        
#         raw_int = parse_24bit_signed(b_seq)
#         microvolts = raw_int * SCALE_FACTOR
#         channel_data.append(microvolts)
        
#     return channel_data

# @sio.event
# def connect():
#     print(f">>> 已连接服务器")

# def main():
#     global ser
#     try:
#         sio.connect(SERVER_URL)
#     except Exception as e:
#         print(f"❌ 云端连接失败: {e}")
#         return

#     try:
#         ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
#         ser.dtr = False
#         ser.rts = False
#         print(f">>> 串口 {SERIAL_PORT} 打开成功")
#         # 你的代码看起来是下位机自动发送的，不需要发 'b' 指令？
#         # 如果需要，请取消下面注释
#         # time.sleep(2)
#         # ser.write(b'b') 
        
#     except Exception as e:
#         print(f"❌ 串口错误: {e}")
#         return

#     print(f"--- 开始解析 {PACKET_LEN} 字节数据包 ---")
#     buffer = [] 
    
#     try:
#         while True:
#             # 1. 寻找包头 A0
#             b = ser.read(1)
#             if b == b'\xa0':
#                 # 2. 读取剩余 56 字节
#                 rest = ser.read(PACKET_LEN - 1)
                
#                 if len(rest) == (PACKET_LEN - 1) and rest[-1] == 0xC0:
#                     # 校验通过
#                     full_packet = b'\xa0' + rest
#                     all_16_channels = process_packet(full_packet)
                    
#                     # ⚠️ 策略选择：
#                     # 如果你网页只配置了 8 路，这里只发前 8 路
#                     # 如果网页能抗住 16 路，就发 all_16_channels
#                     channels_to_send = all_16_channels[:8] 
                    
#                     buffer.append(channels_to_send)
                    
#                     if len(buffer) >= BATCH_SIZE:
#                         sio.emit('device_push_data', {
#                             'api_key': DEVICE_TOKEN,
#                             'data': buffer,
#                             'fs': 250,
#                             'timestamp': time.time()
#                         })
#                         buffer = []
#                 else:
#                     # 丢包或错位，继续找下一个 A0
#                     pass
                    
#     except KeyboardInterrupt:
#         if ser: ser.close()
#         sio.disconnect()

# if __name__ == '__main__':
#     main()


# 高采样率下实时数据传输可以有下面途径：降采样/算法压缩，改变batchsize
import socketio
import time
import struct
import numpy as np
import math
import random

# ================= 配置区 =================
SERIAL_PORT = 'COM5'  # 请修改为你的实际端口
BAUD_RATE = 460800    # 波特率
SERVER_URL = "http://127.0.0.1:5000/"
DEVICE_TOKEN = "mea_4c610d6f-1d78-4512-b78d-48875bc1a3a7" 

# 协议参数
DATA_CHANNELS = 16
BATCH_SIZE = 25
# 增加BATCH_SIZE，减少每秒发送次数
# BATCH_SIZE = 100  # 从25增加到100
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
        if dt > 0.004: # 每4ms生成一个点
            num_new_samples = int(dt / 0.004)
            self._generate(num_new_samples)
            self.last_update += num_new_samples * 0.004
            
        # 如果缓冲区够了，就吐出数据
        if len(self.packet_queue) >= size:
            data = self.packet_queue[:size]
            self.packet_queue = self.packet_buffer = self.packet_queue[size:]
            return bytes(data)
        else:
            time.sleep(0.001) # 没数据就歇会儿
            return b''

    def _generate(self, count):
        for _ in range(count):
            # 构造 57 字节包 [A0] [Flag] [Ch1..Ch16] [Pad] [C0]
            packet = bytearray()
            packet.append(0xA0)
            packet.append(self.t_index % 256)
            
            for ch in range(DATA_CHANNELS):
                # 模拟波形：每个通道频率、相位不同，方便区分
                # Ch1: 1Hz, Ch2: 2Hz...
                if ch==1:
                    freq = 10 

                    val = 300 * math.sin(2 * math.pi * freq * (self.t_index / self.sample_rate))
                    val += random.uniform(-10, 10) # 噪声

                    # 转回 24bit
                    raw_int = int(val / SCALE_FACTOR)
                    if raw_int < 0: raw_int += 0x1000000
                    raw_bytes = struct.pack('>I', raw_int & 0xFFFFFF)[1:]
                    packet.extend(raw_bytes)

                elif ch==4:
                    freq = 100 

                    val = 100 * math.sin(2 * math.pi * freq * (self.t_index / self.sample_rate))
                    val += random.uniform(-10, 10) # 噪声
                
                    # 转回 24bit
                    raw_int = int(val / SCALE_FACTOR)
                    if raw_int < 0: raw_int += 0x1000000
                    raw_bytes = struct.pack('>I', raw_int & 0xFFFFFF)[1:]
                    packet.extend(raw_bytes)

                else :
                    val=0
                                        # 转回 24bit
                    raw_int = int(val / SCALE_FACTOR)
                    if raw_int < 0: raw_int += 0x1000000
                    raw_bytes = struct.pack('>I', raw_int & 0xFFFFFF)[1:]
                    packet.extend(raw_bytes)
            
            packet.extend(b'\x00' * 6)
            packet.append(0xC0)
            self.packet_queue.extend(packet)
            self.t_index += 1
            
    def write(self, data):
        pass # 假装接收指令
    
    def close(self):
        print("👻 [虚拟硬件] 关闭")

# --- 这里的解析逻辑和你之前的脚本一模一样 ---
def parse_24bit_signed(byte_seq):
    val = (byte_seq[0] << 16) | (byte_seq[1] << 8) | byte_seq[2]
    if val & 0x800000: val -= 0x1000000
    return val

def process_packet(raw_bytes):
    channel_data = []
    start_index = 2
    for i in range(DATA_CHANNELS):
        idx = start_index + i * 3
        raw_int = parse_24bit_signed(raw_bytes[idx : idx+3])
        channel_data.append(raw_int * SCALE_FACTOR)
    return channel_data

@sio.event
def connect():
    print(f">>> 已连接到服务器: {SERVER_URL}")
    # 【新增】连接后立刻发送登录包，告知服务器我是谁
    sio.emit('device_login', {'api_key': DEVICE_TOKEN})

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
            if b == b'\xa0':
                rest = ser.read(56) # 57-1
                if len(rest) == 56 and rest[-1] == 0xC0:
                    packet = b'\xa0' + rest
                    voltages = process_packet(packet)
                    
                    # 取前8路发送
                    buffer.append(voltages[:8])
                    
                    if len(buffer) >= BATCH_SIZE:
                        sio.emit('device_push_data', {
                            'api_key': DEVICE_TOKEN,
                            'data': buffer,
                            'fs': 250,
                            'timestamp': time.time()
                        })
                        print(f"发送数据包: {voltages[0]:.2f} μV ...")
                        buffer = []
    except KeyboardInterrupt:
        sio.disconnect()

if __name__ == '__main__':
    main()
