from app import db, login_manager
from flask_login import UserMixin
from datetime import datetime

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
    ip_address = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='offline')
    description = db.Column(db.String(200))
    
    # 外键：关联到 User 表
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # 建立关系：让 User 能通过 user.devices 查到他所有的设备
    user = db.relationship('User', backref=db.backref('devices', lazy=True))
