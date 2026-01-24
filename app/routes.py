from flask import render_template, request, jsonify, redirect, url_for, flash, session
from flask_login import login_user, logout_user, current_user, login_required
from app import app, db, bcrypt # 从 __init__ 导入 app
from app.models import User, Device
import numpy as np
import neurokit2 as nk
import os
from werkzeug.utils import secure_filename

# --- 配置 ---
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- 页面路由 ---
# 0. 注册路由 (最终版：使用模板 + Flash提示)
@app.route("/")
def index():
    return render_template("MEA.html")

# 1. 注册路由 (最终版：使用模板 + Flash提示)
@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == "POST":
        username = request.form.get("username")
        nickname = request.form.get("nickname")
        password = request.form.get("password")
        
        user = User.query.filter_by(username=username).first()
        if user:
            flash("该用户名已被占用，请换一个试试", "error")
            return render_template("register.html")
        
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user = User(username=username, password=hashed_password, nickname=nickname)
        db.session.add(new_user)
        db.session.commit()
        
        flash("注册成功！请使用新账号登录", "success")
        return redirect(url_for('login'))
    return render_template("register.html")

# 2. 登录路由 (最终版：使用模板文件)
@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = User.query.filter_by(username=username).first()
        
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('index'))
        else:
            flash("登录失败，请检查账号密码", "error")
    return render_template("login.html")

# 3. 退出登录
@app.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('index'))

# 4. 用户中心 (渲染正式模板)
@app.route("/profile")
@login_required
def profile():
    return render_template("profile.html")

# 5. 更新昵称路由
@app.route("/update_profile", methods=["POST"])
@login_required
def update_profile():
    new_nickname = request.form.get("nickname")
    if new_nickname:
        current_user.nickname = new_nickname
        db.session.commit()
        # flash("昵称修改成功！", "success")
    return redirect(url_for('profile'))

# 6. 头像上传路由
@app.route("/upload_avatar", methods=['POST'])
@login_required
def upload_avatar():
    if 'avatar' not in request.files:
        flash('没有检测到文件', 'error')
        return redirect(url_for('profile'))
    file = request.files['avatar']
    if file.filename == '':
        flash('未选择文件', 'error')
        return redirect(url_for('profile'))
        
    if file and allowed_file(file.filename):
        # 1. 生成安全的文件名 (建议用 用户ID.jpg，防止文件名冲突)
        # 获取文件后缀 (如 .jpg)
        ext = file.filename.rsplit('.', 1)[1].lower()
        # 新文件名：avatar_用户ID.jpg
        new_filename = f"avatar_{current_user.id}.{ext}"
        
        # 保存路径：注意这里的 app.root_path
        # 确保这个文件夹存在
        save_dir = os.path.join(app.root_path, 'static', 'avatars')
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)
        save_path = os.path.join(save_dir, new_filename)
        
        # 3. 保存文件
        file.save(save_path)
        
        # 4. 更新数据库
        current_user.image_file = f"avatars/{new_filename}"
        db.session.commit()
        # flash('头像更新成功！', 'success')
    # else:
        # flash('不支持的文件格式，请上传 jpg/png', 'error')
    return redirect(url_for('profile'))

# 7. 我的设备列表
@app.route("/my_devices")
@login_required
def my_devices():
    # 查询当前用户的所有设备
    user_devices = current_user.devices
    return render_template("devices.html", devices=user_devices)

# 8. 处理添加设备
@app.route("/add_device", methods=["POST"])
@login_required
def add_device():
    name = request.form.get("name")
    ip = request.form.get("ip_address")
    desc = request.form.get("description")
    
    # 创建新设备记录
    new_device = Device(name=name, ip_address=ip, description=desc, user=current_user)
    db.session.add(new_device)
    db.session.commit()
    
    # 不要用 flash，而是设置一个 session 标记
    session['toast_message'] = "设备添加成功！"
    session['toast_type'] = "success"
    return redirect(url_for('my_devices'))

# 9. 删除设备路由
@app.route("/delete_device/<int:device_id>", methods=["POST"])
@login_required
def delete_device(device_id):
    # 1. 查找设备，找不到就报 404
    device = Device.query.get_or_404(device_id)
    
    # 2. 安全检查：必须是当前用户的设备才能删
    if device.user != current_user:
        session['toast_message'] = "非法操作：您无权删除此设备"
        session['toast_type'] = "error"
        return redirect(url_for('my_devices'))
    
    # 3. 执行删除
    try:
        db.session.delete(device)
        db.session.commit()
        session['toast_message'] = f"设备 {device.name} 已删除"
        session['toast_type'] = "success"
    except Exception as e:
        db.session.rollback()
        session['toast_message'] = "删除失败，请重试"
        session['toast_type'] = "error"
    return redirect(url_for('my_devices'))

# 10. 帮助文档
@app.route("/help_doc")
def help_doc():
    return render_template("help.html")

# 11. --- 原始信号处理功能 ---
@app.route("/process_signal", methods=["POST"])
def process_signal():
    try:
        data = request.json
        signal = np.array(data.get("signal"), dtype=float)
        fs = int(float(data.get("fs", 0)))
        
        clean = nk.ecg_clean(signal, sampling_rate=fs, method="vg")
        _, rpeaks_dict = nk.ecg_peaks(clean, sampling_rate=fs, method="vg")
        rpeaks = rpeaks_dict["ECG_R_Peaks"].astype(float)
        
        return jsonify({
            "clean": clean.tolist(),
            "rpeaks": rpeaks.tolist()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 实时监测页面入口 (还是属于路由)
@app.route("/monitor/<int:device_id>")
@login_required
def monitor(device_id):
    device = Device.query.get_or_404(device_id)
    return render_template("MEA.html", device=device)
