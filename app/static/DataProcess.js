//-------------------------------数据预处理-----------------------------------------------------------------
import * as h5wasm from "https://cdn.jsdelivr.net/npm/h5wasm@0.7.8/dist/esm/hdf5_hl.js";

import { mode, std, mean, isoutlier, findpeaks } from "./DataProcessTool.js";

// 大整数类型改成number类型
export function toNumberIfBigInt(value) {
  return typeof value === "bigint" ? Number(value) : value;
}

// 递归读取 group/dataset (最后一层只能读成一维数组或二维数组，无法形成键值对)
function readGroup(group) {
  const obj = {};
  for (const key of group.keys()) {
    const item = group.get(key);
    if (item instanceof h5wasm.Group) {
      obj[key] = readGroup(item); // 递归读取子 group
    } else if (item instanceof h5wasm.Dataset) {
      obj[key] = item.value; // 读取 dataset 的值
    }
  }
  return obj;
}

//---------------------------------------------------------------------------------------------------
export async function readH5File(file) {
  // 先把文件写入虚拟文件系统
  const buffer = await file.arrayBuffer();
  h5wasm.FS.writeFile(file.name, new Uint8Array(buffer));

  // 打开 HDF5 文件
  const f = new h5wasm.File(file.name, "r");

  const data = readGroup(f); // 从根目录开始读取
  f.close();
  return data;
}

// 预处理：从 InfoChannel / h5Data 提取基本量（并把 bigints 转为 Number）
export function preprocessH5Data(h5Data) {
  const result = {};

  const infoChannel = h5Data.Data.Recording_0.AnalogStream.Stream_0.InfoChannel;
  if (!infoChannel) throw new Error("InfoChannel 不存在");

  // 注意：我们假设 infoChannel 是“列式对象”（你之前已经做了 transpose）
  // 所以 infoChannel.Tick[0], infoChannel.Exponent[0] 等可用
  // 若不是，请先把它转成列式对象（或调整这里）
  const tick0 = infoChannel.Tick[0];
  const exp0 = infoChannel.Exponent[0];
  // 采样率 fs
  result.fs = 1e6 / tick0;
  // 单位
  result.dataUnit = Math.pow(10, exp0);
  // rawDataFactor（确保 ConversionFactor 中的 BigInt 转为 Number）
  result.rawDataFactor = (infoChannel.ConversionFactor || []).map(
    (cf) => cf * result.dataUnit
  );
  // layout：Label 可能为字符串或 cell，尝试 parseInt
  result.layout = [];
  const labels = infoChannel.Label || [];
  for (let i = 0; i < 60; i++) {
    const lab = labels[i];
    const parsed = parseInt(lab);
    result.layout.push(Number.isNaN(parsed) ? 0 : parsed);
  }

  return result;
}

/**
 * 获取放大后的原始数据
 * @param {Array<Array<number>>} channelData - 一维维数组，行优先 [numChannels*numSamples]
 * @param {Array<number>} rawDataFactor - 通道放大因子，长度等于 numChannels
 * @returns {Array<Array<number>>} - 返回放大后的二维数组 [numChannels][numSamples]
 */
export function getRawData(h5Data, rawDataFactor) {
  const channelData = h5Data.Data.Recording_0.AnalogStream.Stream_0.ChannelData;
  if (!channelData) throw new Error("ChannelData 不存在");

  const numChannels = rawDataFactor.length;
  if (!numChannels || numChannels <= 0) {
    throw new Error("rawDataFactor 长度无效，无法确定通道数");
  }

  // 输入是一维扁平数组 (TypedArray 或普通 Array)
  if (ArrayBuffer.isView(channelData) || Array.isArray(channelData)) {
    // 转换成普通 number 数组，保证兼容 BigInt
    const flat = Array.from(channelData, (v) =>
      typeof v === "bigint" ? Number(v) : v
    );

    const total = flat.length;
    if (total % numChannels !== 0) {
      console.warn(
        `ChannelData(${total}) 不是 numChannels(${numChannels}) 的整数倍，数据可能有缺失`
      );
    }

    const numSamples = Math.floor(total / numChannels);

    const rawData = new Array(numChannels); // 外层是通道
    for (let ch = 0; ch < numChannels; ch++) {
      const row = new Array(numSamples); // 每一行是一个通道的数据
      for (let s = 0; s < numSamples; s++) {
        row[s] = flat[ch * numSamples + s] * rawDataFactor[ch];
      }
      rawData[ch] = row;
    }

    return rawData;
  }

  throw new Error("未知的 ChannelData 格式，无法解析");
}

