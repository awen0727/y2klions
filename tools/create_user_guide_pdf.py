from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
import os


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT = os.path.join(ROOT, "output", "pdf", "y2k-lions-user-guide.pdf")
QR_PATH = "/Users/chriswang/Downloads/y2k-login.png"
LOGO_PATH = os.path.join(ROOT, "assets", "y2k-logo.png")
SITE_URL = "https://awen0727.github.io/y2klions/"


def register_fonts():
    candidates = [
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/STHeiti Medium.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont("Y2KFont", path))
            return "Y2KFont"
    return "Helvetica"


FONT = register_fonts()


def p(text, style):
    return Paragraph(text, style)


def bullets(items, style):
    return ListFlowable(
        [ListItem(Paragraph(item, style), leftIndent=8) for item in items],
        bulletType="bullet",
        leftIndent=14,
        bulletFontName=FONT,
        bulletFontSize=8,
    )


def numbered(items, style):
    return ListFlowable(
        [ListItem(Paragraph(item, style), leftIndent=10) for item in items],
        bulletType="1",
        leftIndent=16,
        bulletFontName=FONT,
        bulletFontSize=9,
    )


def section(title, subtitle=None):
    story = [Spacer(1, 7 * mm), p(title, STYLES["section"])]
    if subtitle:
        story.append(p(subtitle, STYLES["muted"]))
    story.append(Spacer(1, 3 * mm))
    return story


def data_table(headers, rows, widths=None):
    data = [[p(cell, STYLES["tableHeader"]) for cell in headers]]
    for row in rows:
        data.append([p(cell, STYLES["tableCell"]) for cell in row])
    table = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#163F73")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E2EE")),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FBFCFE")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def cover_block():
    logo = Image(LOGO_PATH, width=36 * mm, height=36 * mm)
    logo.hAlign = "CENTER"
    qr = Image(QR_PATH, width=42 * mm, height=42 * mm)
    qr.hAlign = "CENTER"
    link_box = Table(
        [
            [
                logo,
                [
                    p("千禧獅子會活動系統", STYLES["coverTitle"]),
                    p("會員端與後台管理者端使用說明", STYLES["coverSubtitle"]),
                    p("第三專區第五分區｜正式版操作文件｜2026/06/30", STYLES["muted"]),
                ],
                qr,
            ]
        ],
        colWidths=[42 * mm, 100 * mm, 42 * mm],
    )
    link_box.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F9FC")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#D5A83E")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    return [
        Spacer(1, 16 * mm),
        link_box,
        Spacer(1, 8 * mm),
        p("入口網址", STYLES["smallTitle"]),
        p(SITE_URL, STYLES["link"]),
        p("請使用手機掃描右上 QR Code，或直接開啟入口網址。若從 LINE 內開啟，系統會取得 LINE 身分並進行會員綁定。", STYLES["body"]),
        Spacer(1, 6 * mm),
        data_table(
            ["使用對象", "主要功能"],
            [
                ["一般會員", "第一次綁定、活動報名、活動期間簽到、查看個人活動紀錄與會員資料。"],
                ["後台管理者", "會員管理、活動管理、報名與簽到管理、出席查詢、即時看板、Excel 匯出與操作紀錄。"],
            ],
            [35 * mm, 135 * mm],
        ),
    ]


