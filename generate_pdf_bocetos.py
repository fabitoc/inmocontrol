import sys
import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Group, Circle, Polygon

def create_wireframe_dashboard(w=700, h=380):
    d = Drawing(w, h)
    
    # Outer Frame / App Window
    d.add(Rect(0, 0, w, h, fillColor=colors.HexColor("#F8FAFC"), strokeColor=colors.HexColor("#CBD5E1"), strokeWidth=1, rx=6, ry=6))
    
    # Header
    d.add(Rect(0, h - 45, w, 45, fillColor=colors.HexColor("#1E293B"), strokeColor=None))
    d.add(String(20, h - 28, "InmoControl", fontName="Helvetica-Bold", fontSize=16, fillColor=colors.white))
    d.add(String(130, h - 26, "|   Dashboard Principal - Resumen Financiero y KPIs", fontName="Helvetica", fontSize=11, fillColor=colors.HexColor("#94A3B8")))
    d.add(Rect(w - 110, h - 33, 95, 22, fillColor=colors.HexColor("#2563EB"), strokeColor=None, rx=4, ry=4))
    d.add(String(w - 100, h - 26, "+ Transacción", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.white))
    
    # Sidebar
    sb_w = 140
    d.add(Rect(0, 0, sb_w, h - 45, fillColor=colors.HexColor("#0F172A"), strokeColor=None))
    
    tabs = [
        ("Dashboard", True),
        ("Finanzas", False),
        ("Arrendadores", False),
        ("Propiedades", False),
        ("Arrendatarios", False),
        ("Configuración", False)
    ]
    
    y_tab = h - 75
    for title, active in tabs:
        if active:
            d.add(Rect(5, y_tab - 5, sb_w - 10, 26, fillColor=colors.HexColor("#2563EB"), strokeColor=None, rx=4, ry=4))
            d.add(String(18, y_tab + 3, title, fontName="Helvetica-Bold", fontSize=10, fillColor=colors.white))
        else:
            d.add(String(18, y_tab + 3, title, fontName="Helvetica", fontSize=10, fillColor=colors.HexColor("#94A3B8")))
        y_tab -= 34
        
    # Main Content Area
    cx = sb_w + 15
    cy = h - 60
    cw = w - sb_w - 30
    
    # KPI Cards Row (4 cards)
    card_w = (cw - 30) / 4
    card_h = 65
    
    kpis = [
        ("Recaudación Mes", "$ 12,450.00", "+8.5% vs mes ant.", "#3B82F6"),
        ("Comisión Agencia", "$ 1,245.00", "10% promedio", "#10B981"),
        ("Alertas de Mora", "2 Inquilinos", " $ 1,800.00 pend.", "#EF4444"),
        ("Cánones Cobrados", "14 / 16", "87.5% efectividad", "#F59E0B")
    ]
    
    for i, (k_title, k_val, k_sub, k_color) in enumerate(kpis):
        kx = cx + i * (card_w + 10)
        ky = cy - card_h
        d.add(Rect(kx, ky, card_w, card_h, fillColor=colors.white, strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1, rx=5, ry=5))
        # Top color accent bar
        d.add(Rect(kx, ky + card_h - 4, card_w, 4, fillColor=colors.HexColor(k_color), strokeColor=None, rx=2, ry=2))
        d.add(String(kx + 10, ky + card_h - 18, k_title, fontName="Helvetica-Bold", fontSize=9, fillColor=colors.HexColor("#64748B")))
        d.add(String(kx + 10, ky + 24, k_val, fontName="Helvetica-Bold", fontSize=12, fillColor=colors.HexColor("#0F172A")))
        d.add(String(kx + 10, ky + 9, k_sub, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#94A3B8")))
        
    # Table Area: Estado de Cánones / Alertas de Mora
    ty = cy - card_h - 20
    th = 190
    d.add(Rect(cx, ty - th, cw, th, fillColor=colors.white, strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1, rx=5, ry=5))
    
    # Table Title Header
    d.add(String(cx + 15, ty - 22, "Estado de Pagos del Mes Actual", fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#1E293B")))
    d.add(String(cx + cw - 120, ty - 22, "Filtro: Todos los inmuebles", fontName="Helvetica", fontSize=9, fillColor=colors.HexColor("#64748B")))
    d.add(Line(cx, ty - 32, cx + cw, ty - 32, strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1))
    
    # Table Column Headers
    headers = ["Propiedad / Dirección", "Arrendatario", "Vencimiento", "Canon ($)", "Estado", "Acción"]
    col_widths = [140, 110, 80, 75, 75, 50]
    
    hx = cx + 15
    hy = ty - 46
    for idx, head in enumerate(headers):
        d.add(String(hx, hy, head, fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#475569")))
        hx += col_widths[idx]
        
    d.add(Line(cx + 10, ty - 52, cx + cw - 10, ty - 52, strokeColor=colors.HexColor("#F1F5F9"), strokeWidth=1))
    
    # Table Rows
    rows_data = [
        ("Av. 18 de Julio 1420 - Apt 502", "Juan Pérez", "05/08/2026", "$ 850.00", "PAGADO", "#10B981"),
        ("Bulevar Artigas 890", "María Rodríguez", "10/08/2026", "$ 1,200.00", "PENDIENTE", "#F59E0B"),
        ("Calle Canelones 2105 - Local 1", "Carlos Gómez", "01/08/2026", "$ 950.00", "EN MORA", "#EF4444"),
        ("Av. Rivera 3400 - Apt 201", "Lucía Fernández", "05/08/2026", "$ 780.00", "PAGADO", "#10B981"),
    ]
    
    ry = ty - 68
    for r_prop, r_tenant, r_date, r_val, r_st, r_stcolor in rows_data:
        rx = cx + 15
        d.add(String(rx, ry, r_prop, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#1E293B")))
        rx += col_widths[0]
        d.add(String(rx, ry, r_tenant, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#334155")))
        rx += col_widths[1]
        d.add(String(rx, ry, r_date, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#64748B")))
        rx += col_widths[2]
        d.add(String(rx, ry, r_val, fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#0F172A")))
        rx += col_widths[3]
        
        # Badge
        d.add(Rect(rx - 2, ry - 3, 62, 14, fillColor=colors.HexColor(r_stcolor), strokeColor=None, rx=3, ry=3))
        d.add(String(rx + 4, ry + 1, r_st, fontName="Helvetica-Bold", fontSize=7, fillColor=colors.white))
        rx += col_widths[4]
        
        d.add(String(rx, ry, "[ Ver ]", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#2563EB")))
        
        ry -= 26
        d.add(Line(cx + 10, ry + 16, cx + cw - 10, ry + 16, strokeColor=colors.HexColor("#F8FAFC"), strokeWidth=1))
        
    return d

def create_wireframe_admin(w=700, h=380):
    d = Drawing(w, h)
    
    # Outer Frame
    d.add(Rect(0, 0, w, h, fillColor=colors.HexColor("#F8FAFC"), strokeColor=colors.HexColor("#CBD5E1"), strokeWidth=1, rx=6, ry=6))
    
    # Header
    d.add(Rect(0, h - 45, w, 45, fillColor=colors.HexColor("#1E293B"), strokeColor=None))
    d.add(String(20, h - 28, "InmoControl", fontName="Helvetica-Bold", fontSize=16, fillColor=colors.white))
    d.add(String(130, h - 26, "|   Administración Financiera & Liquidaciones", fontName="Helvetica", fontSize=11, fillColor=colors.HexColor("#94A3B8")))
    
    # Sidebar
    sb_w = 140
    d.add(Rect(0, 0, sb_w, h - 45, fillColor=colors.HexColor("#0F172A"), strokeColor=None))
    
    tabs = [
        ("Dashboard", False),
        ("Finanzas", True),
        ("Arrendadores", False),
        ("Propiedades", False),
        ("Arrendatarios", False),
        ("Configuración", False)
    ]
    
    y_tab = h - 75
    for title, active in tabs:
        if active:
            d.add(Rect(5, y_tab - 5, sb_w - 10, 26, fillColor=colors.HexColor("#2563EB"), strokeColor=None, rx=4, ry=4))
            d.add(String(18, y_tab + 3, title, fontName="Helvetica-Bold", fontSize=10, fillColor=colors.white))
        else:
            d.add(String(18, y_tab + 3, title, fontName="Helvetica", fontSize=10, fillColor=colors.HexColor("#94A3B8")))
        y_tab -= 34
        
    cx = sb_w + 15
    cy = h - 60
    cw = w - sb_w - 30
    
    # Action Toolbar
    d.add(Rect(cx, cy - 35, cw, 35, fillColor=colors.white, strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1, rx=4, ry=4))
    d.add(String(cx + 12, cy - 22, "Movimientos Financieros", fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#1E293B")))
    
    # Filter buttons & Actions
    d.add(Rect(cx + cw - 260, cy - 28, 75, 20, fillColor=colors.HexColor("#F1F5F9"), strokeColor=colors.HexColor("#CBD5E1"), rx=3, ry=3))
    d.add(String(cx + cw - 250, cy - 22, "Filtro: Todos", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#475569")))
    
    d.add(Rect(cx + cw - 175, cy - 28, 80, 20, fillColor=colors.HexColor("#10B981"), strokeColor=None, rx=3, ry=3))
    d.add(String(cx + cw - 168, cy - 22, "+ Reg. Ingreso", fontName="Helvetica-Bold", fontSize=8, fillColor=colors.white))
    
    d.add(Rect(cx + cw - 88, cy - 28, 80, 20, fillColor=colors.HexColor("#6366F1"), strokeColor=None, rx=3, ry=3))
    d.add(String(cx + cw - 82, cy - 22, "⚡ Liquidación", fontName="Helvetica-Bold", fontSize=8, fillColor=colors.white))
    
    # Transactions Table (Left side - 60% width)
    t_w = cw * 0.58
    t_h = 220
    ty = cy - 45
    d.add(Rect(cx, ty - t_h, t_w, t_h, fillColor=colors.white, strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1, rx=4, ry=4))
    
    d.add(String(cx + 10, ty - 18, "Registro de Transacciones", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.HexColor("#334155")))
    d.add(Line(cx, ty - 25, cx + t_w, ty - 25, strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1))
    
    t_headers = ["Fecha", "Tipo", "Concepto", "Monto ($)"]
    t_cols = [60, 55, 120, 55]
    thx = cx + 10
    thy = ty - 38
    for idx, th in enumerate(t_headers):
        d.add(String(thx, thy, th, fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#64748B")))
        thx += t_cols[idx]
        
    d.add(Line(cx + 5, ty - 43, cx + t_w - 5, ty - 43, strokeColor=colors.HexColor("#F1F5F9"), strokeWidth=1))
    
    tx_data = [
        ("02/08", "INGRESO", "Cobro Arriendo Apt 502", "+ $850.00", "#10B981"),
        ("02/08", "GASTO", "Reparación Grifería Apt 502", "- $45.00", "#EF4444"),
        ("01/08", "INGRESO", "Cobro Arriendo Local 1", "+ $950.00", "#10B981"),
        ("28/07", "INGRESO", "Cobro Arriendo Apt 201", "+ $780.00", "#10B981"),
        ("25/07", "GASTO", "Mantenimiento Ascensor", "- $120.00", "#EF4444"),
    ]
    
    try_y = ty - 56
    for t_date, t_type, t_desc, t_amt, t_color in tx_data:
        trx = cx + 10
        d.add(String(trx, try_y, t_date, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#64748B")))
        trx += t_cols[0]
        
        d.add(Rect(trx - 2, try_y - 2, 45, 12, fillColor=colors.HexColor(t_color), strokeColor=None, rx=2, ry=2))
        d.add(String(trx + 2, try_y + 1, t_type, fontName="Helvetica-Bold", fontSize=7, fillColor=colors.white))
        trx += t_cols[1]
        
        d.add(String(trx, try_y, t_desc, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#1E293B")))
        trx += t_cols[2]
        
        d.add(String(trx, try_y, t_amt, fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor(t_color)))
        
        try_y -= 24
        d.add(Line(cx + 5, try_y + 15, cx + t_w - 5, try_y + 15, strokeColor=colors.HexColor("#F8FAFC"), strokeWidth=1))

    # Settlement Modal / Panel Mockup (Right side - 40% width)
    s_x = cx + t_w + 12
    s_w = cw - t_w - 12
    d.add(Rect(s_x, ty - t_h, s_w, t_h, fillColor=colors.white, strokeColor=colors.HexColor("#6366F1"), strokeWidth=1.5, rx=6, ry=6))
    
    # Modal Header
    d.add(Rect(s_x, ty - 30, s_w, 30, fillColor=colors.HexColor("#EEF2FF"), strokeColor=None, rx=4, ry=4))
    d.add(String(s_x + 10, ty - 20, "⚡ Generar Liquidación Neta", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.HexColor("#4338CA")))
    
    sy = ty - 48
    d.add(String(s_x + 10, sy, "Seleccionar Arrendador:", fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#374151")))
    sy -= 18
    d.add(Rect(s_x + 10, sy - 4, s_w - 20, 20, fillColor=colors.HexColor("#F9FAFB"), strokeColor=colors.HexColor("#D1D5DB"), rx=3, ry=3))
    d.add(String(s_x + 16, sy + 2, "Roberto Silva (CI 1.234.567-8)", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#111827")))
    
    sy -= 25
    d.add(Rect(s_x + 10, sy - 65, s_w - 20, 65, fillColor=colors.HexColor("#F8FAFC"), strokeColor=colors.HexColor("#E2E8F0"), rx=4, ry=4))
    d.add(String(s_x + 18, sy - 15, "(+) Total Cánones Cobrados:  $ 1,700.00", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#16A34A")))
    d.add(String(s_x + 18, sy - 30, "(-) Comisión Agencia (10%):     - $ 170.00", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#DC2626")))
    d.add(String(s_x + 18, sy - 45, "(-) Gastos Mantenimiento:       - $ 45.00", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#DC2626")))
    d.add(Line(s_x + 18, sy - 50, s_x + s_w - 28, sy - 50, strokeColor=colors.HexColor("#CBD5E1")))
    d.add(String(s_x + 18, sy - 61, "(=) LIQUIDACIÓN NETA:        $ 1,485.00", fontName="Helvetica-Bold", fontSize=9, fillColor=colors.HexColor("#1E1B4B")))
    
    sy -= 80
    d.add(String(s_x + 10, sy, "Banco Destino: Itaú Cta. 987654", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#6B7280")))
    sy -= 22
    d.add(Rect(s_x + 10, sy - 5, s_w - 20, 24, fillColor=colors.HexColor("#4F46E5"), strokeColor=None, rx=4, ry=4))
    d.add(String(s_x + 25, sy + 3, "Confirmar & Emitir PDF Liquidación", fontName="Helvetica-Bold", fontSize=8, fillColor=colors.white))
    
    return d

def create_wireframe_entities(w=700, h=380):
    d = Drawing(w, h)
    
    # Outer Frame
    d.add(Rect(0, 0, w, h, fillColor=colors.HexColor("#F8FAFC"), strokeColor=colors.HexColor("#CBD5E1"), strokeWidth=1, rx=6, ry=6))
    
    # Header
    d.add(Rect(0, h - 45, w, 45, fillColor=colors.HexColor("#1E293B"), strokeColor=None))
    d.add(String(20, h - 28, "InmoControl", fontName="Helvetica-Bold", fontSize=16, fillColor=colors.white))
    d.add(String(130, h - 26, "|   Gestión de Propiedades y Propietarios", fontName="Helvetica", fontSize=11, fillColor=colors.HexColor("#94A3B8")))
    
    # Sidebar
    sb_w = 140
    d.add(Rect(0, 0, sb_w, h - 45, fillColor=colors.HexColor("#0F172A"), strokeColor=None))
    
    tabs = [
        ("Dashboard", False),
        ("Finanzas", False),
        ("Arrendadores", False),
        ("Propiedades", True),
        ("Arrendatarios", False),
        ("Configuración", False)
    ]
    
    y_tab = h - 75
    for title, active in tabs:
        if active:
            d.add(Rect(5, y_tab - 5, sb_w - 10, 26, fillColor=colors.HexColor("#2563EB"), strokeColor=None, rx=4, ry=4))
            d.add(String(18, y_tab + 3, title, fontName="Helvetica-Bold", fontSize=10, fillColor=colors.white))
        else:
            d.add(String(18, y_tab + 3, title, fontName="Helvetica", fontSize=10, fillColor=colors.HexColor("#94A3B8")))
        y_tab -= 34
        
    cx = sb_w + 15
    cy = h - 60
    cw = w - sb_w - 30
    
    # Entity Sub-Tabs Bar
    d.add(Rect(cx, cy - 30, cw, 30, fillColor=colors.white, strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=1, rx=4, ry=4))
    
    subtabs = ["Arrendadores (Propietarios)", "Propiedades (Inmuebles)", "Arrendatarios (Inquilinos)"]
    st_x = cx + 10
    for idx, st_name in enumerate(subtabs):
        if idx == 1: # Active: Propiedades
            d.add(Rect(st_x, cy - 25, 140, 20, fillColor=colors.HexColor("#2563EB"), strokeColor=None, rx=3, ry=3))
            d.add(String(st_x + 12, cy - 18, st_name, fontName="Helvetica-Bold", fontSize=8, fillColor=colors.white))
            st_x += 145
        else:
            d.add(String(st_x + 8, cy - 18, st_name, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#64748B")))
            st_x += 140
            
    # Form Modal & Table Layout
    fy = cy - 40
    fh = 225
    
    # Property Inventory Cards Grid
    grid_w = cw
    card_w = (grid_w - 15) / 2
    card_h = 100
    
    cards_data = [
        ("Av. 18 de Julio 1420 - Apt 502", "Propietario: Roberto Silva", "Inquilino: Juan Pérez", "$ 850.00 / mes", "Corte: Día 5", "Comisión: 10%"),
        ("Bulevar Artigas 890", "Propietario: Ana Martínez", "Inquilino: María Rodríguez", "$ 1,200.00 / mes", "Corte: Día 10", "Comisión: 8%"),
        ("Calle Canelones 2105 - Local 1", "Propietario: Roberto Silva", "Inquilino: Carlos Gómez", "$ 950.00 / mes", "Corte: Día 1", "Comisión: 10%"),
        ("Av. Rivera 3400 - Apt 201", "Propietario: Gonzalo López", "Inquilino: Lucía Fernández", "$ 780.00 / mes", "Corte: Día 5", "Comisión: 10%"),
    ]
    
    for idx, (p_dir, p_owner, p_tenant, p_rent, p_day, p_comm) in enumerate(cards_data):
        col_idx = idx % 2
        row_idx = idx // 2
        
        px = cx + col_idx * (card_w + 15)
        py = fy - (row_idx + 1) * (card_h + 12)
        
        d.add(Rect(px, py, card_w, card_h, fillColor=colors.white, strokeColor=colors.HexColor("#CBD5E1"), strokeWidth=1, rx=5, ry=5))
        
        # Property Header
        d.add(Rect(px, py + card_h - 24, card_w, 24, fillColor=colors.HexColor("#F1F5F9"), strokeColor=None, rx=3, ry=3))
        d.add(String(px + 10, py + card_h - 16, p_dir, fontName="Helvetica-Bold", fontSize=9, fillColor=colors.HexColor("#0F172A")))
        
        # Property Specs
        d.add(String(px + 10, py + card_h - 38, p_owner, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#475569")))
        d.add(String(px + 10, py + card_h - 52, p_tenant, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#475569")))
        
        d.add(String(px + 10, py + 14, p_rent, fontName="Helvetica-Bold", fontSize=10, fillColor=colors.HexColor("#2563EB")))
        d.add(String(px + card_w - 110, py + 26, p_day, fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#64748B")))
        d.add(String(px + card_w - 110, py + 12, p_comm, fontName="Helvetica-Bold", fontSize=8, fillColor=colors.HexColor("#059669")))

    return d

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0F172A'),
        alignment=0,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#475569'),
        spaceAfter=15
    )
    
    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=10,
        spaceAfter=8
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=10
    )

    story = []
    
    # Page 1: Introduction & Dashboard Wireframe
    story.append(Paragraph("InmoControl — Bocetos de Interfaz & Arquitectura UI", title_style))
    story.append(Paragraph("Documento técnico de diseño de pantallas, componentes visuales y flujos de usuario (Versión 1.0)", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=12))
    
    story.append(Paragraph("1. Dashboard Principal (KPIs & Alertas de Mora)", h2_style))
    story.append(Paragraph("El panel principal consolida métricas clave en tarjetas KPI superiores (recaudación total, comisión de agencia, alertas de morosidad y tasa de cobranza) y presenta la tabla de control de cánones del mes actual.", body_style))
    story.append(create_wireframe_dashboard())
    story.append(PageBreak())
    
    # Page 2: Financial Administration & Settlement
    story.append(Paragraph("2. Administración Financiera & Liquidación Neta a Propietarios", h2_style))
    story.append(Paragraph("Permite registrar egresos/ingresos operativos y desplegar el modal interactivo de liquidación automática neta, calculando: <b>Cánones Cobrados - Comisión Agencia - Gastos = Saldo Neto a Transferir</b>.", body_style))
    story.append(create_wireframe_admin())
    story.append(PageBreak())
    
    # Page 3: Property & Entity Management
    story.append(Paragraph("3. Gestión de Entidades (Propiedades, Arrendadores y Arrendatarios)", h2_style))
    story.append(Paragraph("Vista estructurada por pestañas para la administración de propietarios con sus datos bancarios, inquilinos vinculados e inventario de inmuebles con sus respectivos días de corte de arriendo.", body_style))
    story.append(create_wireframe_entities())
    
    doc.build(story)
    print(f"PDF successfully generated at: {filename}")

if __name__ == "__main__":
    out_path = os.path.abspath("InmoControl_Bocetos_UI.pdf")
    build_pdf(out_path)
