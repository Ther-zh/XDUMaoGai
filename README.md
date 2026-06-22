# 毛概静态学习站

离线复习 + 刷题 + 过题，数据来自 `毛概精炼版.md` 与 `【毛概】期末复习资料/` 题库。

## 打开方式

```bash
cd study-site
python -m http.server 8765
```

访问 http://localhost:8765 ，或直接双击 `index.html`。

## 页面

| 页面 | 说明 |
|------|------|
| `index.html` | 首页，三模式入口 |
| `notes.html` | 精炼笔记：【记】【答】、搜索、仅记 |
| `quiz.html` | 客观刷题：单选/多选/判断，随机/顺序/错题本 |
| `recall.html` | 主观过题：简答/论述，先看题再对答案 |

## 题库来源（build 自动提取）

- **客观**：`毛概客观题专项480.docx` + 分章练习题
- **主观**：简答题库、论述题库、`毛概主观（23级版）.md`、精炼版精讲题

## 更新数据

修改笔记或替换题库 docx 后：

```bash
python study-site/build.py
```

会生成 `data.js`（笔记）和 `quiz-data.js`（题库），刷新浏览器即可。
