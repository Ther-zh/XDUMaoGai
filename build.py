# -*- coding: utf-8 -*-
"""Build study-site/data.js and quiz-data.js from local materials."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
SITE = Path(__file__).parent
MD = ROOT / "毛概精炼版.md"
SUBJ_MD = ROOT / "毛概主观（23级版）.md"
OUT = SITE / "data.js"
QUIZ_OUT = SITE / "quiz-data.js"

Q_START = re.compile(r"^(\d+)[\.、]\s*(?:\(([^)]+)\))?(.*)$")
OPT_LINE = re.compile(r"^([A-D])[\.、．]\s*(.+)$")
ANS_OBJ = re.compile(r"^正确答案:\s*([^:：]+)[:：]?\s*(.*)$")
ANS_JUDGE = re.compile(r"^正确答案:\s*(对|错)\s*$")
SUBJ_Q = re.compile(r"^(\d+)[、．.]\s*(.+)$")
SUBJ_ANS = re.compile(r"^(答[：:]|答案[：:])")


def md_inline(text: str) -> str:
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"==(.+?)==", r'<span class="hl">\1</span>', text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\[\^(\d+)\]", r'<sup class="fn"><a href="#fn-\1">\1</a></sup>', text)
    return text


def parse_qtitle(raw: str) -> str:
    """#### **题目？**（后缀） → 题目？（后缀）"""
    s = raw.strip()
    m = re.match(r"^\*\*(.+?)\*\*(.*)$", s, re.S)
    if m:
        return m.group(1) + m.group(2)
    return re.sub(r"^\*\*|\*\*$", "", s)


def md_table(lines: list[str]) -> str:
    """Render markdown pipe tables to HTML."""
    if len(lines) < 2:
        return ""
    rows = []
    for ln in lines:
        if not ln.strip().startswith("|"):
            continue
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        if all(re.match(r"^:?-+:?$", c.replace(" ", "")) for c in cells):
            continue
        rows.append(cells)
    if not rows:
        return ""
    head, body = rows[0], rows[1:]
    ths = "".join(f"<th>{md_inline(c)}</th>" for c in head)
    trs = []
    for row in body:
        tds = "".join(f"<td>{md_inline(c)}</td>" for c in row)
        trs.append(f"<tr>{tds}</tr>")
    return f'<table class="md-table"><thead><tr>{ths}</tr></thead><tbody>{"".join(trs)}</tbody></table>'


def parse_md(content: str) -> dict:
    lines = content.splitlines()
    meta_lines = []
    footnotes = {}
    sections = []
    i = 0

    while i < len(lines) and not lines[i].startswith("## "):
        if lines[i].startswith("[^"):
            m = re.match(r"\[\^(\d+)\]:(.*)", lines[i])
            if m:
                footnotes[m.group(1)] = m.group(2).strip()
        elif lines[i].strip() and not lines[i].startswith("#"):
            meta_lines.append(lines[i].strip())
        i += 1

    while i < len(lines):
        line = lines[i]
        if line.startswith("[^"):
            m = re.match(r"\[\^(\d+)\]:(.*)", line)
            if m:
                footnotes[m.group(1)] = m.group(2).strip()
            i += 1
            continue
        if not line.startswith("## "):
            i += 1
            continue

        title = line[3:].strip()
        sec_id = re.sub(r"[^\w\u4e00-\u9fff]+", "-", title)[:40].strip("-") or f"s{len(sections)}"
        section = {
            "id": sec_id,
            "title": title,
            "intro": "",
            "knowledge": [],
            "questions": [],
            "isTemplate": "通用模板" in title or title.startswith("附录"),
        }
        i += 1
        mode = "knowledge" if section["isTemplate"] else None
        current_q = None
        table_buf: list[str] = []

        def flush_table():
            nonlocal table_buf
            if not table_buf:
                return
            html = md_table(table_buf)
            table_buf = []
            if not html:
                return
            if mode == "knowledge":
                section["knowledge"].append(html)
            elif mode == "memo" and current_q:
                current_q["memo"].append(html)
            elif mode == "answer" and current_q:
                current_q["answer"].append(html)

        while i < len(lines):
            l = lines[i]
            if l.startswith("## ") and not l.startswith("###"):
                flush_table()
                break
            if l.strip() == "---":
                flush_table()
                i += 1
                break
            if l.startswith("### 知识点"):
                flush_table()
                mode = "knowledge"
                i += 1
                continue
            if l.startswith("### 题目"):
                flush_table()
                mode = "questions"
                i += 1
                continue
            if l.startswith("#### "):
                flush_table()
                if current_q:
                    section["questions"].append(current_q)
                qtitle = parse_qtitle(l[5:])
                current_q = {"title": qtitle, "titleHtml": "", "memo": [], "answer": []}
                mode = "qbody"
                i += 1
                continue
            if l.strip() == "**【记】**":
                flush_table()
                mode = "memo"
                i += 1
                continue
            if l.strip() == "**【答】**":
                flush_table()
                mode = "answer"
                i += 1
                continue

            stripped = l.strip()
            if stripped.startswith("|"):
                table_buf.append(stripped)
                i += 1
                continue
            flush_table()
            if not stripped:
                i += 1
                continue

            html = md_inline(stripped)
            if stripped.startswith("> "):
                html = f'<p class="lead">{md_inline(stripped[2:])}</p>'
            elif stripped.startswith("- "):
                html = f"<li>{md_inline(stripped[2:])}</li>"
            elif stripped.startswith("\t- "):
                html = f'<li class="indent">{md_inline(stripped[3:])}</li>'

            if mode == "knowledge":
                if stripped.startswith("> "):
                    section["intro"] = html
                else:
                    section["knowledge"].append(html)
            elif mode == "memo" and current_q:
                current_q["memo"].append(html)
            elif mode == "answer" and current_q:
                current_q["answer"].append(html)
            i += 1

        flush_table()
        if current_q:
            section["questions"].append(current_q)
        sections.append(section)

    meta = meta_lines[:6]
    return {
        "title": "毛概精炼版",
        "meta": meta,
        "metaHtml": [md_inline(re.sub(r"^>\s*", "", m)) for m in meta],
        "sections": sections,
        "footnotes": footnotes,
    }


