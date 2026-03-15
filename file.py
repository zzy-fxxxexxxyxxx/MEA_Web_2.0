import requests
import os

# 1. 确保服务器地址正确
url = 'http://127.0.0.1:5001/api/upload_report'

# 2. 指定你要上传的真实文件路径
filename = '网站开发笔记.txt'  # 确保这个文件在当前目录下

# 3. 填写你的API Key (从设备管理页面获取)
api_key = 'mea_4c610d6f-1d78-4512-b78d-48875bc1a3a7'  # 替换为实际的API Key

# 检查文件是否存在
if not os.path.exists(filename):
    print(f"❌ 错误：找不到文件 {filename}")
    exit()

# 4. 上传文件
try:
    print(f"正在上传 {filename} ...")
    
    with open(filename, 'rb') as f:
        # 构造请求
        files = {'file': f}
        data = {'api_key': api_key}
        
        # 发送 POST 请求
        r = requests.post(url, files=files, data=data)

    print("服务器返回:", r.text)
    
    if r.status_code == 200:
        print("✅ 上传成功！")
    else:
        print(f"❌ 上传失败，状态码: {r.status_code}")

except Exception as e:
    print(f"❌ 发生异常: {e}")