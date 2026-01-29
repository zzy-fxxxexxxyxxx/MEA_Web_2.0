from app import db, login_manager
from flask_login import UserMixin
from datetime import datetime
import uuid

# 用户加载回调
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# 用户模型
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    nickname = db.Column(db.String(50), nullable=True)
    password = db.Column(db.String(60), nullable=False)
    join_date = db.Column(db.DateTime, default=datetime.utcnow)
    image_file = db.Column(db.String(20), nullable=False, default='user.jpg')
    
    def __repr__(self):
        return f"User('{self.username}')"

# 设备模型
class Device(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    
    # 【新增】API Key：唯一、不可为空、自动生成
    # 格式类似：mea_550e8400-e29b-41d4-a716-446655440000
    api_key = db.Column(db.String(64), unique=True, nullable=False, default=lambda: f"mea_{str(uuid.uuid4())}")
    
    ip_address = db.Column(db.String(50), nullable=True) # 这个其实可以变成选填，因为云端不需要知道设备局域网IP
    status = db.Column(db.String(20), default='offline')
    description = db.Column(db.String(200))
    
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref('devices', lazy=True))

# 文件通知模型
class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(100), nullable=False)
    device_id = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=datetime.now)
    download_url = db.Column(db.String(200))
    is_read = db.Column(db.Boolean, default=False) # 记录是否已读（可选）
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # 添加用户关联
    
    # 定义关系
    user = db.relationship('User', backref=db.backref('notifications', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'device': self.device_id,
            'time': self.timestamp.strftime('%H:%M'), # 格式化时间
            'url': self.download_url,
            'is_read': self.is_read
        }