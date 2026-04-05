import re


def parse_indicators(raw_text: str) -> dict:
    """從 Dify 的 ticker 字串解析出數值指標。"""
    patterns = {
        "price":     r"當前價[:：]\s*([\d.]+)",
        "rsi":       r"RSI[:：]\s*([\d.]+)",
        "ma5":       r"MA5[:：]\s*([\d.]+)",
        "k":         r"K值[:：]\s*([\d.]+)",
        "d":         r"D值[:：]\s*([\d.]+)",
        "macd":      r"MACD[:：]\s*([-\d.]+)",
        "signal":    r"Signal[:：]\s*([-\d.]+)",
        "histogram": r"Histogram[:：]\s*([-\d.]+)",
        "trend":     r"趨勢[:：]\s*(\S+)",
    }
    result = {}
    for key, pattern in patterns.items():
        m = re.search(pattern, raw_text)
        if m:
            val = m.group(1)
            try:
                result[key] = float(val)
            except ValueError:
                result[key] = val  # trend 是字串
    return result


def generate_commentary(raw_text: str, ticker_code: str | None = None) -> str:
    """根據技術指標生成中文評語。"""
    ind = parse_indicators(raw_text)
    if not ind:
        return "技術指標資料不足，無法產生評語。"

    name = ticker_code or "該股票"
    parts = []

    # --- 趨勢 ---
    trend = ind.get("trend", "")
    if "多頭" in str(trend):
        parts.append(f"{name} 目前處於**多頭趨勢**，整體偏強。")
    elif "空頭" in str(trend):
        parts.append(f"{name} 目前處於**空頭趨勢**，整體偏弱。")

    # --- RSI 超買超賣 ---
    rsi = ind.get("rsi")
    if rsi is not None:
        if rsi >= 70:
            parts.append(f"RSI {rsi:.1f} 進入**超買區（≥70）**，短線有拉回壓力。")
        elif rsi <= 30:
            parts.append(f"RSI {rsi:.1f} 進入**超賣區（≤30）**，存在技術性反彈機會。")
        else:
            parts.append(f"RSI {rsi:.1f} 位於中性區間，動能尚未明確。")

    # --- KD 交叉訊號 ---
    k = ind.get("k")
    d = ind.get("d")
    if k is not None and d is not None:
        if k > d and k < 50:
            parts.append(f"KD 出現黃金交叉（K={k:.1f} > D={d:.1f}），低檔偏多訊號。")
        elif k < d and k > 50:
            parts.append(f"KD 出現死亡交叉（K={k:.1f} < D={d:.1f}），高檔偏空訊號。")
        elif k >= 80:
            parts.append(f"KD K值 {k:.1f} 偏高，短線留意過熱風險。")
        elif k <= 20:
            parts.append(f"KD K值 {k:.1f} 偏低，處於低檔整理區。")

    # --- MACD 動能 ---
    histogram = ind.get("histogram")
    macd = ind.get("macd")
    signal = ind.get("signal")
    if histogram is not None:
        if histogram > 0:
            parts.append(f"MACD 柱狀體為正（{histogram:.2f}），短期動能**偏多**。")
        elif histogram < 0:
            parts.append(f"MACD 柱狀體為負（{histogram:.2f}），短期動能**偏空**。")

    if macd is not None and signal is not None:
        if macd > signal:
            parts.append("MACD 線在訊號線之上，多方佔優。")
        else:
            parts.append("MACD 線在訊號線之下，空方佔優。")

    # --- 均線比較 ---
    price = ind.get("price")
    ma5 = ind.get("ma5")
    if price is not None and ma5 is not None:
        if price > ma5:
            parts.append(f"股價（{price}）站上 MA5（{ma5}），短線偏多。")
        else:
            parts.append(f"股價（{price}）跌破 MA5（{ma5}），短線偏弱。")

    # --- 綜合結論 ---
    bullish = sum(1 for p in parts if any(w in p for w in ["多頭", "偏多", "黃金交叉", "反彈", "站上"]))
    bearish = sum(1 for p in parts if any(w in p for w in ["空頭", "偏空", "死亡交叉", "拉回", "跌破"]))

    if bullish > bearish:
        conclusion = f"綜合來看，{name} 短線技術面偏多，但仍需留意量能配合。"
    elif bearish > bullish:
        conclusion = f"綜合來看，{name} 短線技術面偏弱，建議觀望或設好停損。"
    else:
        conclusion = f"綜合來看，{name} 技術面多空交錯，建議等待方向明朗。"

    parts.append(conclusion)
    return "\n".join(parts)
