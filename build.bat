@echo off
title Build Python EXE
color 0A

echo ==========================================
echo      Building Python Application...
echo ==========================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed or not in PATH.
    pause
    exit /b
)

:: Install/Update PyInstaller
python -m pip install --upgrade pyinstaller

:: Remove previous build files
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist main.spec del /f /q main.spec

:: Build EXE
python -m PyInstaller ^
    --onefile ^
    --windowed ^
    --icon=icon.ico ^
    --name="ToolsEditor" ^
    tools_editor_qt.py

echo.
echo ==========================================
echo Build Complete!
echo EXE Location:
echo %cd%\dist\ToolsEditor.exe
echo ==========================================
pause