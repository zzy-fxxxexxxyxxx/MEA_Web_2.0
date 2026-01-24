import os
from app import app, db, socketio

# ▼▼▼▼▼▼ 修改重点在这里 ▼▼▼▼▼▼

# 将创建表的代码移到 if 之外
# 这样无论是本地运行，还是 Gunicorn 启动，它都会被执行
with app.app_context():
    db.create_all()
    print(">>> 云端数据库表已自动创建完成")

# ▲▲▲▲▲▲ 修改结束 ▲▲▲▲▲▲

if __name__ == "__main__":

# if __name__ == "__main__": 到底是干嘛的？
# 这句的真实含义是：
# “只有当这个文件是‘被直接运行’的时候，才执行下面的代码”


    # # 确保数据库表存在
    # with app.app_context():
    #     db.create_all()

    port = int(os.environ.get("PORT", 5000))

    # 启动服务器 (支持 WebSocket)
    # !!! 注意：这里要把 app.run 改成 socketio.run !!!
    # allow_unsafe_werkzeug=True 是为了在开发环境使用 websocket
    print(f"🚀 MEA Web 2.0 正在启动，监听端口: {port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=True, allow_unsafe_werkzeug=True)
