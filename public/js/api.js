const API = '/api';

function guardarSesion(token, usuario) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

function obtenerToken() {
  return localStorage.getItem('token');
}

function obtenerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/index.html';
}

// Protege una página: exige sesión y, opcionalmente, un rol concreto
function protegerPagina(rolRequerido) {
  const token = obtenerToken();
  const usuario = obtenerUsuario();
  if (!token || !usuario || (rolRequerido && usuario.rol !== rolRequerido)) {
    cerrarSesion();
  }
  return usuario;
}

// Envuelve fetch: agrega el token, manda JSON (o FormData tal cual) y lanza error si falla
async function peticion(ruta, opciones = {}) {
  const headers = { ...(opciones.headers || {}) };
  const token = opciones.sinAuth ? null : obtenerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = opciones.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const respuesta = await fetch(`${API}${ruta}`, { ...opciones, headers, body });
  const datos = await respuesta.json().catch(() => ({}));

  // Token vencido o inválido: se cierra la sesión
  if (respuesta.status === 401 && token) cerrarSesion();

  if (!respuesta.ok) throw new Error(datos.error || 'Error en la petición');
  return datos;
}

// Evita inyectar HTML cuando mostremos datos escritos por usuarios
function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}