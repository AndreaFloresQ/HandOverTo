param([string]$Etiqueta = "antes")

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$carpeta = Join-Path $raiz "zap"
$base = "http://localhost:3000/api"

# --- Verificaciones previas ---
docker version | Out-Null

$respuesta = Read-Host "El servidor corre con la base TEMPORAL gestor_donaciones_zap? (s/n)"
if ($respuesta -ne "s") {
  Write-Host "Cancelado. El escaneo activo no debe correr contra tu base real." -ForegroundColor Yellow
  exit 1
}

try { Invoke-RestMethod "$base/health" | Out-Null }
catch {
  Write-Host "El servidor no responde en $base" -ForegroundColor Red
  exit 1
}

# --- Usuarios para el escaneo ---
$donador = @{
  nombre = "Donador ZAP"; direccion = "Calle 1"; ciudad = "Ciudad"
  telefono = "5551234567"; correo = "zap-donador@test.com"; password = "MiClave123"
} | ConvertTo-Json
try { Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType "application/json" -Body $donador | Out-Null } catch { }

function Obtener-Token($correo, $password) {
  $cuerpo = @{ correo = $correo; password = $password } | ConvertTo-Json
  $r = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body $cuerpo
  return $r.token
}

function Escribir-Opciones($nombreArchivo, $token) {
  $lineas = @(
    "replacer.full_list(0).description=auth",
    "replacer.full_list(0).enabled=true",
    "replacer.full_list(0).matchtype=REQ_HEADER",
    "replacer.full_list(0).matchstr=Authorization",
    "replacer.full_list(0).regex=false",
    "replacer.full_list(0).replacement=Bearer $token"
  )
  Set-Content -Path (Join-Path $carpeta $nombreArchivo) -Value $lineas -Encoding ascii
}

function Ejecutar-ZAP($script, $argumentos) {
  $parametros = @("run", "--rm", "-v", "${carpeta}:/zap/wrk:rw", "-t", "ghcr.io/zaproxy/zaproxy:stable", $script) + $argumentos
  & docker @parametros
}

# --- 1. API sin sesión ---
Write-Host "`n[1/4] Escaneo de la API sin sesión..." -ForegroundColor Cyan
Ejecutar-ZAP "zap-api-scan.py" @("-t", "openapi.yaml", "-f", "openapi", "-r", "reporte-$Etiqueta-api-sin-sesion.html", "-I")

# --- 2. API como donador ---
Write-Host "`n[2/4] Escaneo de la API como donador..." -ForegroundColor Cyan
Escribir-Opciones "options-donador.prop" (Obtener-Token "zap-donador@test.com" "MiClave123")
Ejecutar-ZAP "zap-api-scan.py" @("-t", "openapi.yaml", "-f", "openapi", "-r", "reporte-$Etiqueta-api-donador.html", "-I", "-z", "-configfile /zap/wrk/options-donador.prop")

# --- 3. API como admin ---
Write-Host "`n[3/4] Escaneo de la API como administrador..." -ForegroundColor Cyan
Escribir-Opciones "options-admin.prop" (Obtener-Token "admin@donaciones.test" "Admin12345")
Ejecutar-ZAP "zap-api-scan.py" @("-t", "openapi.yaml", "-f", "openapi", "-r", "reporte-$Etiqueta-api-admin.html", "-I", "-z", "-configfile /zap/wrk/options-admin.prop")

# --- 4. Frontend (escaneo base) ---
Write-Host "`n[4/4] Escaneo base del frontend..." -ForegroundColor Cyan
Ejecutar-ZAP "zap-baseline.py" @("-t", "http://host.docker.internal:3000", "-r", "reporte-$Etiqueta-frontend.html", "-I")

Write-Host "`nListo. Reportes en: $carpeta" -ForegroundColor Green