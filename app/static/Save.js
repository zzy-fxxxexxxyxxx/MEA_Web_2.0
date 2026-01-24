export async function saveCanvasWithTimestamp(canvasId, baseFileName = "Original_Peak",backgroundColor="white") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    alert("找不到画布！");
    return;
  }

  if (!window.showSaveFilePicker) {
    alert("你的浏览器不支持文件保存对话框，请使用 Chrome 或 Edge。");
    return;
  }

  try {
    const now = new Date();
    const timestamp = now.getFullYear() + "-" +
                      String(now.getMonth() + 1).padStart(2, "0") + "-" +
                      String(now.getDate()).padStart(2, "0") + "_" +
                      String(now.getHours()).padStart(2, "0") + "-" +
                      String(now.getMinutes()).padStart(2, "0") + "-" +
                      String(now.getSeconds()).padStart(2, "0");
    const suggestedName = `${baseFileName}_${timestamp}.png`;

    const saveHandle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: "PNG Image", accept: { "image/png": [".png"] } }]
    });

    // --- 创建临时 canvas 复制原 canvas 并填充背景 ---
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext("2d");

    // 填充白色背景
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 将原 canvas 的内容绘制到临时 canvas 上
    ctx.drawImage(canvas, 0, 0);

    const writable = await saveHandle.createWritable();

    // 保存临时 canvas
    const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, "image/png"));
    await writable.write(blob);
    await writable.close();

    alert(`保存成功！文件名：${suggestedName}`);
  } catch (err) {
    console.error(err);
  }
}

export async function saveSVGWithFormat(svgId, baseFileName = "Heatmap", backgroundColor = "white") {
  const svg = document.getElementById(svgId);
  if (!svg) {
    alert("找不到 SVG！");
    return;
  }

  if (!window.showSaveFilePicker) {
    alert("你的浏览器不支持文件保存对话框，请使用 Chrome 或 Edge。");
    return;
  }

  try {
    // 生成时间戳
    const now = new Date();
    const timestamp = now.getFullYear() + "-" +
                      String(now.getMonth() + 1).padStart(2, "0") + "-" +
                      String(now.getDate()).padStart(2, "0") + "_" +
                      String(now.getHours()).padStart(2, "0") + "-" +
                      String(now.getMinutes()).padStart(2, "0") + "-" +
                      String(now.getSeconds()).padStart(2, "0");
    const suggestedName = `${baseFileName}_${timestamp}`;

    // 弹出保存文件对话框，可选 SVG 或 PNG
    const saveHandle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        { description: "PNG Image", accept: { "image/png": [".png"] } },
        { description: "SVG Image", accept: { "image/svg+xml": [".svg"] } }
      ]
    });

    const fileExtension = saveHandle.name.split('.').pop().toLowerCase();

    // --- 处理 SVG 保存 ---
    if (fileExtension === "svg") {
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svg);

      if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const writable = await saveHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }

    // --- 处理 PNG 保存 ---
    else if (fileExtension === "png") {
      // 获取 SVG 尺寸
      const bbox = svg.getBoundingClientRect();
      const width = bbox.width;
      const height = bbox.height;

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svg);
      if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      // 创建 Image 对象
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      img.src = url;
      await new Promise(resolve => { img.onload = resolve; });

      // 绘制到临时 canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      // 填充背景
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const writable = await saveHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }

    alert(`保存成功！文件名：${saveHandle.name}`);
  } catch (err) {
    console.error(err);
  }
}



// export async function saveCanvasWithTimestamp(
//   canvasId,
//   baseFileName = "Original_Peak"
// ) {
//   const canvas = document.getElementById(canvasId);
//   if (!canvas) {
//     alert("找不到画布！");
//     return;
//   }

//   if (!window.showSaveFilePicker) {
//     alert("你的浏览器不支持文件保存对话框，请使用 Chrome 或 Edge。");
//     return;
//   }

//   try {
//     // 生成时间戳，例如：2025-10-11_17-30-05
//     const now = new Date();
//     const timestamp =
//       now.getFullYear() +
//       "-" +
//       String(now.getMonth() + 1).padStart(2, "0") +
//       "-" +
//       String(now.getDate()).padStart(2, "0") +
//       "_" +
//       String(now.getHours()).padStart(2, "0") +
//       "-" +
//       String(now.getMinutes()).padStart(2, "0") +
//       "-" +
//       String(now.getSeconds()).padStart(2, "0");

//     const suggestedName = `${baseFileName}_${timestamp}.png`;

//     // 弹出保存文件对话框
//     const saveHandle = await window.showSaveFilePicker({
//       suggestedName,
//       types: [
//         {
//           description: "PNG Image",
//           accept: { "image/png": [".png"] },
//         },
//       ],
//     });

//     const writable = await saveHandle.createWritable();

//     // 将 canvas 转成 blob 并写入文件
//     const blob = await new Promise((resolve) =>
//       canvas.toBlob(resolve, "image/png")
//     );
//     await writable.write(blob);
//     await writable.close();

//     alert(`保存成功！文件名：${suggestedName}`);
//   } catch (err) {
//     console.error(err);
//     // 用户取消保存不会报错
//   }
// }
