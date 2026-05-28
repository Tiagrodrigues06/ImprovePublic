@echo off
color 0a
echo =======================================================
echo   IMPROVE SPORTS - ATUALIZADOR E INICIADOR V2.0
echo =======================================================
echo.
echo [1/3] A copiar ficheiros consolidados mais recentes...
copy /Y "..\SCOUTING\Competicao_Todas.xlsx" "Competicao_Todas.xlsx" >nul
copy /Y "..\SCOUTING\scouting.db" "scouting.db" >nul
copy /Y "..\SCOUTING\Dim_Clubes_Geo.xlsx" "Dim_Clubes_Geo.xlsx" >nul
echo Ficheiros de dados atualizados localmente!
echo.
echo [2/3] A fazer upload forcado para a Nuvem (GitHub)...
echo Isto garante que ficheiros grandes ou bloqueados por gitignore sao enviados.
git add -f app.py requirements.txt logo.png Dim_Clubes_Geo.xlsx scouting.db Competicao_Todas.xlsx
git commit -m "Atualizacao manual da base de dados V2"
git push origin main
echo Upload concluido! A tua app online V2 vai atualizar em segundos.
echo.
echo [3/3] A iniciar o Dashboard Streamlit V2 local...
start cmd /k "streamlit run app.py"
echo.
echo =======================================================
echo   PROCESSO V2 CONCLUIDO COM SUCESSO!
echo =======================================================
pause
