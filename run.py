import os
from app import app, db, socketio

if __name__ == "__main__":
    # 确保数据库表存在
    with app.app_context():
        db.create_all()
    
    port = int(os.environ.get("PORT", 5000))
    
    # 启动服务器 (支持 WebSocket)
        # !!! 注意：这里要把 app.run 改成 socketio.run !!!
    # allow_unsafe_werkzeug=True 是为了在开发环境使用 websocket
    print(f"🚀 MEA Web 2.0 正在启动，监听端口: {port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=True, allow_unsafe_werkzeug=True)
