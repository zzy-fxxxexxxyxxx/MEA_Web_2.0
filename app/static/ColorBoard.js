  //---------------------------------------------颜色选择器-------------------------------------
  // const gradients = {
  //   color1:
  //     "linear-gradient(to right, #007b9a, #00a8cc, #66cbe9, #84d3ea, #a9deec, #d1ecf3, #fafeff, #fde4c8, #fdc999, #faab68, #f68d37, #ca5a28, #984221)",
  //   color2: "linear-gradient(to right, #88A2C7, #77B3DF, #95CB62, #FADC7E)",
  //   color3:
  //     "linear-gradient(to right, #a60026, #bf1927, #d93328, #e85337, #f57446, #fa9656, #fdb668, #fed081, #fee79a, #fff7b3, #f7fcce, #e7f6ec, #cfebf3, #b3ddeb, #97c9e0, #7ab2d4, #6095c5, #4778b6, #3c57a5, #313695)",
  //   color4:
  //     "linear-gradient(to right, #5C1877, #AA3379, #FFAA76, #FEECAF, #FFD3B6)",
  //   color5:
  //     "linear-gradient(to right, #79a6ce, #aed2e5, #f0f8dc, #fdf7b4, #ffe69a)",
  //   color6:
  //     "linear-gradient(to right, #6B95C5, #A5DEF1, #ACD7A8, #FAAD73, #FAE791)",
  //   color7:
  //     "linear-gradient(to right, #000000, #FF0000, #FF7F00, #FFD700, #FFFF00)",
  // };

  // const selectTrigger = document.getElementById("selectTrigger");
  // const selectOptions = document.getElementById("selectOptions");
  // const selectedColorPreview = document.getElementById("selectedColorPreview");
  // const body = document.body;

  // // 初始化选项预览
  // for (let i = 1; i <= 7; i++) {
  //   const preview = document.getElementById(`preview-color${i}`);
  //   if (preview) preview.style.backgroundImage = gradients[`color${i}`];
  // }

  // // 显示下拉
  // selectTrigger.addEventListener("click", (e) => {
  //   e.stopPropagation();
  //   selectOptions.classList.toggle("visible");
  //   selectTrigger.classList.toggle("active");
  // });

  // // 选项点击
  // document.querySelectorAll(".option").forEach((option) => {
  //   option.addEventListener("click", () => {
  //     const value = option.getAttribute("data-value");
  //     if (!gradients[value]) return;
  //     selectedColorPreview.style.backgroundImage = gradients[value];
  //     selectedColorPreview.style.border = "1px solid #000"; // 高亮边框
  //     body.style.backgroundImage = gradients[value];
  //     selectOptions.classList.remove("visible");
  //     selectTrigger.classList.remove("active");
  //   });
  // });

  // // 点击页面其他区域关闭下拉
  // document.addEventListener("click", () => {
  //   selectOptions.classList.remove("visible");
  //   selectTrigger.classList.remove("active");
  // });

  // // 默认显示第一个颜色
  // selectedColorPreview.style.backgroundImage = gradients.color1;
  // body.style.backgroundImage = gradients.color1;
