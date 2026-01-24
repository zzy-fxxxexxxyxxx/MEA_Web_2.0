// 求众数，返回数组中出现频率最高的元素
export function mode(arr) {
  const freq = {};
  for (const v of arr) {
    freq[v] = (freq[v] || 0) + 1;
  }
  let best = null;
  let bestCount = -1;
  for (const [k, c] of Object.entries(freq)) {
    if (c > bestCount) {
      bestCount = c;
      best = k;
    }
  }
  return best === null ? null : Number(best);
}

/**
 * 计算数组的标准差
 * @param {number[]} arr - 输入数组
 * @param {number} ddof - 自由度调整（0=总体标准差，1=样本标准差）
 * @returns {number} 标准差
 */
export function std(arr, ddof = 0) {
  const n = arr.length;
  if (n === 0 || ddof >= n) return NaN;

  const mean = arr.reduce((sum, x) => sum + x, 0) / n;
  const variance =
    arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - ddof);

  return Math.sqrt(variance);
}

/**
 * 计算数组的均值
 * @param {number[]} arr - 输入数组
 * @returns {number} - 均值
 */
export function mean(arr) {
  const n = arr.length;
  if (n === 0) return NaN;
  return arr.reduce((sum, x) => sum + x, 0) / n;
}

/**
 * JS版 isoutlier (基于中位数和绝对中位差)
 * @param {Array<number>} data - 输入一维数值数组
 * @param {number} threshold - 阈值系数，默认3（类似MATLAB默认）
 * @returns {Array<boolean>} - 布尔数组，true表示离群值
 */
export function isoutlier(data, threshold = 3) {
  const n = data.length;
  if (n === 0) return [];

  // 计算中位数
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median =
    n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // 计算绝对中位差（MAD）
  const deviations = data.map((v) => Math.abs(v - median));
  const sortedDev = [...deviations].sort((a, b) => a - b);
  const mad =
    n % 2 === 0 ? (sortedDev[mid - 1] + sortedDev[mid]) / 2 : sortedDev[mid];

  // 判断是否离群
  return data.map((v) => Math.abs(v - median) / (mad || 1e-10) > threshold);
}

/**
 * 查找数组中的局部峰值
 * @param {Array<number>} data - 一维数组
 * @param {Object} options - 配置选项
 * @param {number} [options.MinPeakHeight=-Infinity] - 峰值最小高度
 * @param {number} [options.MinPeakDistance=1] - 峰值之间最小距离（单位：样本点数）
 * @returns {Object} { pks: Array<number>, locs: Array<number> }
 */
export function findpeaks(data, options = {}) {
  const MinPeakHeight = options.MinPeakHeight ?? -Infinity;
  const MinPeakDistance = options.MinPeakDistance ?? 1;

  const pks = [];
  const locs = [];

  const N = data.length;

  for (let i = 1; i < N - 1; i++) {
    if (
      data[i] > data[i - 1] &&
      data[i] > data[i + 1] &&
      data[i] >= MinPeakHeight
    ) {
      // check MinPeakDistance
      if (locs.length === 0 || i - locs[locs.length - 1] >= MinPeakDistance) {
        pks.push(data[i]);
        locs.push(i);
      } else {
        // 如果距离太近，保留幅值更大的那个峰
        if (data[i] > pks[pks.length - 1]) {
          pks[pks.length - 1] = data[i];
          locs[locs.length - 1] = i;
        }
      }
    }
  }

  return { pks, locs };
}
