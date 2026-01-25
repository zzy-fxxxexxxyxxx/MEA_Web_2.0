import serial
import socketio
import time
import struct
import numpy as np

# ================= 配置区 =================
SERIAL_PORT = 'COM5'  # 请修改为你的实际端口
BAUD_RATE = 460800    # 波特率
SERVER_URL = 'http://127.0.0.1:5000/' 
DEVICE_TOKEN = "mea_3eede2cc-1ea6-4ed5-ad1b-a6dee2bb8437" # 请填入你的 Key

# 包定义
PACKET_LEN = 57       # 根据你的C代码推算的长度
DATA_CHANNELS = 16    # 2片芯片 x 8通道 = 16通道
BATCH_SIZE = 25       # 打包发送数量
SCALE_FACTOR = 4.5 / 24 / (2**23 - 1) * 1000000 # 转换为 μV
# ==========================================

sio = socketio.Client()
ser = None

def parse_24bit_signed(byte_seq):
    """3字节转有符号整数"""
    val = (byte_seq[0] << 16) | (byte_seq[1] << 8) | byte_seq[2]
    if val & 0x800000:
        val -= 0x1000000
    return val

def process_packet(raw_bytes):
    """
    解析 57 字节自定义包
    格式: [A0] [Flag] [Chip1_24B] [Chip2_24B] [Pad_6B] [C0]
    """
    channel_data = []
    
    # 解析数据区 (从索引 2 开始，共 48 字节 = 16通道 * 3)
    # 你的代码里: 
    # Chip1: base+2 ~ base+25
    # Chip2: base+26 ~ base+49
    
    start_index = 2
    
    for i in range(DATA_CHANNELS): # 0~15
        idx = start_index + i * 3
        # 提取3个字节
        b_seq = raw_bytes[idx : idx+3]
        
        raw_int = parse_24bit_signed(b_seq)
        microvolts = raw_int * SCALE_FACTOR
        channel_data.append(microvolts)
        
    return channel_data

@sio.event
def connect():
    print(f">>> 已连接服务器")

def main():
    global ser
    try:
        sio.connect(SERVER_URL)
    except Exception as e:
        print(f"❌ 云端连接失败: {e}")
        return

    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        ser.dtr = False
        ser.rts = False
        print(f">>> 串口 {SERIAL_PORT} 打开成功")
        # 你的代码看起来是下位机自动发送的，不需要发 'b' 指令？
        # 如果需要，请取消下面注释
        # time.sleep(2)
        # ser.write(b'b') 
        
    except Exception as e:
        print(f"❌ 串口错误: {e}")
        return

    print(f"--- 开始解析 {PACKET_LEN} 字节数据包 ---")
    buffer = [] 
    
    try:
        while True:
            # 1. 寻找包头 A0
            b = ser.read(1)
            if b == b'\xa0':
                # 2. 读取剩余 56 字节
                rest = ser.read(PACKET_LEN - 1)
                
                if len(rest) == (PACKET_LEN - 1) and rest[-1] == 0xC0:
                    # 校验通过
                    full_packet = b'\xa0' + rest
                    all_16_channels = process_packet(full_packet)
                    
                    # ⚠️ 策略选择：
                    # 如果你网页只配置了 8 路，这里只发前 8 路
                    # 如果网页能抗住 16 路，就发 all_16_channels
                    channels_to_send = all_16_channels[:8] 
                    
                    buffer.append(channels_to_send)
                    
                    if len(buffer) >= BATCH_SIZE:
                        sio.emit('device_push_data', {
                            'api_key': DEVICE_TOKEN,
                            'data': buffer,
                            'fs': 250,
                            'timestamp': time.time()
                        })
                        buffer = []
                else:
                    # 丢包或错位，继续找下一个 A0
                    pass
                    
    except KeyboardInterrupt:
        if ser: ser.close()
        sio.disconnect()

if __name__ == '__main__':
    main()
