const usuario = protegerPagina('donador');
document.getElementById('saludo').textContent = `Hola, ${usuario.nombre}`;
document.getElementById('btn-salir').addEventListener('click', cerrarSesion);

const ETIQUETAS_ESTADO = {
  pendiente: 'En espera de aprobación',
  rechazada: 'Rechazada',
  en_camino: 'En camino a ser recolectada',
  en_transito: 'En tránsito',
  entregada: 'Entregada',
};

// --- Selector de beneficiarios (público, solo para elegir destino) ---
async function cargarBeneficiarios() {
  try {
    const beneficiarios = await peticion('/public/beneficiaries');
    const select = document.getElementById('beneficiarioId');
    beneficiarios.forEach((b) => {
      const opcion = document.createElement('option');
      opcion.value = b.id;
      opcion.textContent = b.nombre;
      select.appendChild(opcion);
    });
  } catch (err) {
    console.error('No se pudieron cargar los beneficiarios:', err.message);
  }
}

// --- Mostrar/ocultar fecha de caducidad ---
const checkPerecedero = document.getElementById('perecedero');
const campoCaducidad = document.getElementById('campo-caducidad');
const inputCaducidad = document.getElementById('fechaCaducidad');
checkPerecedero.addEventListener('change', () => {
  campoCaducidad.classList.toggle('oculto', !checkPerecedero.checked);
  inputCaducidad.required = checkPerecedero.checked;
});

// --- Nueva donación ---
const formDonacion = document.getElementById('form-donacion');
const mensajeDonacion = document.getElementById('mensaje-donacion');

formDonacion.addEventListener('submit', async (e) => {
  e.preventDefault();
  mensajeDonacion.className = 'mensaje oculto';

  const datos = new FormData(formDonacion);
  if (!checkPerecedero.checked) datos.delete('fechaCaducidad');
  datos.set('perecedero', checkPerecedero.checked);

  try {
    await peticion('/donations', { method: 'POST', body: datos });
    formDonacion.reset();
    campoCaducidad.classList.add('oculto');
    mensajeDonacion.textContent = 'Donación registrada correctamente';
    mensajeDonacion.className = 'mensaje ok';
    cargarDonaciones();
  } catch (err) {
    mensajeDonacion.textContent = err.message;
    mensajeDonacion.className = 'mensaje error';
  }
});

// --- Tabla de mis donaciones ---
async function cargarDonaciones() {
  const tabla = document.getElementById('tabla-donaciones');
  const sinDonaciones = document.getElementById('sin-donaciones');
  try {
    const donaciones = await peticion('/donations/mias');
    tabla.innerHTML = '';
    sinDonaciones.classList.toggle('oculto', donaciones.length > 0);

    donaciones.forEach((d) => {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${escapeHtml(d.producto)}</td>
        <td>${escapeHtml(d.categoria)}</td>
        <td>${d.beneficiario ? escapeHtml(d.beneficiario.nombre) : 'Por definir'}</td>
        <td><span class="etiqueta estado-${d.estado}">${ETIQUETAS_ESTADO[d.estado]}</span></td>
        <td><span class="urgencia-${d.urgencia}">${d.urgencia}</span></td>
        <td>${new Date(d.createdAt).toLocaleDateString()}</td>
      `;
      tabla.appendChild(fila);
    });
  } catch (err) {
    console.error('No se pudieron cargar las donaciones:', err.message);
  }
}

// --- Notificaciones ---
const btnNotif = document.getElementById('btn-notif');
const panelNotif = document.getElementById('panel-notif');
const listaNotif = document.getElementById('lista-notif');
const contadorNotif = document.getElementById('contador-notif');

async function cargarNotificaciones() {
  try {
    const notificaciones = await peticion('/donations/notificaciones');
    const noLeidas = notificaciones.filter((n) => !n.leida).length;
    contadorNotif.textContent = noLeidas > 0 ? `(${noLeidas})` : '';

    listaNotif.innerHTML = notificaciones.length
      ? ''
      : '<p class="vacio">No tienes notificaciones.</p>';

    notificaciones.forEach((n) => {
      const div = document.createElement('div');
      div.className = `notif ${n.leida ? '' : 'no-leida'}`;
      div.innerHTML = `${escapeHtml(n.mensaje)}<small>${new Date(n.createdAt).toLocaleString()}</small>`;
      if (!n.leida) {
        div.style.cursor = 'pointer';
        div.title = 'Clic para marcar como leída';
        div.addEventListener('click', async () => {
          await peticion(`/donations/notificaciones/${n.id}/leida`, { method: 'PATCH' });
          cargarNotificaciones();
        });
      }
      listaNotif.appendChild(div);
    });
  } catch (err) {
    console.error('No se pudieron cargar las notificaciones:', err.message);
  }
}

btnNotif.addEventListener('click', () => panelNotif.classList.toggle('oculto'));

// --- Inicio ---
cargarBeneficiarios();
cargarDonaciones();
cargarNotificaciones();