def wrap_lists(items):
    if not items:
        return ""
    out = []
    buf = []
    for item in items:
        if item.startswith("<li"):
            buf.append(item)
        else:
            if buf:
                out.append("<ul>" + "".join(buf) + "</ul>")
                buf = []
            out.append(item)
    if buf:
        out.append("<ul>" + "".join(buf) + "</ul>")
    return "".join(out)


def find_file(keywords: list[str], ext: str = ".docx") -> Path | None:
    for p in ROOT.rglob(f"*{ext}"):
        name = p.name
        if all(k in name for k in keywords):
            return p
    return None


def read_docx_paras(path: Path) -> list[str]:
    import docx

    try:
        return [p.text.strip() for p in docx.Document(str(path)).paragraphs if p.text.strip()]
    except Exception as e:
        print(f"SKIP {path.name}: {e}")
        return []


def norm_type(tag: str) -> str:
    if "多选" in tag:
        return "multi"
    if "判断" in tag:
        return "judge"
    return "single"


def parse_objective_docx(path: Path, source: str) -> list[dict]:
    paras = read_docx_paras(path)
    items = []
    current = "single"
    i = 0
    while i < len(paras):
        line = paras[i]
        if re.match(r"^[一二三四五六七八九十]+[\.\、]", line):
            if "多选" in line:
                current = "multi"
            elif "判断" in line:
                current = "judge"
            elif "单选" in line:
                current = "single"
            i += 1
            continue

        m = Q_START.match(line)
        if not m:
            i += 1
            continue

        num, tag, rest = m.group(1), m.group(2) or "", m.group(3).strip()
        qtype = norm_type(tag) if tag else current
        stem = rest
        options = []
        i += 1

        while i < len(paras):
            pl = paras[i]
            if Q_START.match(pl) or re.match(r"^[一二三四五六七八九十]+[\.\、]", pl):
                break
            om = OPT_LINE.match(pl)
            if om:
                options.append({"key": om.group(1), "text": om.group(2).strip()})
                i += 1
                continue
            am = ANS_OBJ.match(pl) or ANS_JUDGE.match(pl)
            if am:
                ans_raw = am.group(1).strip()
                ans_text = am.group(2).strip().rstrip(";；") if am.lastindex >= 2 else ""
                if qtype == "judge":
                    answer = "对" if ans_raw == "对" else "错"
                else:
                    answer = re.sub(r"\s+", "", ans_raw.upper())
                items.append(
                    {
                        "id": f"{source}-{qtype}-{num}",
                        "type": qtype,
                        "num": int(num),
                        "question": stem,
                        "options": options,
                        "answer": answer,
                        "answerText": ans_text,
                        "source": source,
                    }
                )
                i += 1
                break
            if not options and stem and not stem.endswith(("。", "？", "?", "）", ")")):
                stem += pl
            i += 1
    return items


