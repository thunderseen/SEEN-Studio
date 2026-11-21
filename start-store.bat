@echo off
title SEEN VirtualFit Store Server (http://127.0.0.1:8787/)
start "" http://127.0.0.1:8787/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