//------------------------panel2需要的计算，尺寸错误-----------------------
// 假设 obj.rawData 是 numSamples x maxChannel 的二维数组
// maxChannel = 通道总数
// THRESHOLD_FACTOR 已定义
// waitbar 函数可用回调或简单 console.log 代替
export async function detectPeaks(obj, maxChannel, THRESHOLD_FACTOR) {
  const MAX_FIRING_RATE = 1000;
  const peakPks = Array.from({ length: MAX_FIRING_RATE }, () =>
    new Array(maxChannel).fill(0)
  );
  const peakLocs = Array.from({ length: MAX_FIRING_RATE }, () =>
    new Array(maxChannel).fill(0)
  );
  const peakNum = new Array(maxChannel).fill(0);

  let count = 0;

  for (let i = 0; i < maxChannel; i++) {
    // 提取当前通道数据
    const plotChannel = obj.rawData[i]; // 现在每行是一个通道
    // plotChannel 的长度 = numSamples

    const plotChannelStd = std(plotChannel);
    const plotChannelMean = mean(plotChannel);
    const threshold = plotChannelMean + THRESHOLD_FACTOR * plotChannelStd;

    // 阈值去噪
    const channelBuffer = plotChannel.map((val) =>
      Math.abs(val) > threshold ? val : 0
    );

    // 找峰值
    const { pks, locs } = findpeaks(channelBuffer, {
      MinPeakHeight: THRESHOLD_FACTOR * plotChannelStd,
      MinPeakDistance: 170,
    });

    // 保存峰值和位置
    for (let j = 0; j < pks.length; j++) {
      peakPks[j][i] = pks[j];
      peakLocs[j][i] = locs[j];
    }

    peakNum[i] = locs.length;

    count += 1;
    if (count % 10 == 0) {
      console.log(`数据计算中... ${((count / 60) * 100).toFixed(1)}%`);
    }
  }

  console.log({ peakPks });
  console.log({ peakLocs });
  console.log({ peakNum });

  // 判断 Active electrodes
  const peakNumNonZero = peakNum.filter((v) => v !== 0);
  const peakNumSum = mode(peakNumNonZero);
  let activeElectrodes = peakNum.map((v) => v === peakNumSum);

  console.log({ peakNumNonZero });
  console.log({ peakNumSum });
  console.log({ activeElectrodes });

  // 取第二个峰位置寻找离群值
  const peakLocs1 = peakLocs
    .slice(0, peakNumSum)
    .map((row) => row.filter((_, idx) => idx < maxChannel));

  const secondPeak = peakLocs1[1]; // MATLAB 第2行
  const peakIsOutlier = isoutlier(secondPeak);

  // 按位 AND
  activeElectrodes = activeElectrodes.map(
    (val, idx) => val & (~peakIsOutlier[idx] & 1)
  );

  // Active electrodes 序列
  const activeElectrodesSeries = activeElectrodes
    .map((v, idx) => (v ? idx : -1))
    .filter((v) => v >= 0);

  // 仅保留 active electrodes 的峰值
  const aa = Array.from({ length: peakNumSum }, () =>
    activeElectrodes.map((v) => (v ? 1 : 0))
  );

  for (let r = 0; r < peakNumSum; r++) {
    for (let c = 0; c < maxChannel; c++) {
      peakLocs1[r][c] *= aa[r][c];
      if (peakLocs1[r][c] === 0) peakLocs1[r][c] = NaN;
    }
  }

  // 删除 NaN
  let peakLocsFiltered = [];
  for (let r = 0; r < peakNumSum; r++) {
    for (const c of activeElectrodesSeries) {
      if (!Number.isNaN(peakLocs1[r][c])) {
        peakLocsFiltered.push(peakLocs1[r][c]);
      }
    }
  }

  // reshape
  const activeElectrodesNum = activeElectrodesSeries.length;
  const peakLocsReshaped = [];
  for (let r = 0; r < peakNumSum; r++) {
    peakLocsReshaped.push(
      peakLocsFiltered.slice(
        r * activeElectrodesNum,
        (r + 1) * activeElectrodesNum
      )
    );
  }

   obj.peakBaseTimes = peakLocsReshaped.map(row => row[0]/obj.fs);
  console.log({ peakLocsReshaped });
   console.log({ peakLocsReshaped });
   console.log( "peakBaseTimes" );
   console.log( obj.peakBaseTimes );

  // 计算峰值到第一个通道的时间差
  const buffer = peakLocsReshaped.map((row) =>
    row.map((val, idx) => val - row[0])
  );

  // 映射回原始 maxChannel
  obj.peakArriveTime = Array.from({ length: peakNumSum }, () =>
    new Array(maxChannel).fill(NaN)
  );

  for (let r = 0; r < peakNumSum; r++) {
    for (let c = 0; c < activeElectrodesSeries.length; c++) {
      obj.peakArriveTime[r][activeElectrodesSeries[c]] = buffer[r][c];
    }
  }
  console.log("peakArriveTime");
  console.log(obj.peakArriveTime);
  return obj;
}

export async function dataPreprocessing(h5Data) {
  const result = preprocessH5Data(h5Data);
  result.rawData = getRawData(h5Data, result.rawDataFactor);

  return result;
}
