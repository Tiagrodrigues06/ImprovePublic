import streamlit as st
import pandas as pd
from datetime import datetime
import io
import folium
from streamlit_folium import st_folium

# ─── Configuração da Página ────────────────────────────────────────────────────
st.set_page_config(page_title="Improve Sports: Scouting", layout="wide", page_icon="⚽")

# ─── CSS Premium ───────────────────────────────────────────────────────────────
st.markdown("""
    <style>
        .main { background-color: #0f172a; color: #f8fafc; }
        h1, h2, h3 { color: #38bdf8; font-family: 'Inter', sans-serif; }
        .metric-card {
            background: rgba(30, 41, 59, 0.7);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            text-align: center;
            border-left: 4px solid #38bdf8;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 12px rgba(56,189,248,0.4);
        }
        .stDataFrame { background-color: #1e293b; border-radius: 10px; }
    </style>
""", unsafe_allow_html=True)

# ─── Cabeçalho ─────────────────────────────────────────────────────────────────
col_logo, col_title = st.columns([1, 10])
with col_logo:
    import os
    if os.path.exists("logo.png"):
        st.image("logo.png", use_container_width=True)
with col_title:
    st.title("Improve Sports: Scouting")

# ─── Helper para exibir tabela simples ─────────────────────────────────────────
def display_scouting_table(df, key, filename="scouting_export.xlsx"):
    if key not in st.session_state:
        st.session_state[key] = 50

    subset = df.head(st.session_state[key])

    col_config = {}
    if 'Relatório' in subset.columns:
        col_config["Relatório"] = st.column_config.LinkColumn("Relatório", display_text="Ver Relatório")

    format_dict = {}
    if 'Idade' in subset.columns:
        format_dict['Idade'] = '{:.0f}'

    st.dataframe(
        subset.style.format(format_dict, na_rep='-'),
        use_container_width=True,
        hide_index=True,
        column_config=col_config
    )

    c1, c2 = st.columns([1, 1])
    with c1:
        if len(df) > st.session_state[key]:
            if st.button(f"📥 Carregar mais 50 ({len(df) - st.session_state[key]} restantes)", key=f"btn_{key}"):
                st.session_state[key] += 50
                st.rerun()
    with c2:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        st.download_button(
            label="📊 Extrair como XLSX",
            data=output.getvalue(),
            file_name=filename,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            key=f"dl_{key}"
        )

# ─── Carregamento de Dados ─────────────────────────────────────────────────────
@st.cache_data
def load_data():
    import sqlite3, os, urllib.parse

    db_path = 'scouting.db'
    df = None
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            df = pd.read_sql_query("SELECT * FROM scouting_data", conn)
            conn.close()
            renames = {}
            if 'Posicao' in df.columns:
                renames['Posicao'] = 'Posição'
            if 'Data_Nascimento' in df.columns:
                renames['Data_Nascimento'] = 'Data Nascimento'
            if renames:
                df = df.rename(columns=renames)
        except Exception as e:
            st.error(f"Erro ao ler BD SQLite: {e}")
            df = None

    if df is None or df.empty:
        try:
            df = pd.read_excel("Competicao_Todas.xlsx")
        except FileNotFoundError:
            return pd.DataFrame()

    # Limpeza numérica
    for col in ['T', 'SU', 'M', 'J', 'GM']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # Calcular Idade
    def calc_age(row):
        if pd.notna(row.get('Idade')):
            try:
                return float(row['Idade'])
            except:
                pass
        data = row.get('Data Nascimento')
        if pd.isna(data):
            return None
        try:
            data_str = str(data).split(' ')[0]
            if '-' in data_str:
                partes = data_str.split('-')
                nasc = datetime.strptime(data_str, '%Y-%m-%d') if len(partes[0]) == 4 else datetime.strptime(data_str, '%d-%m-%Y')
            elif '/' in data_str:
                partes = data_str.split('/')
                nasc = datetime.strptime(data_str, '%d/%m/%Y') if len(partes[2]) == 4 else datetime.strptime(data_str, '%Y/%m/%d')
            else:
                return None
            hoje = datetime.today()
            return hoje.year - nasc.year - ((hoje.month, hoje.day) < (nasc.month, nasc.day))
        except:
            return None

    if 'Idade' not in df.columns:
        df['Idade'] = None
    df['Idade'] = df.apply(calc_age, axis=1)
    df['Idade'] = pd.to_numeric(df['Idade'], errors='coerce').astype('Int64')

    # Garantir 1 entrada por jogador
    if 'Jogador' in df.columns and 'J' in df.columns:
        df = df.sort_values(by=['J', 'M'], ascending=[False, False]).drop_duplicates(subset=['Jogador'], keep='first')

    # Coluna Relatório (Google Forms pré-preenchido)
    def generate_form_link(row):
        nome = str(row.get('Jogador', ''))
        equipa = str(row.get('Equipa', ''))
        texto = f"{nome} [{equipa}]" if equipa else nome
        return f"https://docs.google.com/forms/d/e/1FAIpQLSf40zlpzNzoNvDMl53XIfVvXxKDVRIcOXEoFHaMivzpC4Z2aQ/viewform?usp=pp_url&entry.1156344699={urllib.parse.quote(texto)}"

    df['Relatório'] = df.apply(generate_form_link, axis=1)

    return df