def build_story():
    story = []
    story.extend(cover_block())

    story.extend(section("一、系統入口與第一次使用"))
    story.append(
        data_table(
            ["項目", "說明"],
            [
                ["入口網站", SITE_URL],
                ["QR Code", "掃描本文件首頁 QR Code 可開啟入口網站。"],
                ["建議開啟方式", "會員建議從 LINE 內開啟；後台管理者可用手機或電腦瀏覽器開啟。"],
                ["身分綁定", "第一次使用時，會員輸入會員主檔中行動電話的末四碼，系統確認後將目前 LINE User ID 綁定到會員資料。"],
            ],
            [36 * mm, 134 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("第一次綁定流程", STYLES["smallTitle"]))
    story.append(
        numbered(
            [
                "使用手機掃描 QR Code 或開啟入口網址。",
                "若系統要求 LINE 登入，請依畫面完成 LINE 授權。",
                "在「第一次使用，請先綁定會員」區塊輸入會員主檔中行動電話的末四碼。",
                "確認 LINE 顯示名稱後，按「查詢並綁定」。",
                "綁定成功後，之後再次開啟會直接進入會員首頁，不需要重複輸入末四碼。",
            ],
            STYLES["body"],
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(
        p(
            "注意：系統綁定依據是 LINE User ID，不是 LINE 顯示名稱。會員日後更改 LINE 名稱，不會影響已完成的綁定。",
            STYLES["note"],
        )
    )

    story.extend(section("二、會員端功能說明"))
    story.append(
        data_table(
            ["畫面", "用途", "操作說明"],
            [
                ["目前活動", "查看開放中的活動。", "活動開始前可報名；活動期間可簽到。若活動已結束或尚未開放，按鈕會依規則隱藏。"],
                ["我要報名", "活動前報名。", "按「我要報名」，輸入同行人數與備註。報名後可在活動卡看到狀態。"],
                ["取消報名", "活動開始前取消。", "若仍在報名期間，可按「取消報名」。活動開始後不可取消報名。"],
                ["我要簽到", "活動期間簽到。", "活動時間內顯示簽到按鈕。簽到成功後，狀態會顯示「已簽到」。"],
                ["我的紀錄", "查看個人活動紀錄。", "同一活動會合併顯示報名狀態、同行人數、簽到狀態與簽到方式。"],
                ["會員資料", "查看會員主檔。", "可查看姓名、會員編號、手機遮蔽、會員狀態、年度職位與 LINE 綁定狀態。"],
            ],
            [25 * mm, 35 * mm, 110 * mm],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(p("會員端常見情境", STYLES["smallTitle"]))
    story.append(
        bullets(
            [
                "看不到報名按鈕：活動可能未開放報名，或活動已開始。",
                "看不到簽到按鈕：活動可能尚未開始、已結束，或未開放簽到。",
                "顯示會員狀態不可使用：會員主檔狀態可能不是「有效」或「系統管理員」，請聯絡管理者。",
                "手機末四碼查無資料：請確認輸入的是會員主檔中行動電話的末四碼，或請管理者檢查會員資料。",
                "手機末四碼對應多位會員：請管理者協助確認會員身分後處理，避免綁錯 LINE 帳號。",
                "LINE 帳號已綁定其他會員：請管理者在後台解除錯誤綁定後，再重新綁定。",
            ],
            STYLES["body"],
        )
    )

    story.append(PageBreak())
    story.extend(section("三、後台管理者端登入與總覽"))
    story.append(
        data_table(
            ["項目", "說明"],
            [
                ["後台入口", "入口網站右上或會員頁中的「管理後台」。也可直接開啟 admin.html。"],
                ["登入方式", "使用管理者帳號與密碼登入。系統會記錄登入、登出與重要操作。"],
                ["總覽指標", "會員總數、已綁定 LINE、開放活動、有效報名、已簽到。"],
                ["檢查連線", "按「檢查連線」可確認前端目前是否連到 Apps Script API。"],
                ["變更密碼", "登入後可按「變更密碼」，新密碼至少 8 碼。"],
            ],
            [34 * mm, 136 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("後台分頁總覽", STYLES["smallTitle"]))
    story.append(
        data_table(
            ["分頁", "用途"],
            [
                ["總覽", "快速查看所有活動的報名、同行、預估總人數、簽到數與開放狀態。"],
                ["會員管理", "新增、編輯會員，解除 LINE 綁定，匯出會員 Excel，查看個人出席狀況。"],
                ["活動管理", "新增、編輯、刪除活動，開啟即時看板，單一活動匯出 Excel。"],
                ["報名管理", "依活動查看報名名單、取消名單、同行人數與備註。"],
                ["簽到管理", "後台補簽到、查看已報名未簽到與未報名已簽到。"],
                ["出席查詢", "依活動、狀態、姓名、手機、職位查詢出席狀況。"],
                ["操作紀錄", "查看最近操作紀錄，包含登入、會員變更、活動變更、刪除與簽到操作。"],
            ],
            [32 * mm, 138 * mm],
        )
    )

    story.extend(section("四、會員管理"))
    story.append(
        data_table(
            ["功能", "操作方式", "注意事項"],
            [
                ["新增會員", "填寫會員編號、姓名、手機、會員狀態、生日、年度職位，按「儲存會員」。", "會員編號不可重複。手機末四碼會作為會員第一次綁定 LINE 的驗證依據。"],
                ["編輯會員", "在會員卡按「編輯」，資料會帶入上方表單，修改後按「儲存會員」。", "修改手機會影響未綁定會員的末四碼認證。已綁定會員仍以 LINE User ID 辨識。"],
                ["解除 LINE 綁定", "系統管理員可按「解除 LINE 綁定」。", "解除後會員下次需重新用行動電話末四碼綁定。"],
                ["匯出 Excel", "會員清單右上按「匯出 Excel」。", "匯出內容包含會員編號、姓名、手機、狀態、年度職位、生日與 LINE 綁定資訊。"],
                ["出席紀錄", "在會員卡按「出席紀錄」。", "可查看該會員有效報名、簽到、取消報名與各活動明細。"],
            ],
            [29 * mm, 73 * mm, 68 * mm],
        )
    )

    story.extend(section("五、活動管理"))
    story.append(
        data_table(
            ["功能", "操作方式", "注意事項"],
            [
                ["新增活動", "填寫活動名稱、日期、開始時間、結束時間、地點、狀態與開放設定，按「儲存活動」。", "日期與時間會影響會員端報名/簽到按鈕顯示。"],
                ["編輯活動", "在活動清單按「編輯」，修改後按「儲存活動」。", "已存在報名或簽到的活動仍可改名稱、地點、時間，但應先確認是否影響現場作業。"],
                ["刪除活動", "在活動清單按「刪除」。若已有報名或簽到，系統會再次確認。", "刪除活動會一併刪除該活動的報名與簽到紀錄，請只在建立錯誤時使用。"],
                ["即時看板", "在活動清單按「即時看板」。", "可投影現場報名數、同行數、預估總人數與已簽到名單。"],
                ["匯出 Excel", "在活動清單按「匯出 Excel」。", "針對單一活動匯出出席報表，包含報名與簽到狀態。"],
            ],
            [29 * mm, 73 * mm, 68 * mm],
        )
    )

    story.append(PageBreak())
    story.extend(section("六、報名、簽到與出席查詢"))
    story.append(
        data_table(
            ["管理項目", "用途", "操作重點"],
            [
                ["報名管理", "查看單一活動的報名與取消紀錄。", "可確認同行人數、報名時間、取消時間與會員備註。"],
                ["後台補簽到", "會員無法自行簽到時，由管理者補登。", "選擇活動與會員，可輸入備註，例如現場確認出席。"],
                ["簽到比對", "確認報名與簽到落差。", "系統會統計已報名且已簽到、已報名未簽到、未報名已簽到與總簽到。"],
                ["出席查詢", "依條件查找名單。", "可用活動、出席狀態、姓名、手機、會員編號或年度職位篩選。"],
                ["操作紀錄", "追蹤重要操作。", "用於查詢誰進行登入、修改、刪除、補簽到或解除綁定。"],
            ],
            [33 * mm, 50 * mm, 87 * mm],
        )
    )
    story.append(Spacer(1, 5 * mm))
    story.append(p("出席狀態說明", STYLES["smallTitle"]))
    story.append(
        data_table(
            ["狀態", "代表意義"],
            [
                ["已簽到", "該會員已完成該活動簽到。"],
                ["已報名未簽到", "該會員有有效報名，但尚未完成簽到。"],
                ["未報名已簽到", "該會員未報名但現場有簽到，通常是臨時出席。"],
                ["未簽到", "在查詢條件中未找到該會員簽到紀錄。"],
            ],
            [42 * mm, 128 * mm],
        )
    )

    story.extend(section("七、資料與安全注意事項"))
    story.append(
        bullets(
            [
                "GitHub Pages 只放前端網頁，不放會員名單、密碼或 Google Sheet 資料。",
                "會員資料、活動資料、報名與簽到紀錄存放在 Google Sheet，透過 Apps Script API 存取。",
                "後台需帳號密碼登入，登入 session 有有效期限。",
                "會員綁定依 LINE User ID 判斷，LINE 顯示名稱只作為顯示參考。",
                "刪除活動會刪除該活動的報名與簽到紀錄，建議只用於建立錯誤的活動。",
                "匯出的 Excel 可能含會員手機與 LINE 綁定資訊，請勿轉傳給不相關人員。",
                "若時間顯示不正確，請檢查 Google Sheet 活動日期、開始時間、結束時間欄位格式，以及 Apps Script 是否已部署最新版。",
            ],
            STYLES["body"],
        )
    )

    story.extend(section("八、快速檢查清單"))
    story.append(
        data_table(
            ["情境", "先檢查"],
            [
                ["會員無法綁定", "會員主檔手機末四碼是否正確、會員狀態是否有效、LINE 帳號是否已綁定其他會員、末四碼是否對應多位會員。"],
                ["會員不能報名", "活動是否開放、是否在活動開始前、是否勾選開放報名。"],
                ["會員不能簽到", "是否在活動開始與結束時間內、是否勾選開放簽到。"],
                ["後台資料沒更新", "是否重新整理頁面、Apps Script 是否重新部署、前端 config 是否指向最新 URL。"],
                ["看板打不開", "活動是否存在、display token 是否與 Settings 的 DISPLAY_TOKEN 一致。"],
            ],
            [44 * mm, 126 * mm],
        )
    )
    story.append(Spacer(1, 8 * mm))
    story.append(p("文件結束", STYLES["smallTitle"]))
    story.append(p("本文件可提供給會員、幹部與後台管理者作為日常操作說明。", STYLES["body"]))
    return story


def on_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(colors.HexColor("#163F73"))
    canvas.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont(FONT, 8)
    canvas.drawString(15 * mm, height - 8 * mm, "千禧獅子會活動系統 使用說明")
    canvas.drawRightString(width - 15 * mm, height - 8 * mm, f"Page {doc.page}")
    canvas.setFillColor(colors.HexColor("#667085"))
    canvas.setFont(FONT, 8)
    canvas.drawString(15 * mm, 10 * mm, SITE_URL)
    canvas.restoreState()


def build_pdf():
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title="千禧獅子會活動系統使用說明",
        author="千禧獅子會",
    )
    doc.build(build_story(), onFirstPage=on_page, onLaterPages=on_page)
    return OUTPUT


BASE = getSampleStyleSheet()
STYLES = {
    "coverTitle": ParagraphStyle(
        "coverTitle",
        fontName=FONT,
        fontSize=22,
        leading=28,
        textColor=colors.HexColor("#0B2B52"),
        alignment=TA_LEFT,
        spaceAfter=4,
    ),
    "coverSubtitle": ParagraphStyle(
        "coverSubtitle",
        fontName=FONT,
        fontSize=13,
        leading=18,
        textColor=colors.HexColor("#163F73"),
        alignment=TA_LEFT,
        spaceAfter=5,
    ),
    "section": ParagraphStyle(
        "section",
        fontName=FONT,
        fontSize=15,
        leading=21,
        textColor=colors.HexColor("#0B2B52"),
        borderWidth=0,
        borderPadding=0,
        spaceAfter=4,
    ),
    "smallTitle": ParagraphStyle(
        "smallTitle",
        fontName=FONT,
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#163F73"),
        spaceBefore=4,
        spaceAfter=3,
    ),
    "body": ParagraphStyle(
        "body",
        fontName=FONT,
        fontSize=9.3,
        leading=14,
        textColor=colors.HexColor("#172033"),
        alignment=TA_LEFT,
    ),
    "muted": ParagraphStyle(
        "muted",
        fontName=FONT,
        fontSize=8.6,
        leading=13,
        textColor=colors.HexColor("#667085"),
    ),
    "link": ParagraphStyle(
        "link",
        fontName=FONT,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#163F73"),
    ),
    "note": ParagraphStyle(
        "note",
        fontName=FONT,
        fontSize=9.2,
        leading=14,
        textColor=colors.HexColor("#7A4A00"),
        backColor=colors.HexColor("#FFF3DC"),
        borderColor=colors.HexColor("#D5A83E"),
        borderWidth=0.5,
        borderPadding=7,
        spaceBefore=4,
        spaceAfter=4,
    ),
    "tableHeader": ParagraphStyle(
        "tableHeader",
        fontName=FONT,
        fontSize=8.4,
        leading=11,
        textColor=colors.white,
        alignment=TA_CENTER,
    ),
    "tableCell": ParagraphStyle(
        "tableCell",
        fontName=FONT,
        fontSize=8.2,
        leading=11.3,
        textColor=colors.HexColor("#172033"),
    ),
}


if __name__ == "__main__":
    print(build_pdf())
