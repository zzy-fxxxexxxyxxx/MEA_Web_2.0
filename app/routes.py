from flask import render_template, request, jsonify, redirect, url_for, flash, session
from flask_login import login_user, logout_user, current_user, login_required
from app import app, db, bcrypt # 从 __init__ 导入 app
from app.models import User, Device, Notification # ✨ 记得导入模型
import numpy as np
import neurokit2 as nk
import os
from werkzeug.utils import secure_filename
# 1. 在文件最顶部添加这些导入 (如果有了就不用加)
import os
from flask import request, jsonify, send_from_directory, current_app
from app import socketio  # 确保能导入 socketio 实例

# 2. 定义上传文件的保存路径 (建议放在 app/static 下或者单独的 uploads 文件夹)
# 这里我们放在 app/uploaded_reports 文件夹下
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploaded_reports')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


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


# 3. 把下面这两个函数复制到文件最末尾

# --- 接口 A: 接收实验室电脑上传 ---
@app.route('/api/upload_report', methods=['POST'])
def upload_report():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    api_key = request.form.get('api_key')  # 获取API Key
    
    # 如果提供了API Key，验证设备身份
    if api_key:
        from app.models import Device
        device = Device.query.filter_by(api_key=api_key).first()
        if not device:
            return jsonify({'error': 'Invalid API Key'}), 401
        
        # 使用设备的真实名称和所属用户ID
        device_id = device.name
        user_id = device.user_id  # 获取设备所属用户ID
    else:
        # 向后兼容：如果没有提供API Key，返回错误（因为需要确定用户）
        return jsonify({'error': 'API Key is required'}), 400
    
    if file:
        filename = file.filename
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(save_path)
        download_url = f"/api/download/{filename}"
        # ✨✨✨ 新增：写入数据库，并关联用户ID ✨✨✨
        new_notif = Notification(
            filename=filename,
            device_id=device_id,
            download_url=download_url,
            user_id=user_id  # 关联到设备所属用户
        )
        db.session.add(new_notif)
        db.session.commit()
        # ✨✨✨ 结束 ✨✨✨

        # Socket 广播继续保留，但只发送给特定用户
        # 可以使用房间功能，每个用户加入自己的房间
        socketio.emit('new_report_uploaded', new_notif.to_dict(), room=f'user_{user_id}')
        
        return "Upload Success", 200
    return "Error", 500


# 2. ✨ 新增：获取历史通知的接口
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    if not current_user.is_authenticated:
        return jsonify([])  # 未登录用户返回空数组
    # 获取当前登录用户的最近20条通知，按时间倒序
    notifs = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.timestamp.desc()).limit(20).all()
    return jsonify([n.to_dict() for n in notifs])

# 3. ✨ 新增：清空通知接口 (对应前端的清空按钮)
@app.route('/api/notifications/clear', methods=['POST'])
def clear_notifications():
    try:
        if current_user.is_authenticated:
            # 只清空当前用户的通知
            Notification.query.filter_by(user_id=current_user.id).delete()
            db.session.commit()
        return "Cleared", 200
    except Exception as e:
        db.session.rollback()
        print(f"清空通知失败: {str(e)}")
        return "Error", 500
    
@app.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_single_notification_read(notif_id):
    try:
        if not current_user.is_authenticated:
            return "Not authenticated", 401
        
        # 只查找当前用户的通知
        notif = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first()
        if notif and not notif.is_read:
            notif.is_read = True
            db.session.commit()
            return "Read", 200
        return "Already read or not found", 200
    except Exception as e:
        db.session.rollback()
        print(f"标记通知为已读失败: {str(e)}")
        return "Error", 500
    
# --- 接口 B: 给网页下载文件 ---
@app.route('/api/download/<path:filename>', methods=['GET'])
@login_required  # 确保用户已登录
def download_file(filename):
    # 检查文件是否属于当前用户
    notif = Notification.query.filter_by(filename=filename, user_id=current_user.id).first()
    if not notif:
        return jsonify({'error': 'File not found or you don\'t have permission to download it'}), 404
    
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)