# ─── Main ──────────────────────────────────────────────────────────────────────
df_raw = load_data()

if df_raw.empty:
    st.error("Nenhum ficheiro encontrado (scouting.db / Competicao_Todas.xlsx). Corra o scrapper primeiro.")
else:
    df = df_raw.copy()

    # Mapeamento de Categorias
    categorias_map = {
        "Liga Nacional": ["CP_SerieA", "CP_SerieB", "CP_SerieC", "CP_SerieD", "Liga3_SerieA", "Liga3_SerieB"],
        "1ª Divisão Distrital": ["Braga", "Leiria", "Coimbra", "Vila_Real", "Algarve", "Aveiro",
                                  "Castelo_Branco", "Porto", "Lisboa", "Viseu", "Setubal", "Santarem",
                                  "Braganca", "Beja", "Evora", "Viana_Castelo", "Guarda", "Portalegre"],
        "2ª Divisão Distrital": ["II_Lisboa_Serie1", "II_Lisboa_Serie2", "II_Porto_Serie1",
                                  "II_Porto_Serie2", "II_Porto_Serie3", "II_Aveiro"],
        "Ligas Formação": ["LigaRev_SerieNorte", "LigaRev_SerieSul", "Sub23-SerieNorte", "Sub23-SerieSul"],
        "Estrangeiro": ["National_I", "Copinha"]
    }
    inv_map = {div: cat for cat, divs in categorias_map.items() for div in divs}
    df['Categoria'] = df['Divisao'].map(inv_map).fillna("Outro")

    # ─── Barra Lateral de Filtros ───────────────────────────────────────────────
    st.sidebar.header("🔍 Filtros Scouting")

    df['Nome_Dropdown'] = df['Jogador'] + " (" + df['Equipa'] + ")"
    jogadores_sel = st.sidebar.multiselect("Procurar Jogador", options=sorted(df['Nome_Dropdown'].dropna().unique()))
    if jogadores_sel:
        df = df[df['Nome_Dropdown'].isin(jogadores_sel)]

    cats_sel = st.sidebar.multiselect("Categoria de Liga", options=list(categorias_map.keys()) + ["Outro"])
    if cats_sel:
        df = df[df['Categoria'].isin(cats_sel)]

    divs_sel = st.sidebar.multiselect("Divisão", options=sorted(df['Divisao'].dropna().unique()))
    if divs_sel:
        df = df[df['Divisao'].isin(divs_sel)]

    equipas_sel = st.sidebar.multiselect("Equipa", options=sorted(df['Equipa'].dropna().unique()))
    if equipas_sel:
        df = df[df['Equipa'].isin(equipas_sel)]

    if 'Posição' in df.columns:
        pos_sel = st.sidebar.multiselect("Posição", options=sorted(df['Posição'].dropna().unique()))
        if pos_sel:
            df = df[df['Posição'].isin(pos_sel)]

    if df['Idade'].notna().sum() > 0:
        idade_min = int(df['Idade'].min(skipna=True))
        idade_max = int(df['Idade'].max(skipna=True))
        if idade_min < idade_max:
            idades = st.sidebar.slider("Idade do Jogador", idade_min, idade_max, (idade_min, idade_max))
            df = df[(df['Idade'].isna()) | ((df['Idade'] >= idades[0]) & (df['Idade'] <= idades[1]))]

    min_jogos = st.sidebar.slider("Mínimo de Jogos", 0, 50, 5)
    if 'J' in df.columns:
        df = df[df['J'] >= min_jogos]

    # ─── Tabs Principais ────────────────────────────────────────────────────────
    tab_mapa, tab_scouting = st.tabs(["🌍 Visão Geral (Mapa)", "🔎 Scouting"])

    # ── Tab 1: Mapa ──────────────────────────────────────────────────────────────
    with tab_mapa:
        st.subheader("Panorama de Recrutamento")
        st.markdown("Mapa interativo de clubes baseados nos filtros selecionados.")

        if os.path.exists("Dim_Clubes_Geo.xlsx"):
            df_geo = pd.read_excel("Dim_Clubes_Geo.xlsx")
            df_geo = df_geo.dropna(subset=['lat', 'lon'])

            # Regras de negócio: CP + Liga 3 → todos; Distritais I → >= 300 mins
            ligas_todos  = ['CP_SerieA', 'CP_SerieB', 'CP_SerieC', 'CP_SerieD', 'Liga3_SerieA', 'Liga3_SerieB']
            ligas_300    = ['Aveiro', 'Lisboa', 'Porto', 'Sub23-SerieNorte', 'Sub23-SerieSul',
                            'LigaRev_SerieNorte', 'LigaRev_SerieSul']

            df_rel_todos = df[df['Divisao'].isin(ligas_todos)]
            df_rel_300   = df[(df['Divisao'].isin(ligas_300)) & (df['M'] >= 300)]
            df_rel       = pd.concat([df_rel_todos, df_rel_300])
            rel_counts   = df_rel.groupby('Equipa').size().reset_index(name='Relatórios Disponíveis')

            df_counts = df.groupby('Equipa').size().reset_index(name='Jogadores Observados')
            df_counts = pd.merge(df_counts, rel_counts, on='Equipa', how='left').fillna({'Relatórios Disponíveis': 0})
            df_map    = pd.merge(df_counts, df_geo, on='Equipa', how='inner')

            if not df_map.empty:
                m = folium.Map(location=[39.3999, -8.2245], zoom_start=6, tiles="CartoDB positron")

                for _, row in df_map.iterrows():
                    count = row['Jogadores Observados']
                    rels  = int(row['Relatórios Disponíveis'])

                    if count >= 10:
                        color, rad = "green", 10
                    elif count >= 3:
                        color, rad = "orange", 7
                    else:
                        color, rad = "red", 5

                    folium.CircleMarker(
                        location=[row['lat'], row['lon']],
                        radius=rad,
                        popup=f"<b>{row['Equipa']}</b><br>Jogadores Observados: {count}<br>Relatórios Disponíveis: {rels}",
                        tooltip=f"{row['Equipa']} ({count} jogadores, {rels} relatórios)",
                        color=color, fill=True, fillColor=color, fillOpacity=0.7
                    ).add_to(m)

                st_folium(m, width=1200, height=600, returned_objects=[])
            else:
                st.info("Nenhuma equipa no filtro atual possui dados de geolocalização.")
        else:
            st.warning("Ficheiro Dim_Clubes_Geo.xlsx não encontrado.")

    # ── Tab 2: Scouting (simplificado) ──────────────────────────────────────────
    with tab_scouting:
        st.subheader("Base de Dados Scouting")

        # Métricas rápidas
        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown(f"<div class='metric-card'><h4>Total Jogadores</h4><h2>{len(df)}</h2></div>", unsafe_allow_html=True)
        with c2:
            n_equipas = df['Equipa'].nunique() if 'Equipa' in df.columns else 0
            st.markdown(f"<div class='metric-card'><h4>Equipas</h4><h2>{n_equipas}</h2></div>", unsafe_allow_html=True)
        with c3:
            n_divs = df['Divisao'].nunique() if 'Divisao' in df.columns else 0
            st.markdown(f"<div class='metric-card'><h4>Divisões</h4><h2>{n_divs}</h2></div>", unsafe_allow_html=True)

        st.markdown("---")

        # Tabela simplificada: apenas os campos pedidos
        cols_v2 = ['Jogador', 'Equipa', 'Divisao', 'Idade', 'Posição', 'Relatório']
        cols_v2 = [c for c in cols_v2 if c in df.columns]

        display_scouting_table(df[cols_v2], "scouting_v2", "scouting_v2_export.xlsx")