def parse_subjective_docx(path: Path, source: str, qtype: str) -> list[dict]:
    paras = read_docx_paras(path)
    items = []
    i = 0
    while i < len(paras):
        line = paras[i]
        if line in ("毛概简答题", "毛概论述题") or line.startswith("毛概"):
            i += 1
            continue
        m = SUBJ_Q.match(line)
        if not m:
            i += 1
            continue
        num, question = m.group(1), m.group(2).strip()
        i += 1
        ans_lines = []
        if i < len(paras) and SUBJ_ANS.match(paras[i]):
            ans_lines.append(re.sub(r"^(答[：:]|答案[：:])", "", paras[i]).strip())
            i += 1
        while i < len(paras):
            if SUBJ_Q.match(paras[i]) or re.match(r"^[一二三四五六七八九十]+[\.\、]", paras[i]):
                break
            if paras[i].startswith("参考答案"):
                break
            ans_lines.append(paras[i])
            i += 1
        answer = "\n".join(x for x in ans_lines if x).strip()
        items.append(
            {
                "id": f"{source}-{num}",
                "type": qtype,
                "num": int(num),
                "question": question,
                "answer": answer,
                "memo": "",
                "chapter": "",
                "source": source,
            }
        )
    return items


def parse_subjective_md(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    items = []
    chapter = ""
    for line in text.splitlines():
        if line.startswith("## "):
            chapter = line[3:].strip()
            continue
        m = re.match(r"^### (\d+)\.\s*(.+)$", line.strip())
        if not m:
            continue
        num, question = m.group(1), m.group(2).strip()
        items.append(
            {
                "id": f"主观23-{chapter}-{num}",
                "type": "short",
                "num": int(num),
                "question": question,
                "answer": "",
                "memo": "",
                "chapter": chapter,
                "source": "主观23级",
                "_pending": True,
            }
        )
    # second pass for answers (bullet points after ###)
    lines = text.splitlines()
    i = 0
    idx = 0
    while i < len(lines) and idx < len(items):
        line = lines[i]
        if re.match(r"^### \d+\.", line.strip()):
            ans = []
            i += 1
            while i < len(lines) and not lines[i].startswith("##") and not re.match(r"^### \d+\.", lines[i].strip()):
                s = lines[i].strip()
                if s.startswith("- "):
                    ans.append(s[2:])
                elif s:
                    ans.append(s)
                i += 1
            items[idx]["answer"] = "\n".join(ans)
            items[idx].pop("_pending", None)
            idx += 1
            continue
        i += 1
    return [x for x in items if not x.get("_pending")]


def subjective_from_refined(data: dict) -> list[dict]:
    items = []
    for sec in data["sections"]:
        for qi, q in enumerate(sec["questions"], 1):
            memo_text = re.sub(r"<[^>]+>", "", wrap_lists(q["memo"]))
            ans_text = re.sub(r"<[^>]+>", "", wrap_lists(q["answer"]))
            items.append(
                {
                    "id": f"精炼-{sec['id']}-{qi}",
                    "type": "essay" if "论述" in q["title"] or "★★★" in q["title"] else "short",
                    "num": qi,
                    "question": q["title"],
                    "answer": ans_text,
                    "memo": memo_text,
                    "chapter": sec["title"],
                    "source": "精炼版",
                }
            )
    return items


def parse_chapter_answer_map(tail: str, qtype: str) -> dict[int, str]:
    """Parse 参考答案 block after a choice section (single: 1-5DDDAA, multi: 1.ABD)."""
    ans_map: dict[int, str] = {}
    head = tail[:800]
    if qtype == "single":
        for range_m in re.finditer(r"(\d+)-(\d+)([A-D]+)", head):
            start, end, letters = int(range_m.group(1)), int(range_m.group(2)), range_m.group(3)
            for offset, ch in enumerate(letters):
                num = start + offset
                if num <= end:
                    ans_map[num] = ch
        return ans_map
    for am in re.finditer(r"(\d+)\.([A-D]+)", head):
        ans_map[int(am.group(1))] = am.group(2)
    return ans_map


def parse_chapter_exercises() -> tuple[list[dict], list[dict]]:
    """Parse per-chapter docx practice files (MCQ + short answer)."""
    objective = []
    subjective = []
    for p in sorted(ROOT.rglob("*.docx")):
        if "知识点及练习题" not in p.name and "章知识点" not in p.name:
            continue
        m = re.search(r"第(\d+)章", p.name)
        if not m:
            continue
        chapter = f"第{m.group(1)}章"
        paras = read_docx_paras(p)
        text = "\n".join(paras)

        # short answers in (三)简答题 section
        sa_match = re.search(r"\(三\)简答题\s*\n(.+?)(?:\n参考答案|\Z)", text, re.S)
        if sa_match:
            block = sa_match.group(1)
            parts = re.split(r"\n(?=\d+[\.、])", block)
            for part in parts:
                pm = re.match(r"^(\d+)[\.、]\s*(.+?)\n(?:答[：:]?\s*)?([\s\S]*)", part.strip())
                if pm:
                    subjective.append(
                        {
                            "id": f"章练-{chapter}-简{pm.group(1)}",
                            "type": "short",
                            "num": int(pm.group(1)),
                            "question": pm.group(2).strip(),
                            "answer": pm.group(3).strip(),
                            "memo": "",
                            "chapter": chapter,
                            "source": "分章练习",
                        }
                    )

        for section_tag, qtype in (("单选题", "single"), ("多选题", "multi")):
            sec_pat = rf"（[一二三]）{section_tag}\s*\n(.+?)(?:\n参考答案|\n（[一二三]）|\Z)"
            sm = re.search(sec_pat, text, re.S)
            if not sm:
                continue
            body = sm.group(1)
            ans_map = parse_chapter_answer_map(text[sm.end() :], qtype)

            parts = re.split(r"\n(?=\d+[\.、])", body.strip())
            for part in parts:
                pm = re.match(r"^(\d+)[\.、]\s*(.+)", part.strip(), re.S)
                if not pm:
                    continue
                num = int(pm.group(1))
                rest = pm.group(2)
                opt_parts = re.split(r"(?=[A-D][\.、．])", rest)
                stem = opt_parts[0].strip()
                options = []
                for op in opt_parts[1:]:
                    om = OPT_LINE.match(op.strip())
                    if om:
                        options.append({"key": om.group(1), "text": om.group(2).strip()})
                answer = ans_map.get(num, "")
                if stem and (options or qtype == "judge"):
                    objective.append(
                        {
                            "id": f"章练-{chapter}-{qtype}-{num}",
                            "type": qtype,
                            "num": num,
                            "question": stem,
                            "options": options,
                            "answer": answer,
                            "answerText": "",
                            "chapter": chapter,
                            "source": "分章练习",
                        }
                    )
    return objective, subjective


def build_quiz_data(refined: dict) -> dict:
    objective = []
    subjective = []

    obj480 = find_file(["客观", "480"])
    if obj480:
        objective.extend(parse_objective_docx(obj480, "客观480"))

    jdt = find_file(["简答"])
    if jdt:
        subjective.extend(parse_subjective_docx(jdt, "简答题库", "short"))

    lst = find_file(["论述"])
    if lst:
        subjective.extend(parse_subjective_docx(lst, "论述题库", "essay"))

    if SUBJ_MD.exists():
        subjective.extend(parse_subjective_md(SUBJ_MD))

    subjective.extend(subjective_from_refined(refined))

    ch_obj, ch_sub = parse_chapter_exercises()
    objective.extend(ch_obj)
    subjective.extend(ch_sub)

    # dedupe subjective by normalized question text
    seen = set()
    deduped_sub = []
    for q in subjective:
        key = re.sub(r"\s+", "", q["question"])[:80]
        if key in seen:
            continue
        seen.add(key)
        deduped_sub.append(q)

    return {
        "stats": {
            "objective": len(objective),
            "subjective": len(deduped_sub),
            "single": sum(1 for x in objective if x["type"] == "single"),
            "multi": sum(1 for x in objective if x["type"] == "multi"),
            "judge": sum(1 for x in objective if x["type"] == "judge"),
            "short": sum(1 for x in deduped_sub if x["type"] == "short"),
            "essay": sum(1 for x in deduped_sub if x["type"] == "essay"),
        },
        "objective": objective,
        "subjective": deduped_sub,
    }


def main():
    raw = MD.read_text(encoding="utf-8")
    data = parse_md(raw)
    for sec in data["sections"]:
        sec["knowledgeHtml"] = wrap_lists(sec["knowledge"])
        for q in sec["questions"]:
            q["titleHtml"] = md_inline(q["title"])
            q["memoHtml"] = wrap_lists(q["memo"])
            q["answerHtml"] = wrap_lists(q["answer"])

    OUT.write_text("window.STUDY_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")

    quiz = build_quiz_data(data)
    QUIZ_OUT.write_text("window.QUIZ_DATA = " + json.dumps(quiz, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")

    s = quiz["stats"]
    print(f"OK {OUT.name} sections={len(data['sections'])} refined_q={sum(len(x['questions']) for x in data['sections'])}")
    print(
        f"OK {QUIZ_OUT.name} objective={s['objective']} "
        f"(单{s['single']}/多{s['multi']}/判{s['judge']}) subjective={s['subjective']} "
        f"(简{s['short']}/论{s['essay']})"
    )


if __name__ == "__main__":
    main()
