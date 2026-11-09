# 上传 GitHub

目标仓库已经创建：[ppsuc-able/-](https://github.com/ppsuc-able/-)。项目文件已在本地准备好；上传完成后以仓库文件列表为准。登录有该仓库写入权限的账号后，使用以下方式之一。

## 方式一：网页上传

1. 在 GitHub 新建仓库后，选择上传已有文件；已有仓库则选择 **Add file → Upload files**。
2. 上传 `dist`、`data`、`docs`、`tests`、`scripts` 文件夹，以及 `README.md`、`package.json`。保留文件夹层级，不要只上传 HTML，也不要只上传 ZIP。
3. 填写提交说明，例如 `Add Gene Beats bioinformatics teaching project`，完成提交。
4. 在仓库首页检查 README 是否显示、`dist` 中四个文件是否齐全。
5. 将仓库真实地址提交给老师。压缩包只适合作为备份，源码应在仓库中可直接浏览。

## 方式二：Git 命令

适用于已安装 Git、已经新建空仓库的情况。在本项目根目录执行：

```sh
git add README.md package.json dist data docs tests scripts .gitignore
git commit -m "Add Gene Beats bioinformatics teaching project"
git remote add origin https://github.com/ppsuc-able/-.git
git push -u origin HEAD
```

若已经配置 `origin`，先运行 `git remote -v` 核对，不要重复添加或盲目覆盖。首次提交若提示缺少姓名/邮箱，配置你自己的 Git 身份；认证时按 GitHub 的登录提示操作，不要把令牌写入项目文件。

## 可选：GitHub Pages 在线演示

老师要求上传源码，并不一定要求在线部署。离线演示只需下载项目并打开 `dist/index.html`。

若你的账号与仓库支持 Pages，可在仓库 **Settings → Pages** 选择从分支部署，选择已上传的分支和 `/(root)`。发布完成后，以 GitHub 显示的真实 Pages 地址为准，访问其下的 `dist/` 路径即可打开项目。根目录没有网页首页，不能把根地址当作实验室地址。尚未启用或验证 Pages 时，不要把示例地址当成已上线链接。

## 提交前

在自己的浏览器点一次三个预设和播放，打开导出的 JSON，运行 `npm test`；把你实际使用的浏览器和测试情况补充到报告。仓库上传后可用无登录窗口验证老师能否访问（私有仓库须提供相应访问权限）。
