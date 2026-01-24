# app/__init__.py

import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_socketio import SocketIO

# 1. 创建 Flask 实例
app = Flask(__name__)

# 2. 配置参数
app.secret_key = 'your_secret_key'

# --- 数据库配置 (核心修改部分) ---
# 尝试从环境变量获取 'DATABASE_URL' (Render 云端会自动提供这个变量)
database_url = os.environ.get('DATABASE_URL')

# 兼容性处理：Render 给的地址可能是 postgres://，但 SQLAlchemy 需要 postgresql://
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# 智能选择：如果云端有地址就用云端的，否则(在本地)就用 sqlite
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///site.db'
# ------------------------------

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 3. 初始化插件
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login' # 未登录自动跳去 login

# SocketIO 配置 (允许跨域，使用 threading 模式)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# 4. 关键：在最后导入各个模块，避免循环引用
# 只有在这里导入，routes 里的 @app.route 才能生效
from app import models
from app import routes
from app import socket_events
