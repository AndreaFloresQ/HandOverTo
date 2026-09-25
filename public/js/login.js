const tabLogin = document.getElementById('tab-login');
const tabRegistro = document.getElementById('tab-registro');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const mensaje = document.getElementById('mensaje');
const afiliado = document.getElementById('afiliado');
const campoEmpresa = document.getElementById('campo-empresa');
const inputEmpresa = document.getElementById('reg-empresa');

function irAlDashboard(rol) {
  window.location.href = rol === 'admin' ? '/admin.html' : '/donador.html';
}

// Si ya hay sesión, no tiene caso mostrar el login
const sesionActual = obtenerUsuario();
if (obtenerToken() && sesionActual) irAlDashboard(sesionActual.rol);

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`;
}

function limpiarMensaje() {
  mensaje.className = 'mensaje oculto';
}

function mostrarPestana(cual) {
  const esLogin = cual === 'login';
  formLogin.classList.toggle('oculto', !esLogin);
  formRegistro.classList.toggle('oculto', esLogin);
  tabLogin.classList.toggle('activa', esLogin);
  tabRegistro.classList.toggle('activa', !esLogin);
  limpiarMensaje();
}

tabLogin.addEventListener('click', () => mostrarPestana('login'));
tabRegistro.addEventListener('click', () => mostrarPestana('registro'));

// El campo de empresa solo aparece si el donador está afiliado
afiliado.addEventListener('change', () => {
  campoEmpresa.classList.toggle('oculto', !afiliado.checked);
  inputEmpresa.required = afiliado.checked;
});

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarMensaje();
  try {
    const datos = Object.fromEntries(new FormData(formLogin));
    const { token, usuario } = await peticion('/auth/login', {
      method: 'POST',
      body: datos,
      sinAuth: true,
    });
    guardarSesion(token, usuario);
    irAlDashboard(usuario.rol);
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});

formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarMensaje();
  try {
    const datos = Object.fromEntries(new FormData(formRegistro));
    if (!afiliado.checked || !datos.empresa) delete datos.empresa;
    delete datos.afiliado;

    await peticion('/auth/register', { method: 'POST', body: datos, sinAuth: true });

    formLogin.correo.value = datos.correo;
    formRegistro.reset();
    campoEmpresa.classList.add('oculto');
    mostrarPestana('login');
    mostrarMensaje('Cuenta creada. Ahora puedes iniciar sesión.', 'ok');
  } catch (err) {
    mostrarMensaje(err.message, 'error');
  }
});