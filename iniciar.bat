@echo off
setlocal

if not exist node_modules (
  echo Instalando dependencias do PivoNauta...
  call npm install
  if errorlevel 1 exit /b 1
)

echo PivoNauta disponivel em http://localhost:4173
call npm run dev
