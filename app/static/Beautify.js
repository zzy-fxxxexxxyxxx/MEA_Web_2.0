export function showToastById(toastId, message, duration = 2000) {
  const toast = document.getElementById(toastId);
  if (!toast) return; // 如果找不到元素直接返回

  toast.textContent = message;
  toast.style.opacity = 1;
  toast.style.zIndex = 9999;

  setTimeout(() => {
    toast.style.opacity = 0;
  }, duration);
}